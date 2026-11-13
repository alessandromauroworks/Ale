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

import yt_dlp

PROVE = [
    ("youtube", "https://www.youtube.com/watch?v=jNQXAC9IVRw"),
    ("instagram", "https://www.instagram.com/reel/Dd1gQBsCWE8/"),
    ("tiktok", "https://www.tiktok.com/@nasa/video/7676868860749827342"),
]


class Zitto:
    """Logger di yt-dlp che non stampa nulla (i messaggi possono contenere titoli)."""
    def debug(self, m): pass
    def info(self, m): pass
    def warning(self, m): pass
    def error(self, m): pass


def pulisci_errore(e):
    t = str(e).replace("\n", " ")
    return t[:300]


def scarica(link, cartella):
    opzioni = {
        "format": "bestaudio/best",
        "outtmpl": str(cartella / "media.%(ext)s"),
        "quiet": True, "no_warnings": True, "noprogress": True,
        "logger": Zitto(), "noplaylist": True,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        "postprocessor_args": ["-ar", "16000", "-ac", "1"],
    }
    with yt_dlp.YoutubeDL(opzioni) as ydl:
        info = ydl.extract_info(link, download=True)
    file = next(cartella.glob("media.wav"))
    return file, float(info.get("duration") or 0)


def main():
    from faster_whisper import WhisperModel
    t0 = time.time()
    modello = WhisperModel("small", device="cpu", compute_type="int8")
    print("Modello small caricato in %.0f s" % (time.time() - t0), flush=True)
    esiti = []
    for nome, link in PROVE:
        cartella = Path(tempfile.mkdtemp())
        inizio = time.time()
        try:
            audio, durata = scarica(link, cartella)
            t_scarica = time.time() - inizio
            peso = audio.stat().st_size / 1024 / 1024
            t1 = time.time()
            segmenti, _ = modello.transcribe(str(audio), language="it", vad_filter=True)
            caratteri = sum(len(s.text) for s in segmenti)  # il testo NON si stampa
            t_trascrivi = time.time() - t1
            riga = "%s: PASSA | durata video %.0f s | audio %.1f MB | download %.0f s | trascrizione %.0f s | %d caratteri" % (
                nome, durata, peso, t_scarica, t_trascrivi, caratteri)
            esiti.append(True)
        except Exception as e:
            riga = "%s: BLOCCATO dopo %.0f s | %s" % (nome, time.time() - inizio, pulisci_errore(e))
            esiti.append(False)
        finally:
            shutil.rmtree(cartella, ignore_errors=True)
        print(riga, flush=True)
    print("Totale %.0f s" % (time.time() - t0))
    sys.exit(0)


if __name__ == "__main__":
    main()
