# -*- coding: utf-8 -*-
"""
Prova di fattibilita' (Fase 1): scarica e trascrive 3 video pubblici su GitHub Actions.
IL REPO E I LOG SONO PUBBLICI: qui si stampano SOLO esito, tempi e pesi.
Mai titoli, trascrizioni o report.
"""
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

import subprocess
import json

YT = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
PROVE = [
    ("youtube (normale)", YT, []),
    ("instagram", "https://www.instagram.com/reel/Dd1gQBsCWE8/", []),
    ("tiktok", "https://www.tiktok.com/@nasa/video/7676868860749827342", []),
    ("tiktok parlato", "https://www.tiktok.com/@neildegrassetyson/video/7482856405934918955", []),
    ("instagram (2a volta)", "https://www.instagram.com/reel/Dd1gQBsCWE8/", []),
    ("instagram (3a volta)", "https://www.instagram.com/reel/Dd1gQBsCWE8/", []),
]


def pulisci_errore(t):
    righe = [r for r in (t or "").splitlines() if "ERROR" in r] or (t or "").splitlines()[-1:]
    return (righe[-1] if righe else "errore sconosciuto")[:300]


def scarica(link, cartella, extra=()):
    """yt-dlp da riga di comando, processo separato. Niente stampa di titoli."""
    comando = ["yt-dlp", "-q", "--no-warnings", "--no-progress", "--no-playlist",
               "-f", "bestaudio/best", "-x", "--audio-format", "wav",
               "--postprocessor-args", "ExtractAudio:-ar 16000 -ac 1",
               "--write-info-json", "-o", str(cartella / "media.%(ext)s")] + list(extra) + [link]
    esito = subprocess.run(comando, capture_output=True, text=True, timeout=600)
    if esito.returncode != 0:
        raise RuntimeError(pulisci_errore(esito.stderr))
    info = json.loads(next(cartella.glob("*.info.json")).read_text(encoding="utf-8"))
    return cartella / "media.wav", float(info.get("duration") or 0)


def leggi_wav(wav):
    """wav 16 kHz mono -> array float32, senza PyAV (la versione nuova rompe faster-whisper)."""
    import wave
    import numpy as np
    with wave.open(str(wav), "rb") as w:
        dati = w.readframes(w.getnframes())
    return np.frombuffer(dati, dtype=np.int16).astype(np.float32) / 32768.0


def main():
    from faster_whisper import WhisperModel
    t0 = time.time()
    modello = WhisperModel("small", device="cpu", compute_type="int8")
    print("Modello small caricato in %.0f s" % (time.time() - t0), flush=True)
    esiti = []
    for nome, link, extra in PROVE:
        cartella = Path(tempfile.mkdtemp())
        inizio = time.time()
        try:
            audio, durata = scarica(link, cartella, extra)
            t_scarica = time.time() - inizio
            peso = audio.stat().st_size / 1024 / 1024
            t1 = time.time()
            segmenti, _ = modello.transcribe(leggi_wav(audio), vad_filter=True)
            caratteri = sum(len(s.text) for s in segmenti)  # il testo NON si stampa
            t_trascrivi = time.time() - t1
            riga = "%s: PASSA | durata video %.0f s | audio %.1f MB | download %.0f s | trascrizione %.0f s | %d caratteri" % (
                nome, durata, peso, t_scarica, t_trascrivi, caratteri)
            esiti.append(True)
        except Exception as e:
            riga = "%s: BLOCCATO dopo %.0f s | %s" % (nome, time.time() - inizio, str(e)[:300])
            esiti.append(False)
        finally:
            shutil.rmtree(cartella, ignore_errors=True)
        print(riga, flush=True)
    print("Totale %.0f s" % (time.time() - t0))
    sys.exit(0)


if __name__ == "__main__":
    main()
