# -*- coding: utf-8 -*-
"""
Analizza nel cloud (GitHub Actions): prende i link dalla coda di Supabase quando il PC e' spento,
scarica l'audio con yt-dlp, trascrive con faster-whisper e scrive il report nella stessa riga.

IL REPO E I LOG DELLE ACTIONS SONO PUBBLICI.
Qui si stampano SOLO numero della riga, esito e tempi. Mai link, titoli, trascrizioni o report.

Serve una variabile d'ambiente (secret di GitHub): ANALIZZA_CLOUD_CODICE.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import timedelta
from pathlib import Path

FUNZIONE = "https://udubhzamghhlkxgepmmc.supabase.co/functions/v1/analizza-cloud"
CODICE = os.environ.get("ANALIZZA_CLOUD_CODICE", "")
MINUTI_PER_PRENDERE = 12      # dopo 12 minuti non prendo altri link (il PC riprende quelli fermi da 30)
DURATA_MAX_SECONDI = 20 * 60  # video piu' lunghi di 20 minuti: li lascio al PC
MODELLO = os.environ.get("ANALIZZA_MODELLO", "small")

PIATTAFORME = {"youtube.com": "YouTube", "youtu.be": "YouTube", "instagram.com": "Instagram",
               "tiktok.com": "TikTok", "facebook.com": "Facebook", "fb.watch": "Facebook",
               "x.com": "X", "twitter.com": "X", "threads.net": "Threads"}


class Rimanda(Exception):
    """Il cloud non puo' fare questo link: torna al PC con questo motivo (leggibile)."""


def scrivi(m):
    print(m, flush=True)


def chiama(azione, **dati):
    corpo = json.dumps(dict(dati, azione=azione)).encode("utf-8")
    req = urllib.request.Request(FUNZIONE, data=corpo, method="POST",
                                 headers={"Content-Type": "application/json", "x-codice": CODICE})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError("La funzione analizza-cloud ha risposto %s" % e.code)


def piattaforma(link):
    m = re.match(r"^https?://([^/?#:]+)", link or "")
    host = (m.group(1) if m else "").lower()
    for dominio, nome in PIATTAFORME.items():
        if host == dominio or host.endswith("." + dominio):
            return nome
    return "?"


def motivo_leggibile(stderr):
    """Trasforma l'errore di yt-dlp in una frase semplice per la pagina del telefono."""
    t = (stderr or "").lower()
    if "not a bot" in t or "sign in to confirm" in t:
        return "La piattaforma ha bloccato il server del cloud (chiede l'accesso)."
    if "login required" in t or "log in" in t or "cookies" in t or "rate-limit" in t:
        return "La piattaforma chiede l'accesso per questo video: dal cloud non si puo'."
    if "private" in t:
        return "Il video e' privato."
    if "unavailable" in t or "not available" in t or "removed" in t or "404" in t:
        return "Il video non e' disponibile (tolto, privato o link sbagliato)."
    if "unsupported url" in t:
        return "Questo tipo di link non si scarica dal cloud."
    return "Download non riuscito dal cloud."


