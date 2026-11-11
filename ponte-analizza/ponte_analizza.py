# -*- coding: utf-8 -*-
"""
Ponte Analizza: collega l'app Analizza (sul PC) alla coda su Supabase.

Ogni tot secondi chiede a Supabase "c'e' un link da analizzare?".
Se si', lo passa ad Analizza, aspetta il report e lo rimette su Supabase.

Solo libreria standard di Python. Nessun pip.
Uso:
    python ponte_analizza.py              ciclo continuo
    python ponte_analizza.py --una-volta  un solo giro, poi esce
    python ponte_analizza.py --prova      controlla i collegamenti, non tocca la coda
"""
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CARTELLA_SCRIPT = Path(__file__).resolve().parent
FILE_ENV = CARTELLA_SCRIPT / ".env"
FILE_LOG = CARTELLA_SCRIPT / "ponte.log"
MAX_CARATTERI_REPORT = 200000

# Video sul telefono: cartella privata dello Storage di Supabase (piano gratis: max 50 MB a file, 1 GB in tutto)
CARTELLA_VIDEO = "analizza-video"
MAX_BYTE_VIDEO = 50 * 1024 * 1024
GIORNI_VIDEO = 7            # dopo 7 giorni il video si cancella da Supabase (sul PC resta)
PULIZIA_OGNI_SECONDI = 3600
TIPI_VIDEO = {".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska"}

# Valori letti dal file .env (riempiti da carica_config)
CONFIG = {}


# ---------------------------------------------------------------- log
def log(messaggio):
    """Scrive una riga con l'ora, a schermo e nel file ponte.log. Mai la chiave."""
    chiave = CONFIG.get("SUPABASE_SERVICE_KEY", "")
    if chiave:
        messaggio = str(messaggio).replace(chiave, "***")
    riga = "[%s] %s" % (datetime.now().strftime("%d/%m/%Y %H:%M:%S"), messaggio)
    try:
        print(riga, flush=True)
    except Exception:
        pass
    try:
        with open(FILE_LOG, "a", encoding="utf-8") as f:
            f.write(riga + "\n")
    except Exception:
        pass


# ------------------------------------------------------- configurazione
def leggi_env(percorso):
    """Legge un file .env semplice: CHIAVE=valore, commenti con #."""
    valori = {}
    if not percorso.exists():
        return valori
    for riga in percorso.read_text(encoding="utf-8-sig").splitlines():
        riga = riga.strip()
        if not riga or riga.startswith("#") or "=" not in riga:
            continue
        nome, valore = riga.split("=", 1)
        valore = valore.strip()
        if len(valore) >= 2 and valore[0] == valore[-1] and valore[0] in "\"'":
            valore = valore[1:-1]
        valori[nome.strip()] = valore
    return valori


def cartelle_lavoro_ia():
    """
    Le possibili cartelle «Lavoro IA», dalla piu' probabile.
    Prima quella che contiene questo ponte (Lavoro IA\\App\\ponte-analizza),
    poi OneDrive\\Desktop, e solo alla fine il Desktop normale: sul PC di
    Alessandro c'e' anche una vecchia copia in Desktop\\Lavoro IA da non usare.
    """
    casa = Path.home()
    basi = [CARTELLA_SCRIPT.parent.parent]
    for var in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        if os.environ.get(var):
            basi.append(Path(os.environ[var]) / "Desktop" / "Lavoro IA")
    basi += [casa / "OneDrive" / "Desktop" / "Lavoro IA", casa / "Desktop" / "Lavoro IA"]
    viste, uniche = set(), []
    for b in basi:
        chiave = str(b).lower()
        if chiave not in viste:
            viste.add(chiave)
            uniche.append(b)
    return uniche


def trova_cartella_report():
    """Cartella Analisi\\Reel accanto alla stessa Analizza usata dal ponte. Ritorna un Path o None."""
    for base in cartelle_lavoro_ia():
        candidata = base / "Analisi" / "Reel"
        if candidata.is_dir():
            return candidata
    return None


