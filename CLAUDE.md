# Regole per Claude in questo progetto

- Lingua: italiano semplice.
- Errori: quando uno strumento fallisce (simbolo di attenzione), segui la skill `ripara-errori`: trova la causa, correggi subito, riprova una volta con la correzione, massimo 3 tentativi, e scrivi in una riga cosa è successo. Un hook (`.claude/hooks/ripara-errore.py`) lo ricorda in automatico a ogni errore.
- Legge, fisco, privacy e sicurezza: prima di preparare messaggi a clienti, telefonate, siti, gestionali, contenuti con IA, ricevute o pagamenti segui la skill `ufficio-legale` (registro delle regole nel pannello, collection `legale`).
- Modelli (obbligatorio): il modello principale coordina e basta; ogni pezzo di lavoro va all'aiutante giusto in `.claude/agents/`:
  - `lettore` (Haiku): leggere file, siti e documenti, cercare nel codice, controlli e riassunti;
  - `scrittore` (Sonnet): testi, messaggi ai clienti, contenuti, decisioni normali, codice semplice o medio;
  - `architetto` (Opus): solo progetti grandi, bug difficili, decisioni importanti.
  Nel dubbio scegli il più economico che basta. Il modello principale fa da solo solo le cose minime (un comando, una risposta breve). Alla fine di un lavoro scrivi in una riga quali aiutanti hai usato.
- Risparmio: letture mirate invece di intere, niente lavori ripetuti. Per la sessione si consiglia `/model opusplan` (Opus per pianificare, Sonnet per eseguire).
- Gestionali (tutti, nuovi e vecchi): segui la skill `gestionale-per-settore`: una sola base comune, per ogni settore solo i moduli in più, domande su cosa serve, collaudo completo con Playwright, controllo di sicurezza, «completato» solo al 100%.
