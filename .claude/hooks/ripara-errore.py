#!/usr/bin/env python3
"""Hook PostToolUseFailure: quando uno strumento fallisce (il simbolo di attenzione),
obbliga Claude a capire la causa e correggere subito, prima di andare avanti.
Conta gli errori per sessione: dopo 3 errori sullo stesso strumento si ferma
e chiede di spiegare il blocco ad Alessandro, così non entra in un giro infinito."""
import json, os, sys, tempfile

try:
    dati = json.load(sys.stdin)
except Exception:
    dati = {}

strumento = dati.get("tool_name") or "strumento"
sessione = dati.get("session_id") or "sessione"
errore = str(dati.get("error") or dati.get("tool_response") or "")[:400]

cartella = os.path.join(tempfile.gettempdir(), "claude-ripara-errori")
os.makedirs(cartella, exist_ok=True)
file_conto = os.path.join(cartella, f"{sessione}.json")
try:
    conti = json.load(open(file_conto))
except Exception:
    conti = {}
conti[strumento] = conti.get(strumento, 0) + 1
try:
    json.dump(conti, open(file_conto, "w"))
except Exception:
    pass
n = conti[strumento]

if n <= 3:
    testo = (
        f"ERRORE {n}/3 su «{strumento}». Regola di Alessandro: un errore non si lascia indietro. "
        "Prima di qualsiasi altro passo: 1) leggi il messaggio d'errore e trova la causa vera "
        "(parametro sbagliato, permesso, risorsa non trovata, schema non caricato, rete); "
        "2) correggi e riprova UNA volta con la correzione, mai la stessa chiamata identica; "
        "3) se la strada è bloccata per davvero (permesso negato, risorsa di un'altra sessione), "
        "prova una strada alternativa sicura. Nel messaggio finale scrivi in una riga quale errore "
        "c'era e come l'hai risolto, oppure perché non si può risolvere e cosa deve fare Alessandro."
    )
else:
    testo = (
        f"«{strumento}» ha fallito {n} volte in questa sessione: smetti di riprovare. "
        "Scrivi ad Alessandro, in italiano semplice, cosa è bloccato, la causa più probabile "
        "e il passo esatto che serve da lui."
    )

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUseFailure",
        "additionalContext": testo + (f" Errore: {errore}" if errore else ""),
    }
}, ensure_ascii=False))