def carica_config():
    env = leggi_env(FILE_ENV)
    CONFIG.update({
        "SUPABASE_URL": env.get("SUPABASE_URL", "").rstrip("/"),
        "SUPABASE_SERVICE_KEY": env.get("SUPABASE_SERVICE_KEY", ""),
        "CARTELLA_REPORT": env.get("CARTELLA_REPORT", ""),
        "ANALIZZA_URL": (env.get("ANALIZZA_URL") or "http://localhost:8765").rstrip("/"),
        "ANALIZZA_AVVIO": env.get("ANALIZZA_AVVIO", ""),
        "COMANDO_ANALISI": env.get("COMANDO_ANALISI", ""),
        "ATTESA_SECONDI": numero(env.get("ATTESA_SECONDI"), 30),
        "TEMPO_MAX_MINUTI": numero(env.get("TEMPO_MAX_MINUTI"), 20),
    })
    if not CONFIG["CARTELLA_REPORT"]:
        trovata = trova_cartella_report()
        CONFIG["CARTELLA_REPORT"] = str(trovata) if trovata else ""
    if not CONFIG["ANALIZZA_AVVIO"]:
        for base in cartelle_lavoro_ia():
            bat = base / "App" / "Analizza" / "AVVIA.bat"
            if bat.exists():
                CONFIG["ANALIZZA_AVVIO"] = str(bat)
                break


def numero(testo, predefinito):
    try:
        return float(testo) if testo not in (None, "") else predefinito
    except ValueError:
        return predefinito


def controlla_config():
    """Ritorna una lista di problemi (vuota se tutto ok)."""
    problemi = []
    if not CONFIG["SUPABASE_URL"]:
        problemi.append("Manca SUPABASE_URL nel file .env")
    if not CONFIG["SUPABASE_SERVICE_KEY"]:
        problemi.append("Manca SUPABASE_SERVICE_KEY nel file .env")
    if not CONFIG["CARTELLA_REPORT"]:
        problemi.append("Non trovo la cartella dei report: scrivi CARTELLA_REPORT nel file .env")
    return problemi


# ------------------------------------------------------------ Supabase
def intestazioni(extra=None):
    chiave = CONFIG["SUPABASE_SERVICE_KEY"]
    h = {
        "apikey": chiave,
        "Authorization": "Bearer " + chiave,
        "Content-Type": "application/json",
    }
    if extra:
        h.update(extra)
    return h


def chiama_supabase(metodo, percorso, corpo=None, extra=None):
    """Chiamata REST a Supabase. Ritorna il JSON (o None se vuoto). Alza eccezione se fallisce."""
    url = CONFIG["SUPABASE_URL"] + percorso
    dati = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(url, data=dati, method=metodo, headers=intestazioni(extra))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            testo = r.read().decode("utf-8")
            return json.loads(testo) if testo.strip() else None
    except urllib.error.HTTPError as e:
        dettaglio = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("Supabase ha risposto %s: %s" % (e.code, dettaglio))


def manda_battito():
    """Dice a Supabase che il PC e il ponte sono accesi (la pagina del telefono mostra «PC collegato»)."""
    try:
        chiama_supabase("POST", "/rest/v1/rpc/ponte_battito", {})
    except Exception as e:
        log("Battito non inviato (riprovo al prossimo giro): %s" % e)


def battito_continuo(ogni_secondi):
    """
    Manda il battito in un thread a parte, anche mentre un lavoro e' in corso.
    Senza questo, durante un'analisi lunga (fino a 20 minuti) il telefono
    vedrebbe «PC spento» anche col PC acceso.
    """
    def ciclo():
        while True:
            manda_battito()
            time.sleep(ogni_secondi)
    threading.Thread(target=ciclo, name="battito", daemon=True).start()


def prendi_prossima_analisi():
    """Ritorna la riga da lavorare oppure None."""
    righe = chiama_supabase("POST", "/rest/v1/rpc/prendi_prossima_analisi", {})
    if isinstance(righe, list) and righe:
        return righe[0]
    return None


def adesso_iso():
    return datetime.now(timezone.utc).isoformat()


def segna_fatto(id_riga, testo_report):
    chiama_supabase(
        "PATCH", "/rest/v1/coda_analisi?id=eq.%s" % id_riga,
        {"stato": "fatto", "report": testo_report[:MAX_CARATTERI_REPORT],
         "errore": None, "finito_il": adesso_iso()},
        {"Prefer": "return=minimal"})


