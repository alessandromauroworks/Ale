---
name: gestionale-universale
description: Regola unica di Alessandro per OGNI gestionale, nuovo o vecchio, demo per il sito vetrina o versione vera per un cliente, di qualsiasi settore (privati, imprenditori, aziende piccole, medie e grandi; enti pubblici esclusi). Una base comune (CRM, CSV, dashboard, agenda, ricerca, notifiche, registro modifiche, documenti, telefono), sezioni su misura del mestiere, domande prima di costruire, stile di Alessandro, sicurezza per dati sensibili, moduli opzionali, collaudo completo e consegna solo al 100%.
---

# Gestionale universale su misura

## 1. Quando si usa
Ogni volta che si crea, si porta sulla base o si modifica un gestionale: demo per il sito vetrina o versione vera per un cliente, in qualsiasi settore. Enti pubblici esclusi, per ora. Questa è l'unica skill sui gestionali.

Principio: la base è sempre la stessa. Sopra si costruiscono sezioni e workflow del mestiere del cliente. Un nutrizionista, un commercialista, un dentista e un parrucchiere con magazzino hanno problemi diversi e sezioni diverse.

## 2. Demo o versione vera
Due prodotti diversi. Ogni voce di base e sicurezza vale in uno, nell'altro o in entrambi.

| Voce | Demo (sito vetrina) | Versione vera (cliente) |
|---|---|---|
| CRM, schede, storico, appuntamenti | sì | sì |
| CSV (importa/esporta), dashboard, ricerca globale | sì | sì |
| Bilancio e storico del mese | sì (mesi di esempio) | sì |
| Agenda, notifiche e scadenze | sì | sì |
| Registro delle modifiche, documenti per cliente | sì | sì |
| Uso da telefono, stile, Liquid Glass, giorno/notte | sì | sì |
| Dati di esempio realistici + banner «Progetto dimostrativo · dati inventati» | sì | no |
| Login, due fattori, account personali | no | sì |
| Ruoli e permessi | solo mostrati | sì |
| Registro accessi 24 mesi, anche in lettura | no | sì |
| Backup con ripristino provato, cifratura, RLS | no | sì |
| Diritti GDPR, proprietà e uscita, art. 28 | no | sì |
| Prova finale da telefono senza account né app | sì | sì (con login) |

## 3. Dove stanno i dati
- **Demo**: mai un progetto Supabase gratuito per ogni demo. Il piano gratuito mette in pausa un progetto dopo 1 settimana senza attività e permette al massimo 2 progetti gratuiti attivi; non ha backup giornalieri (fonte: supabase.com/pricing, controllato il 18/11/2026: ricontrollare se passano più di 6 mesi). Due strade: dati nel browser (`localStorage`), oppure un unico progetto Supabase per tutte le demo, tenuto sveglio, in sola lettura per i visitatori, che si azzera da solo.
- **Stato attuale**: la base comune esiste in `gestionali/base/` (`base.css`, `base.js`), ricavata dal Patronato di Carapelle; primo settore `gestionali/settori/patronato.js` (pagina `gestionali/patronato.html`). Le demo salvano in `localStorage` del browser, con «Ripristina dati demo»: i nuovi settori si allineano a questo metodo.
- **Pubblicazione**: le demo vanno su GitHub Pages con la skill `pubblica-demo-github`. Il link pubblico si apre davvero prima di dire «pronto». Mai `localhost`.
- **Versione vera**: un progetto Supabase separato per ogni cliente, server in UE (es. Francoforte), mai condiviso tra clienti. Le automazioni del cliente stanno nello stesso progetto (vedi CLAUDE.md).

## 4. Struttura dei file
Archivio: cartella `gestionali/` (vedi `gestionali/README.md`).
- `base/base.css`, `base/base.js`: layout, navigazione, tasti, salvataggio, componenti (tabelle, schede, agenda, pipeline a colonne, modali, statistiche, ricerca, esporta CSV).
- `settori/<settore>.js`: solo ciò che è del settore (sezioni, campi, stati, moduli in più, dati demo inventati).
- La pagina del gestionale carica base + settore. La base non si copia mai dentro un settore: una funzione utile a tutti va nella base.

