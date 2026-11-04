---
name: ripara-errori
description: Regola fissa di Alessandro per ogni errore di uno strumento (il simbolo di attenzione in Claude Code): trovare la causa, correggere subito, riprovare una volta con la correzione, e dire in una riga cosa è successo. Usa ogni volta che una chiamata fallisce.
---

# Ripara errori

Un errore non si lascia mai indietro: Alessandro va avanti a lavorare e un problema rimasto aperto crea guai dopo.

## Quando una chiamata fallisce
1. **Leggi l'errore** e trova la causa vera:
   - parametro o formato sbagliato → correggi i dati;
   - strumento non caricato («InputValidationError») → caricalo con ToolSearch e riprova;
   - «not found» / permesso negato → verifica con una lettura (get, list) se la cosa esiste e se questa sessione può toccarla;
   - rete o limite → aspetta e riprova una volta.
2. **Correggi e riprova una sola volta**, mai la stessa chiamata identica.
3. **Se è bloccato per davvero** (risorsa di un'altra conversazione, attività legata al PC, permesso dell'utente): prova una strada alternativa sicura; se non c'è, fermati.
4. **Massimo 3 tentativi per lo stesso strumento**, poi basta: niente giri infiniti.
5. **Nel messaggio finale** una riga: quale errore c'era e come è stato risolto, oppure perché non si può e il passo esatto per Alessandro.

## Mai
- Fingere che sia andato tutto bene.
- Ripetere la stessa chiamata sperando che passi.
- Aggirare un permesso negato o un blocco di sicurezza.