def segna_errore(id_riga, messaggio):
    chiama_supabase(
        "PATCH", "/rest/v1/coda_analisi?id=eq.%s" % id_riga,
        {"stato": "errore", "errore": messaggio[:2000], "finito_il": adesso_iso()},
        {"Prefer": "return=minimal"})


# ------------------------------------------------------------- Analizza
def analizza_risponde():
    try:
        with urllib.request.urlopen(CONFIG["ANALIZZA_URL"], timeout=5):
            return True
    except urllib.error.HTTPError:
        return True  # il server c'e', anche se la pagina da' un errore
    except Exception:
        return False


def assicura_analizza_acceso():
    """Se Analizza non risponde lo avvia e aspetta fino a 60 secondi."""
    if analizza_risponde():
        return
    avvio = CONFIG["ANALIZZA_AVVIO"]
    if not avvio or not Path(avvio).exists():
        raise RuntimeError("Analizza non risponde e non trovo AVVIA.bat: scrivi ANALIZZA_AVVIO nel file .env")
    log("Analizza spento: lo avvio (%s)" % avvio)
    flag = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    subprocess.Popen(["cmd", "/c", avvio] if os.name == "nt" else [avvio],
                     cwd=str(Path(avvio).parent), creationflags=flag)
    # AVVIA.bat aggiorna yt-dlp prima di partire: puo' metterci qualche minuto
    for _ in range(90):
        time.sleep(2)
        if analizza_risponde():
            log("Analizza e' acceso.")
            return
    raise RuntimeError("Analizza non si e' acceso entro 3 minuti.")


def chiedi_analizza(metodo, percorso, corpo=None, timeout=30):
    """Chiamata all'API locale di Analizza (app.py, FastAPI). Ritorna il JSON."""
    dati = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    req = urllib.request.Request(CONFIG["ANALIZZA_URL"] + percorso, data=dati, method=metodo,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8") or "null")


def avvia_analisi(link):
    """
    Collegato all'app Analizza vera (App\\Analizza\\app.py):
    POST {ANALIZZA_URL}/api/analizza con {"link": ...} -> {"id": "<lavoro>"}.
    Analizza rifa' sempre l'analisi da capo, quindi il «!» di «rifai» non serve e si toglie.
    Ritorna l'id del lavoro.
    """
    pulito = (link or "").strip().rstrip("!")
    try:
        risposta = chiedi_analizza("POST", "/api/analizza", {"link": pulito}, timeout=60)
    except urllib.error.HTTPError as e:
        dettaglio = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("Analizza ha rifiutato il link (%s): %s" % (e.code, dettaglio))
    except Exception as e:
        raise RuntimeError("Non riesco a dare il link ad Analizza: %s" % e)
    id_lavoro = (risposta or {}).get("id")
    if not id_lavoro:
        raise RuntimeError("Analizza non ha restituito l'id del lavoro: %s" % risposta)
    return id_lavoro


def aspetta_lavoro(id_lavoro, link, inizio):
    """
    Chiede ad Analizza lo stato del lavoro ogni 10 secondi.
    Ritorna (cartella_o_file, testo_report). Se Analizza si riavvia e perde il lavoro,
    passa alla ricerca del report nella cartella.
    """
    limite = time.time() + CONFIG["TEMPO_MAX_MINUTI"] * 60
    ultimo_passo = None
    while time.time() < limite:
        try:
            lav = chiedi_analizza("GET", "/api/lavoro/%s" % id_lavoro, timeout=15)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                log("Analizza non conosce piu' il lavoro (si e' riavviato?): cerco il report nella cartella.")
                return aspetta_report(link, inizio, limite)
            lav = None
        except Exception:
            lav = None  # Analizza occupato o un attimo giu': riprovo
        if lav:
            passi = lav.get("log") or []
            if passi and passi[-1] != ultimo_passo:
                ultimo_passo = passi[-1]
                log("Analizza: %s" % ultimo_passo)
            if lav.get("stato") == "fatto":
                testo = lav.get("report") or ""
                if not testo:
                    raise RuntimeError("Analizza ha finito ma il report e' vuoto.")
                return lav.get("cartella") or "?", testo
            if lav.get("stato") == "errore":
                raise RuntimeError("Analizza: %s" % (lav.get("errore") or "errore sconosciuto"))
        time.sleep(10)
    raise RuntimeError("Il report non e' arrivato entro %d minuti." % CONFIG["TEMPO_MAX_MINUTI"])


def avvia_con_comando(link):
    """Modo 1: COMANDO_ANALISI e' un modello con {link}, eseguito senza shell."""
    modello = CONFIG["COMANDO_ANALISI"]
    parti = shlex.split(modello, posix=(os.name != "nt"))
    comando = [p.replace("{link}", link) for p in parti]
    try:
        esito = subprocess.run(comando, capture_output=True, text=True, timeout=120)
    except Exception as e:
        raise RuntimeError("Il comando di analisi non parte: %s" % e)
    if esito.returncode != 0:
        raise RuntimeError("Il comando di analisi e' fallito (codice %s): %s"
                           % (esito.returncode, (esito.stderr or esito.stdout)[:300]))


# -------------------------------------------------------------- report
def estrai_codice_reel(link):
    """Es. https://www.instagram.com/reel/DfP0gIRBcka/?igsh=x  ->  DfP0gIRBcka"""
    link = (link or "").strip().rstrip("!")
    m = re.search(r"/(?:reels?|p|tv|shorts|live)/([A-Za-z0-9_-]{5,})", link)
    if m:
        return m.group(1)
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{5,})", link)
    if m:
        return m.group(1)
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{5,})", link)
    if m:
        return m.group(1)
    m = re.search(r"/video/(\d{6,})", link)  # TikTok
    if m:
        return m.group(1)
    return None


