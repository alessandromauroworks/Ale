---
name: gestionale-per-settore
description: Regola fissa di Alessandro per OGNI gestionale, nuovo o vecchio - una sola base comune, poi per il tipo di attività solo i moduli in più (magazzino, clienti, preventivi, agenda...), con domande automatiche su cosa serve, collaudo completo, controllo di sicurezza e consegna solo al 100% funzionante.
---

# Gestionale per settore

## 1. Una sola base
Archivio unico: cartella `gestionali/` del repository Ale (vedi `gestionali/README.md`). Ogni gestionale parte dalla base comune (struttura del gestionale del Patronato di Carapelle, stile Apple, tasti Liquid Glass / normale e chiaro / scuro in alto a destra). Struttura dei file:
- `base/base.css`, `base/base.js`: layout, navigazione, tasti, salvataggio, componenti (tabelle, schede, agenda, pipeline a colonne, modali, statistiche, ricerca, esporta CSV);
- `settori/<settore>.js`: solo ciò che è del settore (sezioni, campi, stati, moduli in più, dati demo inventati);
- la pagina del gestionale carica base + settore. La base non si copia mai dentro un settore: se serve una funzione nuova utile a tutti, va nella base.

## 2. Domande prima di costruire (rispondi da solo, con prove dal settore)
1. Come lavora davvero questa attività in una giornata? Cosa scrive oggi su carta, Excel o WhatsApp?
2. Quali sono i 3 momenti in cui perde tempo o soldi?
3. Quali moduli in più servono? Esempi: magazzino con scorte minime, schede clienti con storico, preventivi e ordini, agenda e turni, incassi e acconti, scadenze, documenti, fornitori, listino, fidelizzazione.
4. Quali campi sono obbligatori per legge nel settore (es. classe energetica negli annunci immobiliari)? Controlla il registro legale (skill `ufficio-legale`, collection `legale`).
5. Ci sono dati sensibili (salute, minori, documenti d'identità, dati bancari)? Se sì: solo il minimo e misure in più (punto 4).
Scrivi le risposte in 5-10 righe nel README del settore prima di scrivere codice.

## 3. Collaudo (obbligatorio, prima di dire «finito»)
Con Playwright (già installato: `require('playwright')`, `chromium.launch()`), a 390x844 e 1440x900:
- apri ogni sezione e ogni modulo; premi ogni pulsante; compila ogni modulo con dati validi e non validi;
- crea, modifica ed elimina un elemento in ogni sezione e controlla che resti salvato dopo il ricaricamento;
- prova i due tasti (Liquid Glass e chiaro/scuro) e che la scelta resti dopo il ricaricamento;
- nessun errore in console, nessuno scroll orizzontale, testi leggibili in chiaro e scuro;
- salva gli screenshot. Correggi e ripeti finché passa tutto. Se qualcosa non si può collaudare, scrivilo.

## 4. Sicurezza (obbligatoria)
- Ogni testo inserito dall'utente si mostra con `textContent` o con escape: mai `innerHTML` con dati dell'utente (niente XSS).
- Niente `eval`, niente `new Function`, niente script da fonti non fissate: librerie solo da CDN con versione esatta (meglio con `integrity`).
- Meta `Content-Security-Policy` restrittiva e `referrer` `no-referrer` nelle pagine.
- Demo: solo dati inventati, banner «Progetto dimostrativo · dati inventati», mai dati reali di clienti o pazienti.
- Versione vera per un cliente (con Supabase): login obbligatorio, RLS attiva su ogni tabella con policy per utente/ruolo, chiavi segrete mai nel codice del browser (solo chiave pubblica «anon» o «publishable»), backup, server in UE, accordo art. 28 con il cliente; controllo con `get_advisors` di Supabase senza avvisi gravi.
- Prima della consegna di una versione vera: skill `attacco-di-prova` e `collaudo-gestionale` se disponibili.

## 5. Consegna
«Completato» solo quando punti 2, 3 e 4 sono tutti fatti. Nel messaggio finale: cosa c'è, esito del collaudo (cosa provato, errori trovati e corretti), controlli di sicurezza fatti, limiti rimasti.

## 6. Gestionali vecchi
Ogni gestionale vecchio (artifact o demo di ottobre) si porta sulla base: si ricavano i suoi moduli utili, si scrive `settori/<settore>.js`, si collauda e si mette in sicurezza come sopra. I dati reali presenti nei vecchi non si copiano mai.
