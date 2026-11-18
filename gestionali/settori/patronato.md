# Patronato / sportello servizi (Patronato e CAF)

Demo per il sito vetrina, costruita sulla base comune (`gestionali/base/`). Pagina: `gestionali/patronato.html`. Ricavata dal gestionale demo del Patronato di Carapelle (repo `alessandromauroworks`, `demo-patronato/`), senza copiare dati reali: tutti i dati sono inventati.

## Le 5 domande (punto 5 della skill)
1. **Come lavora in una giornata.** Due operatrici e una titolare allo sportello: ricevono cittadini su appuntamento e senza, raccolgono documenti, fanno firmare mandato di patrocinio e informativa privacy, trasmettono a INPS, Agenzia delle Entrate o Ministero del Lavoro, segnano il protocollo, aspettano l'esito, rispondono alle integrazioni. Oggi tengono tutto tra fogli, Excel, il portale dell'ente e WhatsApp.
2. **Dove perde tempo o soldi.** (a) Pratiche ferme perché manca un documento e nessuno richiama; (b) termini persi: 68 giorni per NASpI e DIS-COLL, 7 giorni per revocare le dimissioni, termine della lettera di integrazione INPS, RED, 12 mesi per la successione, ricorsi; (c) servizi CAF a pagamento fatti e mai incassati.
3. **Moduli in più.** Pipeline delle pratiche per stato con regole di invio, checklist dei documenti per tipo, firme, protocolli nel formato dell'ente, esiti e termini di ricorso o ATP, scadenze calcolate, listino dei servizi a pagamento collegato al bilancio, richieste di appuntamento online con QR, nucleo familiare, messaggio pronto per il cittadino.
4. **Campi obbligatori per legge.** Mandato di patrocinio firmato e informativa privacy prima dell'invio; per i servizi fiscali la delega. Le regole complete stanno in `ufficio-legale` (collection `legale`): prima di una versione vera vanno ricontrollate lì, la demo non le sostituisce.
5. **Dati sensibili.** Sì: codice fiscale, documenti d'identità, IBAN, dati sanitari (invalidità civile, maternità), redditi. Nella demo sono tutti inventati (codici fiscali con X al posto del comune, telefoni `333 000 …`, email `@esempio.it`). Si chiede solo il minimo: nella scheda ci sono nome, codice fiscale, data di nascita, recapiti, nucleo familiare.

## Cifratura
Demo: **non serve**, perché ci sono solo dati inventati e restano nel browser (`localStorage`). Versione vera: oltre alla cifratura del disco di Supabase, da decidere campo per campo prima di costruirla; i candidati sono IBAN, note sanitarie delle pratiche di invalidità e i file allegati (sempre cifrati). Il codice fiscale resta in chiaro perché serve a cercare e a trovare i doppioni.

## Cosa c'è (settore)
Sezione Pratiche (per stato o tabella, trascinamento su computer, menu su telefono), scheda pratica (stato, firme, documenti, invio con protocollo controllato, esito, ricorso o ATP, pagamento, note, storico, messaggio per il cittadino), Richieste online (QR, link, modulo pubblico `patronato.html#richiesta` con consenso privacy, conferma che crea l'appuntamento), schede Pratiche e Nucleo familiare nel CRM, scadenze del mestiere, indicatori e carico per operatrice in dashboard, esportazione CSV delle pratiche. Una pratica incassata crea il movimento nel bilancio del mese; annullando l'incasso il movimento esce.

## Collaudo (18/11/2026, secondo giro)
Playwright e Chromium, giro completo a **1440x900, 390x844 e 320x568**. Server locale solo per il collaudo, con i file compressi come su GitHub Pages; ogni richiesta verso internet è bloccata. **430 controlli, 430 passati.**
- Tutto quello del primo giro: sezioni, pulsanti, crea, modifica ed elimina con ricarica, dati non validi, bilancio al centesimo, chiusure dei mesi, rete che cade, CSV, testo malevolo, tasti giorno/notte e vetro.
- **QR senza internet**: qrcodejs 1.0.0 sta nel repo (`base/vendor/qrcode.min.js`, licenza MIT in `base/vendor/LICENSE-qrcodejs.txt`). Si carica solo nella sezione Richieste online. L'impronta del file npm è uguale a quella di cdnjs (`sha512-CNgI…0mA==`). Il QR disegnato è stato letto con jsQR e contiene il link del modulo. Se il file non arriva, compare un messaggio. CSP con script solo da `'self'`; nessuna risorsa da internet.
- **PDF vero** del bilancio del mese e dell'anno: generatore minimo `base/pdf.js` (4 KB compressi, caricato solo al clic), scritto apposta perché jsPDF con autotable avrebbe pesato più di tutto il gestionale. Il file scaricato inizia con `%PDF` e si apre con `pdftotext`. Contiene titolo, mese, confronto, tabelle per servizio e categoria con i totali, incassi e pagamenti aperti, movimenti e la scritta «bilancio di gestione, non documento fiscale». Entrate, uscite e margine sono uguali a quelli a schermo, e le lettere accentate e l'euro sono corretti. «Stampa» resta come seconda scelta.
- **Confronto tra periodi** sotto i 600 px: una scheda per voce con differenza in euro (uscite in aumento in rosso), niente scorrimento interno. A 320 px nessuna parte esce dallo schermo: il campo file e un'etichetta lunga sono stati corretti.
- **Telefono vecchio simulato**: 320x568, CPU rallentata 6 volte, user agent Android 7 con Chrome 64, 1 GB di memoria dichiarata.

  | Situazione | Pronto in |
  |---|---|
  | Slow 3G, prima apertura | 8,1 s (sopra la soglia di 3 s) |
  | Fast 3G, prima apertura | 2,6 s |
  | Rete veloce, solo CPU rallentata | 0,5 s |
  | Seconda apertura (file già scaricati) | 0,25 s |

  Cambi di sezione tra 48 e 133 ms (soglia 300 ms); la scheda pratica si apre in meno di 0,7 s; nessun errore, niente si blocca. Il Liquid Glass si spegne da solo con poca memoria e, novità, anche quando lo schermo va a scatti (prova con scatti simulati). Ottimizzazioni fatte: PDF e QR caricati solo quando servono, calcoli riusati dentro ogni disegno (Dashboard da 191 a 114 ms), messaggio «Sto aprendo il gestionale…» subito visibile. Su Slow 3G i 3 s non si raggiungono: la rete aggiunge 2 s di attesa a ogni richiesta e 81 KB compressi richiedono circa 1,6 s, quindi il tempo minimo è di circa 6 s anche senza codice.
- **Modulo pubblico**: sopra il modulo c'è scritto che è una prova dimostrativa, che la richiesta resta solo su questo dispositivo e di non inserire dati veri. Non parte niente verso un server. Dopo l'invio si passa subito alla richiesta arrivata nel gestionale, segnata «Appena arrivata».

**Non collaudato qui:** il link pubblico su GitHub Pages (dopo il push); un telefono vecchio vero; la libreria QR usa `innerHTML` solo nel suo disegno di riserva a tabella, con il link fisso del modulo, mai con testo dell'utente.