def cerca_report(cartella, link, inizio):
    """
    Cerca in cartella (e sottocartelle) un .md/.txt modificato dopo 'inizio'
    (secondi epoch) che contenga il link o il codice del reel.
    Se ce ne sono vari prende il piu' recente. Ritorna (Path, testo) o None.
    """
    pulito = (link or "").strip().rstrip("!")
    codice = estrai_codice_reel(pulito)
    migliore = None
    migliore_ora = 0
    for f in Path(cartella).rglob("*"):
        try:
            if not f.is_file() or f.suffix.lower() not in (".md", ".txt"):
                continue
            ora = f.stat().st_mtime
            if ora < inizio or ora <= migliore_ora:
                continue
            testo = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        if (pulito and pulito in testo) or (codice and codice in testo):
            migliore, migliore_ora = (f, testo), ora
    return migliore


def aspetta_report(link, inizio, limite=None):
    """Cerca il report nella cartella (usato con COMANDO_ANALISI o se Analizza perde il lavoro)."""
    if limite is None:
        limite = time.time() + CONFIG["TEMPO_MAX_MINUTI"] * 60
    if not CONFIG["CARTELLA_REPORT"]:
        raise RuntimeError("Non trovo la cartella dei report: scrivi CARTELLA_REPORT nel file .env")
    while time.time() < limite:
        trovato = cerca_report(CONFIG["CARTELLA_REPORT"], link, inizio)
        if trovato:
            time.sleep(3)  # lascia finire di scrivere il file
            return cerca_report(CONFIG["CARTELLA_REPORT"], link, inizio) or trovato
        time.sleep(10)
    raise RuntimeError("Il report non e' comparso entro %d minuti." % CONFIG["TEMPO_MAX_MINUTI"])


# --------------------------------------------------------------- video
def cartella_analizza():
    """Cartella dell'app Analizza (quella di AVVIA.bat). Ritorna Path o None."""
    avvio = CONFIG.get("ANALIZZA_AVVIO")
    return Path(avvio).parent if avvio and Path(avvio).exists() else None


def pulisci_nome(testo, n=30):
    t = re.sub(r"[^\w\-]+", "-", testo or "", flags=re.UNICODE).strip("-").lower()
    return t[:n].strip("-")