def scarica(link, cartella):
    """Solo l'audio (16 kHz mono) + i dati del post. Ritorna (wav, info)."""
    base = ["yt-dlp", "-q", "--no-warnings", "--no-progress", "--no-playlist"]
    # 1) prima solo i dati, per controllare la durata senza scaricare nulla
    esito = subprocess.run(base + ["-J", link], capture_output=True, text=True, timeout=180)
    if esito.returncode != 0:
        raise Rimanda(motivo_leggibile(esito.stderr))
    info = json.loads(esito.stdout or "{}")
    if info.get("_type") == "playlist":
        raise Rimanda("E' un carosello o una playlist: lo fa il PC.")
    durata = float(info.get("duration") or 0)
    if durata > DURATA_MAX_SECONDI:
        raise Rimanda("Video troppo lungo per il cloud (%d minuti)." % (durata // 60))
    # 2) poi l'audio
    esito = subprocess.run(base + ["-f", "bestaudio/best", "-x", "--audio-format", "wav",
                                   "--postprocessor-args", "ExtractAudio:-ar 16000 -ac 1",
                                   "-o", str(cartella / "media.%(ext)s"), link],
                           capture_output=True, text=True, timeout=600)
    wav = cartella / "media.wav"
    if esito.returncode != 0 or not wav.exists():
        raise Rimanda(motivo_leggibile(esito.stderr))
    return wav, info


def orario(secondi):
    s = int(secondi)
    return "%02d:%02d" % (s // 60, s % 60) if s < 3600 else str(timedelta(seconds=s))


def leggi_wav(wav):
    """wav 16 kHz mono -> array float32. Senza PyAV: la sua versione nuova rompe faster-whisper (prova del 13/11)."""
    import wave
    import numpy as np
    with wave.open(str(wav), "rb") as w:
        dati = w.readframes(w.getnframes())
    return np.frombuffer(dati, dtype=np.int16).astype(np.float32) / 32768.0


def trascrivi(modello, audio):
    segmenti, info = modello.transcribe(audio, vad_filter=True, beam_size=5)
    righe = ["[%s] %s" % (orario(s.start), s.text.strip()) for s in segmenti if s.text.strip()]
    return righe, info.language, info.language_probability


def citati(testo):
    """Siti e profili scritti nella didascalia o detti nel video (grezzo, da verificare)."""
    siti = re.findall(r"(?<![@\w.])(?:https?://)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|it|io|ai|app|dev|net|org|co|gov|eu|me|so|tv)\b(?:/[^\s)]*)?",
                      testo, flags=re.IGNORECASE)
    profili = re.findall(r"(?<![\w.])@[A-Za-z0-9_.]{2,30}", testo)
    visti, uscita = set(), []
    for x in siti + profili:
        k = x.lower().rstrip(".")
        if k not in visti:
            visti.add(k)
            uscita.append(x.rstrip("."))
    return uscita[:30]


def componi_report(link, info, righe, lingua, sicurezza, secondi):
    autore = info.get("uploader") or info.get("channel") or info.get("creator") or "—"
    titolo = ((info.get("title") or "").splitlines() or ["—"])[0] or "—"
    durata = info.get("duration")
    larg, alt = info.get("width"), info.get("height")
    descr = (info.get("description") or "").strip()
    trascrizione = "\n".join(righe) if righe else "(nel video non si sente parlato)"
    testo_per_citati = descr + "\n" + " ".join(r.split("] ", 1)[-1] for r in righe)
    parti = [
        "# REPORT ANALIZZA REEL",
        "- Link: %s" % link,
        "- Autore: %s" % autore,
        "- Titolo: %s" % titolo,
        "- Durata: %s s · Risoluzione: %s" % (round(float(durata), 1) if durata else "?",
                                              "%s×%s" % (larg, alt) if larg and alt else "?"),
        "- Piattaforma: %s" % piattaforma(link),
        "- Fatto da: cloud (PC spento) · lingua %s (%d%%) · %d s" % (lingua, round(sicurezza * 100), secondi),
        "",
        "> Report BASE fatto nel cloud perche' il PC era spento: c'e' la trascrizione con i tempi e i dati del post.",
        "> Rispetto al PC mancano: la linea del tempo «cosa si vede» (analisi delle immagini con IA),",
        "> il video sul telefono e i file per Claude. Per il report completo: col PC acceso rimanda lo stesso link.",
        "",
        "## Didascalia del post",
        descr or "(nessuna didascalia)",
        "",
        "## Trascrizione",
        trascrizione,
    ]
    lista = citati(testo_per_citati)
    if lista:
        parti += ["", "## Siti, profili e strumenti citati (da verificare)"] + ["- %s" % x for x in lista]
    return "\n".join(parti)


def lavora(modello, riga):
    id_riga, link = riga["id"], (riga.get("link") or "").strip().rstrip("!")
    inizio = time.time()
    cartella = Path(tempfile.mkdtemp(prefix="analizza_"))
    try:
        wav, info = scarica(link, cartella)
        audio = leggi_wav(wav)
        if not info.get("duration"):  # Instagram spesso non la dice: la calcolo dall'audio (16 kHz)
            info["duration"] = len(audio) / 16000
        righe, lingua, sicurezza = trascrivi(modello, audio)
        report = componi_report(link, info, righe, lingua, sicurezza, time.time() - inizio)
        esito = chiama("fatto", id=id_riga, report=report)
        scrivi("#%s %s: fatto in %.0f s%s" % (id_riga, piattaforma(link), time.time() - inizio,
                                             "" if esito.get("aggiornato") else " (ma la riga era gia' cambiata)"))
    except Rimanda as e:
        chiama("rimanda", id=id_riga, motivo=str(e))
        scrivi("#%s %s: lasciato al PC dopo %.0f s" % (id_riga, piattaforma(link), time.time() - inizio))
    except Exception as e:  # imprevisto: il link torna al PC, il motivo vero non va nel log pubblico
        try:
            chiama("rimanda", id=id_riga, motivo="Errore imprevisto nel cloud (%s)." % type(e).__name__)
        except Exception:
            pass
        scrivi("#%s %s: errore imprevisto (%s), lasciato al PC" % (id_riga, piattaforma(link), type(e).__name__))
    finally:
        shutil.rmtree(cartella, ignore_errors=True)  # niente file scaricati lasciati in giro


def prova():
    """Collaudo senza Supabase: link pubblici di prova, nel log solo esito, tempi e sezioni del report."""
    from faster_whisper import WhisperModel
    modello = WhisperModel(MODELLO, device="cpu", compute_type="int8")
    for link in ("https://www.tiktok.com/@neildegrassetyson/video/7482856405934918955",
                 "https://www.instagram.com/reel/Dd1gQBsCWE8/",
                 "https://www.youtube.com/watch?v=jNQXAC9IVRw"):
        inizio = time.time()
        cartella = Path(tempfile.mkdtemp(prefix="analizza_"))
        try:
            wav, info = scarica(link, cartella)
            audio = leggi_wav(wav)
            if not info.get("duration"):
                info["duration"] = len(audio) / 16000
            righe, lingua, sicurezza = trascrivi(modello, audio)
            report = componi_report(link, info, righe, lingua, sicurezza, time.time() - inizio)
            sezioni = [r for r in report.splitlines() if r.startswith("#")]
            ha_durata = "Durata: ?" not in report
            scrivi("%s: OK in %.0f s | report %d caratteri | %d righe di trascrizione | durata %s | sezioni %s" % (
                piattaforma(link), time.time() - inizio, len(report), len(righe),
                "si'" if ha_durata else "no", " / ".join(sezioni)))
        except Rimanda as e:
            scrivi("%s: lasciato al PC in %.0f s | motivo per la pagina: %s" % (piattaforma(link), time.time() - inizio, e))
        finally:
            shutil.rmtree(cartella, ignore_errors=True)
        scrivi("  cartella temporanea cancellata: %s" % ("si'" if not cartella.exists() else "NO"))


def main():
    if "--prova" in sys.argv:
        prova()
        return
    if not CODICE:
        scrivi("Manca il secret ANALIZZA_CLOUD_CODICE su GitHub.")
        sys.exit(1)
    inizio = time.time()
    modello = None
    fatti = 0
    while time.time() - inizio < MINUTI_PER_PRENDERE * 60:
        riga = chiama("prendi").get("riga")
        if not riga:
            break
        if modello is None:
            from faster_whisper import WhisperModel  # caricato solo se c'e' lavoro
            modello = WhisperModel(MODELLO, device="cpu", compute_type="int8")
        lavora(modello, riga)
        fatti += 1
    scrivi("Fine: %d link in %.0f s." % (fatti, time.time() - inizio))


if __name__ == "__main__":
    main()
