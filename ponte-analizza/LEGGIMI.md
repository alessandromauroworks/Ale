# Ponte Analizza

## A cosa serve
1. Claude lavora nel cloud e scrive i link da analizzare nella coda su Supabase.
2. Questo ponte, sul tuo PC, guarda la coda ogni 30 secondi.
3. Quando trova un link, lo passa ad Analizza e aspetta il report.
4. Poi rimette il report nella coda, e Claude lo legge.

## Installazione
1. Copia questa cartella in `Desktop\Lavoro IA\App\ponte-analizza`.
2. Dentro, copia `.env.esempio` e chiama la copia `.env`.
3. Prendi la chiave: Supabase, progetto Alessandro, Project Settings, API Keys, chiave **service_role**. Incollala nel `.env` dopo `SUPABASE_SERVICE_KEY=`.
   **Attenzione:** e' una chiave segreta. Resta solo sul PC. Non incollarla mai in chat.
4. Prova i collegamenti: apri il Prompt dei comandi nella cartella e scrivi `python ponte_analizza.py --prova`. Deve dire OK per Supabase e per la cartella dei report.
5. Avvio: doppio clic su `AVVIA_PONTE.bat`. La finestra deve restare aperta.
6. Avvio automatico all'accensione: crea una scorciatoia di `AVVIA_PONTE.bat`, premi Windows+R, scrivi `shell:startup` e metti la scorciatoia in quella cartella.

Per fare un solo giro di prova: `python ponte_analizza.py --una-volta`. Il registro di cosa succede e' nel file `ponte.log`.

## Collegamento ad Analizza (fatto il 10/11/2026)
`avvia_analisi` e' collegata all'app Analizza vera: manda il link a `/api/analizza`, poi controlla `/api/lavoro/<id>` finche' il report e' pronto. Il ponte usa la cartella «Lavoro IA» che lo contiene (quella in OneDrive\Desktop), non la vecchia copia in Desktop.

## Quando il PC è spento: Analizza nel cloud (dal 13/11/2026)
Con il PC spento, i link di **Instagram e TikTok** li fa il cloud (GitHub Actions, gratis). Gli altri (YouTube, Facebook, X, Threads) e i «solo video» aspettano il PC come prima.

Come funziona:
1. Ogni minuto Supabase guarda la coda (pg_cron, Edge Function `analizza-cloud`, azione «sveglia»).
2. Se c'è un link adatto e il PC non manda il battito da 2 minuti (oppure il link aspetta da più di 10 minuti), avvia il workflow GitHub `Analizza nel cloud`.
3. Il workflow prende il link (stato «in_lavoro», con lo stesso blocco del PC: mai fatto due volte), scarica solo l'audio, lo trascrive, scrive il report nella stessa riga e cancella i file.
4. Se il cloud non ce la fa (es. Instagram chiede l'accesso), il link torna «in attesa» con una nota grigia sulla pagina: lo farà il PC.

Il report del cloud è un **report base**: dati del post (autore, titolo, durata, risoluzione, didascalia), trascrizione con i tempi e siti/profili citati. Rispetto al PC **mancano**: la linea del tempo «cosa si vede» (analisi delle immagini con IA), il video sul telefono e i file per Claude. Per il report completo rimanda lo stesso link col PC acceso.

Il ponte sul PC non va cambiato: continua a funzionare come riserva. Il blocco è nel database (`prendi_prossima_analisi` per il PC, `prendi_analisi_cloud` per il cloud).

### Le chiavi (una volta sola, le mette Alessandro)
Servono due cose. Mai incollarle in chat.

**A. Il codice condiviso fra GitHub e Supabase** (una parola lunga a caso, la inventi tu)
1. Crea un codice lungo a caso (almeno 32 tra lettere e numeri): per esempio con «Suggerisci password» del portachiavi dell'iPhone o del browser. Tienilo solo nel gestore password.
2. GitHub: repo `Ale` > Settings > Secrets and variables > Actions > New repository secret. Nome `ANALIZZA_CLOUD_CODICE`, valore il codice. Salva.
3. Supabase: progetto Alessandro > Edge Functions > Secrets > Add new secret. Nome `ANALIZZA_CLOUD_CODICE`, stesso valore. Salva.

**B. Il token GitHub che permette a Supabase di avviare il workflow**
1. GitHub > foto in alto a destra > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.
2. Nome `analizza-cloud`, scadenza 1 anno. Repository access: **Only select repositories** > `Ale`.
3. Permissions > Repository permissions > **Actions: Read and write**. Nient'altro (Metadata: Read-only si mette da solo).
4. Generate token e copialo.
5. Supabase: progetto Alessandro > Edge Functions > Secrets > Add new secret. Nome `GITHUB_TOKEN_ANALIZZA`, valore il token. Salva.
Il token può solo avviare/fermare i workflow del repo Ale: non può cambiare il codice.

### Prova finale
Col PC spento, dal telefono metti un reel Instagram nella pagina `analizza/`. Entro 3-5 minuti deve diventare «Fatto · cloud» e il report deve iniziare con `# REPORT ANALIZZA REEL` e la riga «Fatto da: cloud». Su GitHub, tab Actions, «Analizza nel cloud» deve essere verde.