def scarica_solo_video(id_riga, link):
    """
    Solo il video, senza analisi: usa la stessa funzione di download di Analizza
    (pipeline.scarica: massima qualita', foto riconosciute, sessione del browser per i reel col login).
    Ritorna (Path del video, autore, titolo).
    """
    cart = cartella_analizza()
    python = cart / ".venv" / "Scripts" / "python.exe" if cart else None
    if not python or not python.exists():
        raise RuntimeError("Non trovo Analizza (serve il suo .venv per scaricare): scrivi ANALIZZA_AVVIO nel file .env")
    base_report = Path(CONFIG["CARTELLA_REPORT"]) if CONFIG["CARTELLA_REPORT"] else CARTELLA_SCRIPT
    dest = base_report.parent / "Video" / ("%s_n%s" % (datetime.now().strftime("%Y-%m-%d_%H%M"), id_riga))
    dest.mkdir(parents=True, exist_ok=True)
    codice = (
        "import sys, json\n"
        "from pathlib import Path\n"
        "import pipeline\n"
        "v, i = pipeline.scarica(sys.argv[1], Path(sys.argv[2]), lambda m: print(m, flush=True))\n"
        "print('RISULTATO=' + json.dumps({'video': str(v), 'autore': i.get('uploader') or i.get('channel') or '',"
        " 'titolo': (i.get('title') or '').splitlines()[0] if i.get('title') else ''}))\n"
    )
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        esito = subprocess.run([str(python), "-c", codice, link, str(dest)], cwd=str(cart), env=env,
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Il download ha superato i 10 minuti.")
    risultato = None
    for riga in (esito.stdout or "").splitlines():
        if riga.startswith("RISULTATO="):
            risultato = json.loads(riga[len("RISULTATO="):])
    if esito.returncode != 0 or not risultato:
        errori = [x for x in (esito.stderr or "").splitlines() if "RuntimeError:" in x]
        msg = errori[-1].split("RuntimeError:", 1)[1].strip() if errori else (esito.stderr or "errore sconosciuto").strip()[-300:]
        shutil.rmtree(dest, ignore_errors=True)
        raise RuntimeError(msg)
    scaricato = Path(risultato["video"])
    video = dest / ("video" + scaricato.suffix.lower())
    scaricato.replace(video)
    shutil.rmtree(dest / "_download", ignore_errors=True)
    return video, risultato.get("autore") or "", risultato.get("titolo") or ""


def leggi_video(video):
    """Codec, risoluzione e durata con ffprobe. Ritorna un dict (vuoto se ffprobe non c'e')."""
    try:
        esito = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                                "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", str(video)],
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        j = json.loads(esito.stdout or "{}")
    except Exception:
        return {}
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), {})
    a = next((s for s in j.get("streams", []) if s.get("codec_type") == "audio"), {})
    return {"vcodec": v.get("codec_name") or "", "acodec": a.get("codec_name") or "",
            "larghezza": v.get("width") or 0, "altezza": v.get("height") or 0,
            "durata": round(float(j.get("format", {}).get("duration") or 0), 1)}


def copia_per_iphone(video, dati):
    """
    L'app Foto dell'iPhone non apre VP9/AV1 (i formati in cui Instagram e YouTube danno la qualita' massima).
    Se serve, faccio una copia H.264 alla STESSA risoluzione, qualita' visivamente identica (CRF 18),
    con un tetto di velocita' (bitrate) perche' il file stia sotto i 50 MB dello Storage gratis.
    Il tetto resta comunque piu' alto del bitrate dell'originale per i video brevi.
    Se il video e' gia' H.264 non lo tocco: la copia per iPhone e' l'originale stesso.
    """
    if dati.get("vcodec") == "h264":
        return video
    uscita = video.with_name("video_iphone.mp4")
    audio = ["-c:a", "copy"] if dati.get("acodec") == "aac" else ["-c:a", "aac", "-b:a", "192k"]
    tetto = []
    if dati.get("durata"):
        kbps = int(45 * 8 * 1024 / float(dati["durata"])) - 256  # 45 MB disponibili, meno l'audio
        kbps = max(800, min(kbps, 12000))
        tetto = ["-maxrate", "%dk" % kbps, "-bufsize", "%dk" % (kbps * 2)]
    esito = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-map", "0:v:0", "-map", "0:a:0?",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "18"] + tetto +
                           ["-pix_fmt", "yuv420p", "-profile:v", "high"] + audio +
                           ["-movflags", "+faststart", str(uscita)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=1200)
    if esito.returncode != 0 or not uscita.exists():
        raise RuntimeError("Copia per iPhone non riuscita: %s" % (esito.stderr or "").strip()[-200:])
    return uscita


