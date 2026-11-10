# Automazioni su Supabase (progetto «Alessandro»)

Regola: ogni automazione è una Edge Function nel progetto Supabase, con pg_cron per gli orari. Le chiavi stanno solo nei secrets della funzione: in questa cartella non c'è nessun segreto.

## Questionario Prima Call → Mappa Call Live (08/11/2026)

**Risultato:** quando un potenziale cliente compila il questionario, le risposte arrivano da sole nella Mappa Call Live, senza copia-incolla da WhatsApp.

Come funziona:
1. Il cliente compila `questionario/index.html` (pubblicato su GitHub Pages: `https://alessandromauroworks.github.io/Ale/questionario/`). All'invio si apre WhatsApp come sempre e, in parallelo, le risposte vanno alla Edge Function `questionario-ricevi`. Se la funzione non risponde entro 8 secondi non succede niente: resta WhatsApp.
2. `questionario-ricevi` (verify_jwt false) accetta solo POST JSON dall'origine di GitHub Pages, max 48 KB, con campo trappola anti-bot, limite di 5 invii l'ora per IP e 3 al giorno per numero, validazione dei campi. Salva nella tabella `public.questionari` con la service role. Registro in `public.questionari_log` (solo esiti, nessun dato personale).
3. La Mappa Call Live, quando Alessandro la apre, legge i questionari nuovi con il suo connettore «Supabase» (nessuna chiave nella pagina), crea la call `call/q-<id>` con la stessa struttura dell'import a mano, associa le demo pronte ai 2-3 problemi principali, e segna `importato_il`. Controlla di nuovo ogni 3 minuti mentre la pagina è aperta.
4. Ogni notte il job pg_cron `questionari-pulizia` cancella i questionari più vecchi di 12 mesi non legati a un cliente (`stato <> 'cliente'`).

Quando un lead diventa cliente: `update public.questionari set stato = 'cliente' where id = '...';` (così non viene cancellato).
Cancellazione su richiesta dell'interessato: `delete from public.questionari where telefono = '...';`

File:
- `questionario-ricevi/index.ts`: codice della funzione (deploy con verify_jwt false).
- `migrazioni/20261108_questionari_pre_call.sql`: tabelle, RLS e pulizia automatica.

Origini permesse: solo `https://alessandromauroworks.github.io`. Se il questionario si pubblica altrove, aggiungere l'origine in `ORIGINI` e rifare il deploy. Le origini rifiutate finiscono nel registro (`esito = 'origine_rifiutata'`).
