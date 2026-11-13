# Automazioni su Supabase (progetto «Alessandro»)

Regola: ogni automazione è una Edge Function nel progetto Supabase, con pg_cron per gli orari. Le chiavi stanno solo nei secrets della funzione: in questa cartella non c'è nessun segreto.

## Questionario Prima Call → Mappa Call Live (08/11/2026)

**Risultato:** quando un potenziale cliente compila il questionario, le risposte arrivano da sole nella Mappa Call Live, senza copia-incolla da WhatsApp.

Come funziona:
1. Il cliente compila `questionario/index.html` (pubblicato su GitHub Pages: `https://alessandromauroworks.github.io/Ale/questionario/`). All'invio si apre WhatsApp come sempre e, in parallelo, le risposte vanno alla Edge Function `questionario-ricevi`. Se la funzione non risponde entro 8 secondi non succede niente: resta WhatsApp.
2. `questionario-ricevi` (verify_jwt false) accetta solo POST JSON dall'origine di GitHub Pages, max 96 KB, con campo trappola anti-bot, limite di 5 invii l'ora per IP, 3 al giorno per numero e 30 l'ora in tutto (contro gli attacchi che cambiano IP e numero), validazione dei campi. Salva nella tabella `public.questionari` con la service role. Registro in `public.questionari_log` (solo esiti, nessun dato personale).
3. La Mappa Call Live, quando Alessandro la apre, legge i questionari nuovi con il suo connettore «Supabase» (nessuna chiave nella pagina), crea la call `call/q-<id>` con la stessa struttura dell'import a mano, associa le demo pronte ai 2-3 problemi principali, e segna `importato_il`. Controlla di nuovo ogni 3 minuti mentre la pagina è aperta.
4. Ogni notte il job pg_cron `questionari-pulizia` cancella i questionari più vecchi di 12 mesi non legati a un cliente (`stato <> 'cliente'`). La Mappa, al massimo una volta al giorno (ultima esecuzione in `indice/pulizia`), cancella le sue call nate dal questionario ferme da 12 mesi: quelle arrivate da sole (`q-<id>`) e quelle importate a mano col codice QC1/QC2. Le call che non vengono dal questionario non si toccano mai. Così l'informativa («cancellate dopo 12 mesi») vale anche per la copia nella Mappa.
5. Se il primo invio non riesce, il questionario riprova quando il cliente tocca «Apri WhatsApp» (mai due salvataggi dello stesso invio).

Quando un lead diventa cliente lo segna la Mappa da sola: esito «Cliente / acconto» nella call (riquadro «Per chiudere bene la call») oppure lead collegato con stato cliente/acconto/vinto/firmato/pagato. La call non viene più cancellata e la riga su Supabase passa a `stato = 'cliente'` (per id se è arrivata da sola, per telefono e attività se importata a mano), così neanche pg_cron la cancella. Senza connettore la call resta segnata `clienteSync = da_fare` e si sincronizza al primo controllo riuscito. Togliendo l'esito, la riga torna `importato`.
Cancellazione su richiesta dell'interessato: `delete from public.questionari where telefono = '...';`

File:
- `questionario-ricevi/index.ts`: codice della funzione (deploy con verify_jwt false).
- `migrazioni/20261108_questionari_pre_call.sql`: tabelle, RLS e pulizia automatica.
- `prove/compila.js`: compila il questionario con Playwright come un cliente e salva il corpo che la pagina manda alla funzione (`node compila.js <html> <out.json> [390|1280] [ok|giu|bozza] [cerca-settore]`).
- `prove/mappa12.js`: prova conservazione 12 mesi e stato cliente (call manuale vecchia, cliente per esito e per lead, call non da questionario, chiusura con esito cliente, connettore assente, pulizia già fatta oggi).
- `prove/peso.js`: tempi di caricamento del questionario su telefono lento simulato.
- `prove/mappa.js`: apre la Mappa Call Live con un finto `window.claude` (database in memoria e connettore Supabase finto) e prova import, doppioni, pulizia a 12 mesi, errori del connettore e modalità presentazione.

Collaudo del 10/11/2026: prova completa reale (pagina pubblica = main, invio vero con origine GitHub → riga in tabella → call creata dalla Mappa aperta in 15 secondi), poi righe e call di prova cancellate.

Origini permesse: solo `https://alessandromauroworks.github.io`. Se il questionario si pubblica altrove, aggiungere l'origine in `ORIGINI` e rifare il deploy. Le origini rifiutate finiscono nel registro (`esito = 'origine_rifiutata'`).