def carica_su_storage(file, percorso):
    """Carica un file nella cartella privata dello Storage (sovrascrive se c'e' gia')."""
    url = "%s/storage/v1/object/%s/%s" % (CONFIG["SUPABASE_URL"], CARTELLA_VIDEO, percorso)
    tipo = TIPI_VIDEO.get(Path(file).suffix.lower(), "application/octet-stream")
    req = urllib.request.Request(url, data=Path(file).read_bytes(), method="POST",
                                 headers=intestazioni({"Content-Type": tipo, "x-upsert": "true",
                                                       "Cache-Control": "3600"}))
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError("Lo Storage ha risposto %s: %s" % (e.code, e.read().decode("utf-8", "replace")[:200]))


def mb(byte):
    return round(byte / 1024 / 1024, 1)


def prepara_video(id_riga, link, video, autore=""):
    """
    Mette sul telefono il video originale e (se serve) la copia per iPhone.
    Ritorna il dict salvato in video_info. Non alza eccezioni per i file troppo grossi: lo scrive nella nota.
    """
    video = Path(video)
    dati = leggi_video(video)
    radice = "_".join(x for x in (pulisci_nome(autore, 25), estrai_codice_reel(link) or "video") if x)
    estensione = video.suffix.lower() or ".mp4"
    info = {"risoluzione": "%sx%s" % (dati.get("larghezza"), dati.get("altezza")) if dati.get("altezza") else "",
            "codec": dati.get("vcodec", ""), "durata": dati.get("durata", 0),
            "cartella_pc": str(video.parent), "caricato_il": adesso_iso()}
    note = []
    try:
        iphone = copia_per_iphone(video, dati)
    except Exception as e:
        iphone = None
        note.append(str(e))
    stesso = iphone is not None and Path(iphone) == video
    percorso_orig, percorso_iph = None, None
    peso = video.stat().st_size
    info["peso_originale_mb"] = mb(peso)
    if peso <= MAX_BYTE_VIDEO:
        percorso_orig = "%s/originale%s" % (id_riga, estensione)
        carica_su_storage(video, percorso_orig)
        info["nome_originale"] = radice + ("" if stesso else "_originale") + estensione
    else:
        note.append("Originale troppo grande per il telefono (%s MB, massimo 50): lo trovi sul PC." % mb(peso))
    if stesso:
        percorso_iph = percorso_orig
        info["nome_iphone"] = info.get("nome_originale")
    elif iphone:
        peso_i = Path(iphone).stat().st_size
        info["peso_iphone_mb"] = mb(peso_i)
        if peso_i <= MAX_BYTE_VIDEO:
            percorso_iph = "%s/iphone.mp4" % id_riga
            carica_su_storage(iphone, percorso_iph)
            info["nome_iphone"] = radice + "_iphone.mp4"
        else:
            note.append("Copia per iPhone troppo grande (%s MB, massimo 50): la trovi sul PC." % mb(peso_i))
    if note:
        info["nota"] = " ".join(note)
    chiama_supabase("PATCH", "/rest/v1/coda_analisi?id=eq.%s" % id_riga,
                    {"video_originale": percorso_orig, "video_iphone": percorso_iph, "video_info": info},
                    {"Prefer": "return=minimal"})
    log("Video sul telefono: originale %s, iPhone %s%s" % (
        "si'" if percorso_orig else "no", "si'" if percorso_iph else "no",
        (" (%s)" % info["nota"]) if note else ""))
    return info


