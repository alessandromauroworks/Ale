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
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CARTELLA_SCRIPT = Path(__file__).resolve().parent
FILE_ENV = CARTELLA_SCRIPT / ".env"
FILE_LOG = CARTELLA_SCRIPT / "ponte.log"
MAX_CARATTERI_REPORT = 200000

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


def trova_cartella_report():
    """Prova Desktop e OneDrive\\Desktop. Ritorna un Path o None."""
    casa = Path.home()
    base_possibili = [casa / "Desktop", casa / "OneDrive" / "Desktop"]
    for var in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        if os.environ.get(var):
            base_possibili.append(Path(os.environ[var]) / "Desktop")
    for base in base_possibili:
        candidata = base / "Lavoro IA" / "Analisi" / "Reel"
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
        for base in (Path.home() / "Desktop", Path.home() / "OneDrive" / "Desktop"):
            bat = base / "Lavoro IA" / "App" / "Analizza" / "AVVIA.bat"
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
    for _ in range(30):
        time.sleep(2)
        if analizza_risponde():
            log("Analizza e' acceso.")
            return
    raise RuntimeError("Analizza non si e' acceso entro 60 secondi.")


def avvia_analisi(link):
    """
    DA ADATTARE: questo pezzo va collegato all'app Analizza vera.
    Ora prova un POST JSON {"link": link} su {ANALIZZA_URL}/api/analizza.
    Se l'API di Analizza e' diversa, cambia qui (indirizzo, nome dei campi)
    oppure usa COMANDO_ANALISI nel file .env.
    """
    url = CONFIG["ANALIZZA_URL"] + "/api/analizza"
    req = urllib.request.Request(
        url, data=json.dumps({"link": link}).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60):
            return
    except Exception as e:
        raise RuntimeError(
            "Non riesco a dare il link ad Analizza (%s). La funzione avvia_analisi "
            "va adattata all'API vera di Analizza." % e)


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


def aspetta_report(link, inizio):
    limite = time.time() + CONFIG["TEMPO_MAX_MINUTI"] * 60
    while time.time() < limite:
        trovato = cerca_report(CONFIG["CARTELLA_REPORT"], link, inizio)
        if trovato:
            time.sleep(3)  # lascia finire di scrivere il file
            return cerca_report(CONFIG["CARTELLA_REPORT"], link, inizio) or trovato
        time.sleep(10)
    raise RuntimeError("Il report non e' comparso entro %d minuti." % CONFIG["TEMPO_MAX_MINUTI"])


# --------------------------------------------------------------- lavoro
def esegui_lavoro(riga):
    id_riga = riga.get("id")
    link = (riga.get("link") or "").strip().rstrip("!")
    rifai = bool(riga.get("rifai"))
    log("Lavoro #%s: %s%s" % (id_riga, link, " (da rifare)" if rifai else ""))
    if not link:
        segna_errore(id_riga, "La riga non ha nessun link.")
        return
    inizio = time.time() - 2
    link_da_dare = link + "!" if rifai else link
    try:
        assicura_analizza_acceso()
        if CONFIG["COMANDO_ANALISI"]:
            avvia_con_comando(link_da_dare)
        else:
            avvia_analisi(link_da_dare)
        log("Analisi avviata, aspetto il report (max %d minuti)..." % CONFIG["TEMPO_MAX_MINUTI"])
        file_report, testo = aspetta_report(link, inizio)
        log("Report trovato: %s" % file_report)
        segna_fatto(id_riga, testo)
        log("Lavoro #%s finito." % id_riga)
    except Exception as e:
        messaggio = str(e)
        log("Errore nel lavoro #%s: %s" % (id_riga, messaggio))
        try:
            segna_errore(id_riga, messaggio)
        except Exception as e2:
            log("Non riesco nemmeno a scrivere l'errore su Supabase: %s" % e2)


def un_giro():
    """Un controllo della coda. Gli errori di rete non fanno crashare."""
    manda_battito()
    try:
        riga = prendi_prossima_analisi()
    except Exception as e:
        log("Non riesco a parlare con Supabase (riprovo al prossimo giro): %s" % e)
        return
    if riga:
        esegui_lavoro(riga)
    else:
        log("Niente da fare.")


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
    try:
        while True:
            un_giro()
            time.sleep(CONFIG["ATTESA_SECONDI"])
    except KeyboardInterrupt:
        log("Ponte fermato.")


if __name__ == "__main__":
    main()
