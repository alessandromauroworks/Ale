# Collaudi del questionario

Servono a controllare, con un browser vero (Chromium), che il questionario funzioni su telefono e computer
dopo ogni modifica. Non fanno parte del sito: non vanno caricati online.

## Come si lanciano

1. Una volta sola, dentro questa cartella:

   ```
   cd questionario/test
   npm install
   npx playwright install chromium
   ```

   Si installano `playwright` (il browser di prova) e `axe-core` (il controllo di accessibilità).
   La cartella `node_modules` è ignorata da git.

2. Poi, dalla radice del repo:

   ```
   node questionario/test/collaudo.mjs
   ```

   Parte da solo un piccolo server sulla porta 8800 (serve `python3`). Se preferisci un server tuo:
   `python3 -m http.server 8800` dalla radice del repo e poi `BASE_URL=http://localhost:8800 node questionario/test/collaudo.mjs`.

   Per lanciarne solo alcuni: `node questionario/test/collaudo.mjs 06 08` (i numeri iniziali dei file).
   Gli screenshot vanno in una cartella temporanea (o in quella indicata con `SHOT_DIR=/percorso`).

A fine corsa c'è una riga `TOTALE: ... passati, ... falliti`. Se i falliti non sono zero, il comando esce con errore.
Un intero giro dura parecchi minuti (decine di scenari su 5 larghezze di schermo).

## La rete esterna è bloccata

Tutti i collaudi bloccano ogni richiesta fuori dal server di prova (Supabase, WhatsApp, Resend, ecc.): non parte nessun dato vero.
Il test sull'invio guarda solo cosa *sarebbe* stato inviato.

## Cosa controllano

| File | Cosa verifica |
|---|---|
| `01-base` | Percorso di base: ruolo obbligatorio, ramo segreteria, contatto (email/telefono), telefono valido, bozza dopo il ricaricamento, bozze vecchie, riepilogo e messaggio WhatsApp |
| `02-pannelli-servizi` | Ogni servizio apre e chiude il suo pannello, i dati entrano ed escono da `d.dettagli`, le automazioni cambiano col settore, anteprima del gestionale sincronizzata, nessuno scroll orizzontale da 320 a 1440 px, peso dei dati sotto 48 KB |
| `03-mappa-demo-presentazione` | Presentazione a passi, demo del sito e delle automazioni, mappa del lavoro, finestre (Esc, X, tocco fuori, focus) |
| `04-accessibilita-tastiera-velocita` | axe-core su ogni passo, percorso con sola tastiera, riduzione del movimento, zoom 200%, velocità di caricamento con CPU rallentata |
| `05-insieme-flusso` | «Insieme funzionano meglio», demo del flusso e pannello automazioni di esempio (le modifiche non si salvano) |
| `06-consigli-pacchetti` | Banner «Consiglio», una sola logica dei suggerimenti, tabella dei pacchetti con spunte e croci leggibili dai lettori di schermo, pacchetto su misura, riquadro canone, nessuna promessa di garanzia |
| `07-settori-e-privato` | I settori nuovi hanno contenuti propri; il percorso «Privato» senza voci aziendali fuori luogo |
| `08-versione-veloce-prenotazione-email` | Versione veloce fino all'invio (telefono valido per la funzione online) e «continua»; prenotazione con Google Calendar, cal.com e link vuoto; casella «copia via email» |
| `09-demo-specifiche` | Demo del sito con testi diversi per settore, schermate diverse per modulo del gestionale, pacchetti presentati come esempi |

## Prova della funzione che manda l'email

La prova della copia via email (Resend simulato) sta accanto alla funzione:
`node --experimental-strip-types automazioni/supabase/prove/email.test.mts`