def pulisci_video_vecchi():
    """Cancella da Supabase i video piu' vecchi di GIORNI_VIDEO giorni (sul PC restano)."""
    limite = datetime.fromtimestamp(time.time() - GIORNI_VIDEO * 86400, timezone.utc).isoformat()
    righe = chiama_supabase(
        "GET", "/rest/v1/coda_analisi?select=id,video_originale,video_iphone,video_info"
               "&or=(video_originale.not.is.null,video_iphone.not.is.null)&finito_il=lt.%s"
        % urllib.parse.quote(limite)) or []
    for r in righe:
        file = sorted({x for x in (r.get("video_originale"), r.get("video_iphone")) if x})
        req = urllib.request.Request("%s/storage/v1/object/%s" % (CONFIG["SUPABASE_URL"], CARTELLA_VIDEO),
                                     data=json.dumps({"prefixes": file}).encode("utf-8"), method="DELETE",
                                     headers=intestazioni())
        with urllib.request.urlopen(req, timeout=60) as risp:
            risp.read()
        info = dict(r.get("video_info") or {})
        info["nota"] = "Video tolto dal telefono dopo %d giorni: lo trovi ancora sul PC." % GIORNI_VIDEO
        chiama_supabase("PATCH", "/rest/v1/coda_analisi?id=eq.%s" % r["id"],
                        {"video_originale": None, "video_iphone": None, "video_info": info},
                        {"Prefer": "return=minimal"})
        log("Pulizia: tolto dal telefono il video del lavoro #%s (piu' vecchio di %d giorni)." % (r["id"], GIORNI_VIDEO))


def autore_dal_report(testo):
    m = re.search(r"^- Autore: (.+)$", testo or "", flags=re.MULTILINE)
    return m.group(1).strip() if m and m.group(1).strip() != "—" else ""


# --------------------------------------------------------------- lavoro
def esegui_lavoro(riga):
    id_riga = riga.get("id")
    link = (riga.get("link") or "").strip().rstrip("!")
    rifai = bool(riga.get("rifai"))
    solo_video = bool(riga.get("solo_video"))
    log("Lavoro #%s: %s%s" % (id_riga, link, " (solo video)" if solo_video else (" (da rifare)" if rifai else "")))
    if not link:
        segna_errore(id_riga, "La riga non ha nessun link.")
        return
    inizio = time.time() - 2
    link_da_dare = link + "!" if rifai else link
    try:
        if solo_video:
            video, autore, titolo = scarica_solo_video(id_riga, link)
            info = prepara_video(id_riga, link, video, autore)
            if not info.get("nome_originale") and not info.get("nome_iphone"):
                raise RuntimeError(info.get("nota") or "Il video non e' arrivato sul telefono.")
            testo = "\n".join([
                "# SOLO VIDEO (nessuna analisi)", "",
                "- Link: %s" % link, "- Autore: %s" % (autore or "—"), "- Titolo: %s" % (titolo or "—"),
                "- Risoluzione: %s · %s · %s s" % (info.get("risoluzione") or "?", (info.get("codec") or "?").upper(),
                                                   info.get("durata") or "?"),
                "- Sul PC: %s" % video])
            segna_fatto(id_riga, testo)
            log("Lavoro #%s finito (solo video)." % id_riga)
            return
        if CONFIG["COMANDO_ANALISI"]:
            avvia_con_comando(link_da_dare)
            log("Analisi avviata, aspetto il report (max %d minuti)..." % CONFIG["TEMPO_MAX_MINUTI"])
            file_report, testo = aspetta_report(link, inizio)
        else:
            assicura_analizza_acceso()
            id_lavoro = avvia_analisi(link_da_dare)
            log("Analisi avviata (lavoro %s), aspetto il report (max %d minuti)..."
                % (id_lavoro, CONFIG["TEMPO_MAX_MINUTI"]))
            file_report, testo = aspetta_lavoro(id_lavoro, link, inizio)
        log("Report trovato: %s" % file_report)
        # Prima il video, poi «fatto»: cosi' quando il telefono apre il report il video c'e' gia'.
        # Il video e' un di piu': se non riesce, il report resta buono.
        cartella = Path(str(file_report))
        if cartella.is_file():
            cartella = cartella.parent
        video = cartella / "video.mp4"
        if video.exists():
            try:
                prepara_video(id_riga, link, video, autore_dal_report(testo))
            except Exception as e:
                log("Video non messo sul telefono (il report c'e'): %s" % e)
                try:
                    chiama_supabase("PATCH", "/rest/v1/coda_analisi?id=eq.%s" % id_riga,
                                    {"video_info": {"nota": "Video non arrivato sul telefono: %s" % str(e)[:300]}},
                                    {"Prefer": "return=minimal"})
                except Exception:
                    pass
        segna_fatto(id_riga, testo)
        log("Lavoro #%s finito." % id_riga)
    except Exception as e:
        messaggio = str(e)
        log("Errore nel lavoro #%s: %s" % (id_riga, messaggio))
        try:
            segna_errore(id_riga, messaggio)
        except Exception as e2:
            log("Non riesco nemmeno a scrivere l'errore su Supabase: %s" % e2)


