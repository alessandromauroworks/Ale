# Regole per Claude in questo progetto

- Lingua: italiano semplice.
- Errori: quando uno strumento fallisce (simbolo di attenzione), segui la skill `ripara-errori`: trova la causa, correggi subito, riprova una volta con la correzione, massimo 3 tentativi, e scrivi in una riga cosa è successo. Un hook (`.claude/hooks/ripara-errore.py`) lo ricorda in automatico a ogni errore.
- Legge, fisco, privacy e sicurezza: prima di preparare messaggi a clienti, telefonate, siti, gestionali, contenuti con IA, ricevute o pagamenti segui la skill `ufficio-legale` (registro delle regole nel pannello, collection `legale`).
- Risparmio: modello più economico che basta (Haiku per letture e controlli, Sonnet per testi e decisioni, Opus solo se serve davvero), letture mirate invece di intere, niente lavori ripetuti.
