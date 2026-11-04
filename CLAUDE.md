# Regole per Claude in questo progetto

- Lingua: italiano semplice.
- Errori: quando uno strumento fallisce (simbolo di attenzione), segui la skill `ripara-errori`: trova la causa, correggi subito, riprova una volta con la correzione, massimo 3 tentativi, e scrivi in una riga cosa è successo. Un hook (`.claude/hooks/ripara-errore.py`) lo ricorda in automatico a ogni errore.
