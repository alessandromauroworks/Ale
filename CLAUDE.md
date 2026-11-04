# Regole per Claude in questo progetto

- Lingua: italiano semplice.
- Errori: quando uno strumento fallisce (simbolo di attenzione), segui la skill `ripara-errori`: trova la causa, correggi subito, riprova una volta con la correzione, massimo 3 tentativi, e scrivi in una riga cosa è successo. Un hook (`.claude/hooks/ripara-errore.py`) lo ricorda in automatico a ogni errore.
- Legge, fisco, privacy e sicurezza: prima di preparare messaggi a clienti, telefonate, siti, gestionali, contenuti con IA, ricevute o pagamenti segui la skill `ufficio-legale` (registro delle regole nel pannello, collection `legale`).
- Modelli (obbligatorio): il modello principale coordina e basta; ogni pezzo di lavoro va all'aiutante giusto in `.claude/agents/`:
  - `lettore` (Haiku): leggere file, siti e documenti, cercare nel codice, controlli e riassunti;
  - `scrittore` (Sonnet): testi, messaggi ai clienti, contenuti, decisioni normali, codice semplice o medio;
  - `architetto` (Opus): solo progetti grandi, bug difficili, decisioni importanti.
  Nel dubbio scegli il più economico che basta. Il modello principale fa da solo solo le cose minime (un comando, una risposta breve). Alla fine di un lavoro scrivi in una riga quali aiutanti hai usato.
- Link, video, audio e social (YouTube, Instagram, TikTok, vocali): segui sempre la skill `analizza-video` e usa l'app **Analizza** di Alessandro (sul PC in `Desktop\Lavoro IA\App\Analizza`, http://localhost:8765, report in `Lavoro IA\Analisi\Reel`) per scaricare, trascrivere e vedere il video. Se il PC non è collegato alla sessione: niente trascrizioni a crediti (Horacle) da sole, chiedi ad Alessandro di incollare il link in Analizza dal telefono e mandare il report `# REPORT ANALIZZA REEL`.
- Risparmio: letture mirate invece di intere, niente lavori ripetuti. Per la sessione si consiglia `/model opusplan` (Opus per pianificare, Sonnet per eseguire).