STATO = {"in_attesa_scritto": False, "ultima_pulizia": 0}


def un_giro(con_battito=True):
    """Un controllo della coda. Gli errori di rete non fanno crashare."""
    if con_battito:
        manda_battito()
    if time.time() - STATO["ultima_pulizia"] > PULIZIA_OGNI_SECONDI:
        STATO["ultima_pulizia"] = time.time()
        try:
            pulisci_video_vecchi()
        except Exception as e:
            log("Pulizia dei video vecchi non riuscita (riprovo tra un'ora): %s" % e)
    try:
        riga = prendi_prossima_analisi()
    except Exception as e:
        log("Non riesco a parlare con Supabase (riprovo al prossimo giro): %s" % e)
        STATO["in_attesa_scritto"] = False
        return
    if riga:
        STATO["in_attesa_scritto"] = False
        esegui_lavoro(riga)
    elif not STATO["in_attesa_scritto"]:
        # lo scrivo una volta sola, non ogni 30 secondi (il registro resterebbe piccolo)
        log("Niente da fare. Resto in ascolto.")
        STATO["in_attesa_scritto"] = True


def prova():
    log("PROVA: controllo i collegamenti (la coda non viene toccata).")
    problemi = controlla_config()
    for p in problemi:
        log("PROBLEMA: " + p)
    if not CONFIG["SUPABASE_URL"] or not CONFIG["SUPABASE_SERVICE_KEY"]:
        return 1
    ok = True
    try:
        chiama_supabase("GET", "/rest/v1/coda_analisi?select=id&limit=1")
        log("Supabase: OK, vedo la tabella coda_analisi.")
    except Exception as e:
        ok = False
        log("Supabase: ERRORE - %s" % e)
    if analizza_risponde():
        log("Analizza: OK, risponde su %s" % CONFIG["ANALIZZA_URL"])
    else:
        log("Analizza: non risponde su %s (il ponte lo avviera' da solo se trova AVVIA.bat)" % CONFIG["ANALIZZA_URL"])
    log("Avvio di Analizza: %s" % (CONFIG["ANALIZZA_AVVIO"] or "NON TROVATO"))
    cart = CONFIG["CARTELLA_REPORT"]
    if cart and Path(cart).is_dir():
        log("Cartella report: OK (%s)" % cart)
    else:
        ok = False
        log("Cartella report: NON TROVATA (%s)" % (cart or "vuota"))
    return 0 if (ok and not problemi) else 1


def main():
    carica_config()
    args = sys.argv[1:]
    if "--prova" in args:
        sys.exit(prova())
    problemi = controlla_config()
    if problemi:
        for p in problemi:
            log("PROBLEMA: " + p)
        log("Copia .env.esempio in .env e compilalo. Poi riprova.")
        sys.exit(1)
    log("Ponte Analizza acceso. Controllo la coda ogni %d secondi." % CONFIG["ATTESA_SECONDI"])
    if "--una-volta" in args:
        un_giro()
        return
    battito_continuo(CONFIG["ATTESA_SECONDI"])
    try:
        while True:
            try:
                un_giro(con_battito=False)  # il battito lo manda gia' il thread
            except KeyboardInterrupt:
                raise
            except Exception as e:  # qualsiasi imprevisto: lo scrivo e vado avanti, il ponte non si ferma
                log("Imprevisto (continuo lo stesso): %r" % e)
            time.sleep(CONFIG["ATTESA_SECONDI"])
    except KeyboardInterrupt:
        log("Ponte fermato.")


if __name__ == "__main__":
    main()