## 5. Domande prima di costruire
Rispondi da solo, con prove dal settore:
1. Come lavora davvero l'attività in una giornata? Cosa scrive oggi su carta, Excel o WhatsApp?
2. Quali sono i 3 momenti in cui perde tempo o soldi?
3. Quali moduli in più servono? (magazzino con scorte minime, storico clienti, preventivi e ordini, turni, incassi e acconti, scadenze, fornitori, listino, fidelizzazione)
4. Quali campi sono obbligatori per legge nel settore? Controlla `ufficio-legale` (collection `legale`).
5. Ci sono dati sensibili (salute, minori, documenti d'identità, dati bancari)? Se sì: solo il minimo e le misure del punto 8.

Scrivi le risposte in 5-10 righe nel README del settore prima di scrivere codice.

## 6. Stile
- È quello di Alessandro, non l'Apple generico: moderno, pulito, minimalista, essenziale, professionale, ispirazione iOS 27. Skill collegate: `liquid-glass-apple` e `movimento-interfacce` per il concreto; `stile-apple-base` solo come base tecnica, lo stile resta quello di Alessandro.
- Mai futuristico fatto male, mai effetti finti da IA, mai decorazioni inutili.
- Animazioni soft e giuste su clic, schede, finestre, filtri, grafici, cambi pagina. Rispettano `prefers-reduced-motion`.
- «Chiaro» significa comprensibile, non il colore.
- Impostazioni: giorno/notte e Liquid Glass attivabile e disattivabile. Il Liquid Glass è vero e su tutta l'interfaccia, mai un finto vetro. In alto a destra, appena si apre la dashboard, due tasti rapidi per le due opzioni.
- Telefoni vecchi: il vetro vero pesa. Si spegne da solo sui dispositivi deboli o se il sistema chiede meno trasparenza (`prefers-reduced-transparency`). Il testo resta sempre leggibile, con contrasto sufficiente anche sul vetro.

## 7. Base obbligatoria
1. **CRM.** Archivio centrale e unica fonte di verità: clienti, contatti, storico di chiamate, messaggi, appuntamenti e note, con scheda completa e prossime azioni. Tutte le sezioni leggono da qui.
2. **Agenda.** Vista calendario (giorno e settimana) degli appuntamenti del CRM.
3. **CSV.** Solo per spostare dati dentro e fuori, mai come archivio. Importazione con anteprima, associazione guidata delle colonne, controllo duplicati (unire, saltare o creare nuovo), riepilogo finale. Esportazione di clienti, report e backup. Ogni importazione passa dal CRM.
4. **Dashboard.** Animata, con storico, andamenti, grafici e report su entrate, spese, guadagni e confronto tra periodi. Numeri onesti: skill `dashboard-dati-onesti`.
5. **Bilancio e storico del mese.** Ogni mese si chiude da solo il 1° del mese dopo e resta nello storico, consultabile mese per mese e anno per anno:
   - entrate, uscite e margine, divisi per servizio, prodotto o categoria di spesa;
   - confronto col mese prima e con lo stesso mese dell'anno prima;
   - incassi da riscuotere e pagamenti in scadenza;
   - clienti nuovi, clienti tornati e clienti persi (non tornano da tempo, soglia scelta per settore);
   - servizi o prodotti che rendono di più e di meno;
   - obiettivo del mese contro risultato, se il titolare imposta un obiettivo;
   - esporta in PDF e CSV, pronto da mandare al commercialista.

   È un bilancio di gestione, per capire come va l'attività: non è il bilancio d'esercizio né un documento fiscale, e va scritto così nella pagina. I numeri nascono solo dai movimenti registrati: se un mese è incompleto, lo si dice.
6. **Ricerca globale.** Una barra che trova al volo clienti, pratiche e prodotti.
7. **Notifiche e scadenze.** Per esempio magazzino in esaurimento e appuntamenti in arrivo.
8. **Registro delle modifiche.** Chi ha cambiato cosa e quando.
9. **Area documenti per cliente.** Contratti, fatture e PDF allegati alla scheda.
10. **Uso da telefono.** Prima di tutto schermi piccoli, tasti grandi, tabelle che non si rompono.
11. **Connessione debole.** Se la rete cade mentre si compila non si perde niente: bozza salvata, avviso chiaro, salvataggio quando torna la rete.
12. **Backup automatici con ripristino** (versione vera). Il ripristino va provato davvero.
13. **Ruoli e permessi** (versione vera). Titolare, dipendenti e figure esterne vedono cose diverse, accesso minimo. Per privati e chi lavora da solo partono semplici; ruoli e permessi completi si attivano dal secondo utente.
14. **Dati di esempio realistici** (demo). Per ogni settore, sempre segnati come dimostrativi.

## 8. Sicurezza e privacy
**Codice, vale sempre (demo e vera):**
- Testo dell'utente con `textContent` o escape; mai `innerHTML` con dati dell'utente.
- Niente `eval`, `new Function`, script da fonti non fissate. Librerie solo da CDN con versione esatta (meglio con `integrity`).
- Meta `Content-Security-Policy` restrittiva e `referrer` `no-referrer`.
- Demo: solo dati inventati, banner «Progetto dimostrativo · dati inventati», mai dati reali di clienti o pazienti.

**Versione vera:**
- Login obbligatorio, account personali mai condivisi, RLS attiva su ogni tabella con policy per utente e ruolo. Nel browser solo la chiave pubblica («anon» o «publishable»), mai quelle segrete. `get_advisors` di Supabase senza avvisi gravi.
- **Due fattori**: MFA di Supabase Auth (TOTP) e policy RLS che richiedono il livello `aal2` sulle tabelle sensibili.
- **Cifratura**: Supabase cifra già il disco. Cifrare i singoli campi impedisce di cercarli, quindi si decide campo per campo e la scelta si scrive nel README del settore. Anche i file allegati sono cifrati.
- **Registro accessi, anche in sola lettura.** Il database non lo fa da solo: i dati sensibili si leggono solo tramite funzioni (RPC o Edge Function) che scrivono nel registro. Il registro è una tabella senza UPDATE né DELETE, nemmeno per il titolare. Conservazione 24 mesi, poi pulizia automatica con pg_cron.
- **Registro modifiche** con trigger sul database, stessa protezione.
- **Data breach**: Alessandro (responsabile) avvisa il cliente (titolare) senza ritardo appena se ne accorge. Il cliente notifica il Garante entro 72 ore (art. 33 GDPR). Il gestionale dà al cliente i dati per farlo: cosa, quando, quanti interessati.
- **Diritti dei clienti finali (GDPR)**: esportare tutti i dati di una persona; cancellarli rispettando gli obblighi di conservazione; tempi di conservazione con pulizia automatica; consenso marketing separato da quello per il servizio (serve al modulo Comunicazione).
- Alessandro è responsabile del trattamento: serve il contratto di nomina art. 28 GDPR e un'informativa privacy, redatti una volta da un professionista e poi riusati come modello. **Senza questi documenti non si vendono gestionali con dati sanitari.** Controllo con `ufficio-legale`.

## 9. Proprietà e uscita (da scrivere prima di vendere)
- Di chi è l'account Supabase.
- Chi paga i costi fissi: Supabase Pro per i backup giornalieri (25 $ al mese di base, backup giornalieri conservati 7 giorni, nessuna pausa per inattività; supabase.com/pricing, 18/11/2026), intermediario SDI, API WhatsApp.
- Come il cliente si porta via tutti i dati (export completo) se smette.
Nessun vincolo per il cliente: è anche un argomento di vendita.

## 10. Moduli opzionali
Si attivano solo quando servono.
- **Fatturazione e pagamenti.** Preventivi, fatture, scadenze di incasso, tramite intermediario accreditato SDI. Specifiche tecniche FatturaPA versione 1.9.1, utilizzabili dal 15/05/2026 (pagina «Specifiche tecniche versione 1.9.1» dell'Agenzia delle Entrate, controllata il 18/11/2026). Prima di costruire il modulo ricontrolla che non sia uscita una versione nuova. Per professioni sanitarie con pazienti privati (medici, dentisti, psicologi e altre: verificare caso per caso con `ufficio-legale`) il modulo giusto è il Sistema Tessera Sanitaria, non la fattura SDI.
- **Vendita al banco.** Lo scontrino lo fa il registratore telematico. Il gestionale non lo sostituisce e non deve sembrarlo.
- **Comunicazione.** Email e calendario dalla scheda cliente (skill `invio-email-sicuro`). WhatsApp solo con l'API ufficiale WhatsApp Business (Cloud API), messaggi modello e consenso; mai automatizzare un numero WhatsApp normale (rischio blocco). Vedi `whatsapp-agent`. Le automazioni sono Edge Function Supabase (skill `automazioni-supabase-edge`), mai N8N.
- **Magazzino.** Con codici a barre attivabili, per chi vende prodotti.

## 11. Collaudo (obbligatorio prima di «finito»)
Con Playwright (`require('playwright')`, `chromium.launch()`), a 390x844 e 1440x900:
- apri ogni sezione e ogni modulo; premi ogni pulsante; compila ogni modulo con dati validi e non validi;
- crea, modifica ed elimina un elemento in ogni sezione e controlla che resti dopo il ricaricamento;
- prova i due tasti (Liquid Glass e giorno/notte) e che la scelta resti dopo il ricaricamento;
- ogni collegamento va provato davvero (una vendita scala il magazzino e compare nei report);
- il bilancio del mese torna al centesimo con la somma dei movimenti, e la chiusura del mese passa nello storico;
- prova la rete che cade mentre si compila: bozza salvata e avviso;
- nessun errore in console, nessuno scroll orizzontale, testi leggibili in chiaro e scuro, anche col vetro;
- salva gli screenshot.

Poi:
1. Un agent prova a rompere il gestionale: `squadra-collaudo`, più `collaudo-gestionale`.
2. Versioni con login o dati di clienti: `attacco-di-prova`, fino a zero vulnerabilità.
3. Controllo critico finale nei panni del professionista di quel settore: cerca buchi e mancanze e sistemali.
4. Prova finale da telefono, anche vecchio, senza account né app (demo).

Correggi e ripeti finché passa tutto. Se qualcosa non si può collaudare, scrivilo.

## 12. Consegna
«Completato» solo quando i punti 5, 7, 8 (per la versione vera) e 11 sono tutti fatti e il link pubblico si apre davvero. Messaggio finale: cosa c'è, esito del collaudo (cosa provato, errori trovati e corretti), controlli di sicurezza, limiti rimasti.

## 13. Gestionali vecchi
Ogni gestionale vecchio (artifact o demo di ottobre) si porta sulla base: si ricavano i moduli utili, si scrive `settori/<settore>.js`, si collauda e si mette in sicurezza come sopra. I dati reali presenti nei vecchi non si copiano mai.

## 14. Regole sempre valide
- Niente strumenti tecnici o sezioni di vendita visibili al cliente.
- Niente dati inventati spacciati per veri.
- A fine lavoro elencare onestamente tutti i problemi rimasti.
