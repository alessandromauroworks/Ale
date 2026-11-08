# Cacciasconti

Estensione per Chrome, Edge, Brave, Opera e Firefox (stesso codice, Manifest V3). Al momento del pagamento prova i codici sconto per te e applica il migliore.

## Cosa fa
- **Cercatore**: mentre navighi cerca nelle pagine (testi, banner, popup) i codici sconto e li salva per sito.
- **Archivio**: ricorda per ogni sito i codici, quando sono stati provati e se funzionano. Ha anche una lista di circa 40 codici comuni (si può spegnere).
- **Tester**: alla cassa, con un clic, prova i codici uno alla volta nel campo del negozio, scarta quelli che non funzionano e applica il migliore.
- Quando trova un campo coupon, mostra in basso a destra una piccola scheda "N codici da provare" (si chiude con la X e per 24 ore non torna su quel sito) e mette il numero sull'icona.
- Ogni codice mostra la data dell'ultima prova e il risultato: "funziona, -12,40 €" oppure "non funziona" con il motivo (non valido, scaduto, importo minimo, non applicabile, nessuna reazione). Un codice non è mai "verificato" se non l'ha provato davvero questo computer.
- Scheda **Risparmi**: totale risparmiato e storico (sito, codice, risparmio, data).
- Salva e ricarica i tuoi codici in un file JSON (backup).
- Funziona con le "ricette" dei siti più comuni (Shopify, WooCommerce, Magento, PrestaShop) e, per tutti gli altri, con il riconoscimento generico. Le ricette sono file nel pacchetto (`recipes/`): nessun codice viene mai scaricato da internet.

## Installazione (senza store)
1. Scarica o clona questa cartella `estensione-sconti`.
2. **Chrome**: apri `chrome://extensions`, attiva **Modalità sviluppatore**, premi **Carica estensione non pacchettizzata** e scegli la cartella.
3. **Edge**: apri `edge://extensions`, attiva **Modalità sviluppatore**, poi **Carica estensione non pacchettizzata**.
4. **Brave**: apri `brave://extensions`, stesso procedimento. (Opera: `opera://extensions`.)
5. Fissa l'icona alla barra del browser per vederla comoda.

### Firefox (128 o più nuovo)
- **Prova subito**: apri `about:debugging`, scegli **Questo Firefox** > **Carica componente aggiuntivo temporaneo** e seleziona `manifest.json` (sparisce alla chiusura di Firefox).
- **Permanente**: Firefox accetta solo estensioni firmate. La firma di Mozilla è gratuita anche per la distribuzione "da solo / non in elenco" (AMO, vedi `STORE.md`): carichi `dist/cacciasconti-<versione>-firefox.zip` e ricevi un `.xpi` da installare.
- In Firefox i permessi sui siti sono facoltativi: la prima volta il popup mostra **Dai il permesso** (tutti i siti). Senza, l'estensione non vede i negozi.
- `./pacchetto.sh` crea due zip (Chrome e Firefox) perché i due browser vogliono manifest un po' diversi nella parte "background". Il manifest della cartella funziona per entrambi in modalità sviluppatore. `npx web-ext lint`: 0 errori (restano avvisi noti: service_worker ignorato da Firefox, `innerHTML` con testo già ripulito).

Per pubblicarla negli store guarda `STORE.md`.

## Aggiornamenti (leggi bene)
- **Caricata da cartella (modalità sviluppatore) non si aggiorna da sola.** Gli aggiornamenti automatici veri arrivano SOLO dagli store: Chrome Web Store, Edge Add-ons, Firefox AMO.
- Soluzione senza store (Windows): nella cartella `aggiorna/` ci sono due script PowerShell.
  1. `aggiorna.ps1 -Repo <indirizzo del repository>` scarica SOLO la cartella `estensione-sconti` in `%LOCALAPPDATA%\Cacciasconti` (sparse checkout, ramo `main` o quello che indichi con `-Ramo`, con le tue credenziali git).
  2. `installa-aggiornamento-automatico.ps1 -Repo <indirizzo>` crea un'attività pianificata (solo per te, senza amministratore) che lancia l'aggiornamento ogni giorno e a ogni accesso.
  3. Carica **una volta** nel browser la cartella `%LOCALAPPDATA%\Cacciasconti\estensione-sconti`. Dopo, i file su disco si aggiornano da soli.
- L'estensione controlla all'avvio del browser, all'installazione e ogni volta che apri la finestra se il `manifest.json` su disco ha una versione più nuova (senza il permesso `alarms`). Se sì, il popup mostra **"Nuova versione pronta: clicca per ricaricare"**. Nelle Opzioni c'è la casella *Ricarica da sola* (spenta di base, in prova): vedi "Limiti" qui sotto.
- Il popup mostra la versione e le **Novità** (`CHANGELOG.md`).

## Altre fonti di codici
- **Esploratore del negozio** (acceso di base, si spegne dalle Opzioni): quando sei su un negozio con il campo coupon, l'estensione scarica in secondo piano poche pagine pubbliche dello STESSO negozio (home, /promo, /promozioni, /offerte, /sconti, /coupon, /codici-sconto, /pages/promo, /sale, /newsletter e i link della home con "promo/offerte/sconti/coupon/codice"): massimo 8 pagine, una volta ogni 24 ore per sito, senza cookie, 5 secondi di tempo massimo, rispettando le regole `Disallow` di robots.txt (se robots.txt dà errore del server non scarica nulla). I codici trovati hanno la fonte "sito del negozio". **Non** legge siti di coupon di terzi.
- **Fonti aggiuntive** (Opzioni, vuote di base): pagine che scegli tu, collegate a un sito. Stessa regola di robots.txt. Controlla tu i termini d'uso di quel sito.

## Codici condivisi (anonimi): come accenderli davvero
La funzione è nel codice, **spenta di base** (casella "Condividi codici funzionanti (anonimo)" nelle Opzioni). Quando è accesa invia solo sito, codice, esito e percentuale (mai i codici scritti a mano) e prima di una prova scarica i codici condivisi (fonte "condivisi").
Cosa serve per attivarla in produzione:
1. **Database**: applica `supabase/migrations/20261108120000_cacciasconti.sql` al progetto Supabase (tabelle `cacciasconti_*`, RLS accesa senza policy pubbliche, vista `cacciasconti_stats_30g`, pulizia notturna con pg_cron: segnalazioni dopo 90 giorni, hash dopo 24 ore).
2. **Funzione**: pubblica `supabase/functions/cacciasconti-codici` (`verify_jwt = false` in `supabase/config.toml`; segreti: `CACCIASCONTI_SALE` casuale lungo, opzionale `CACCIASCONTI_APIKEY`). Valida dominio e codice, limite 60 segnalazioni/ora per hash IP (indirizzo = `cf-connecting-ip`, altrimenti l'ULTIMO elemento di `x-forwarded-for`), senza `CACCIASCONTI_SALE` risponde 503, corpo massimo 2 KB, GET max 20 codici con almeno 2 successi e almeno il 50% di successi nei 30 giorni (contro i codici avvelenati).
3. **Estensione**: in `background.js` la costante `ENDPOINT_CONDIVISO` punta già a `https://udubhzamghhlkxgepmmc.supabase.co/functions/v1/cacciasconti-codici`; metti la chiave pubblica nella costante `SUPABASE_ANON_KEY` (oggi vuota) se la funzione richiede `apikey`.
4. **Informativa**: `privacy.html` e la scheda degli store (`STORE.md`) descrivono già l'invio, ma sono una **BOZZA**: falle controllare (privacy/legale) prima della distribuzione pubblica.
Niente è stato pubblicato da questa cartella.

## Limiti dei nuovi pezzi
- Il ricaricamento automatico (`chrome.runtime.reload`) non si è potuto provare nell'ambiente di prova (in Chromium lanciato da Playwright l'estensione sparisce dopo il reload): per questo è una casella facoltativa e di base resta l'avviso con il pulsante. Il controllo della versione su disco e l'avviso sono provati.
- Gli script PowerShell non sono stati eseguiti (nessun PowerShell nell'ambiente di prova): provali una volta a mano.
- Firefox: controllo con `web-ext lint` (0 errori), ma non provato dal vivo in Firefox.

## Come si usa
1. Naviga normalmente: l'estensione raccoglie i codici che i negozi mostrano.
2. Vai al carrello o alla cassa. Se c'è un campo codice sconto, compare la scheda in basso a destra.
3. Premi **Genera sconto** (sulla scheda o nella finestra dell'estensione). Guarda il pannello sulla pagina: mostra il codice in prova, ✓/✗ per ognuno e il pulsante **Stop**. Non toccare la pagina mentre lavora.
4. Alla fine vedi ad esempio "Risparmi 12,40 € con SCONTO15 (12 codici provati in 9 s)" oppure "Nessun codice funzionante trovato".
5. Puoi aggiungere un codice a mano, regolare quanti codici provare al massimo (predefinito 20) e usare **Riprova anche i codici che non funzionavano** (di norma i codici falliti da meno di 7 giorni vengono saltati). I codici che non funzionano solo per colpa del carrello (importo minimo, non applicabile a questo carrello, carrello vuoto, totale non leggibile, troppi tentativi) sono "da riprovare" e non vengono saltati; quello con importo minimo torna in coda quando il carrello cresce.

Ordine di prova: prima i codici che hanno funzionato di recente (risparmio più alto prima), poi quelli trovati nelle pagine del sito (i più nuovi), i codici che non funzionano da più di 30 giorni, quelli aggiunti a mano, quelli trovati solo dal nome di una classe della pagina (poco sicuri) e infine i comuni. I codici con una scadenza passata scritta nella pagina ("scade il 30/11", "valido fino al...", "expires...") non si provano. L'archivio si ripulisce da solo: massimo 40 codici per sito e 200 siti, via i codici di pagina mai provati da più di 60 giorni. Per ogni sito si ricordano il campo e il pulsante che hanno funzionato.

Sicurezze: massimo di codici per prova, pausa di 150-400 ms tra un tentativo e l'altro, stop se compare un captcha o se il sito risponde "troppi tentativi" 3 volte di seguito. L'estensione tocca solo il campo del codice e il suo pulsante: mai i campi di pagamento, email o indirizzo.

## Permessi (e perché)
- `storage`: salva sul tuo computer codici, risultati, risparmi e impostazioni.
- `scripting`: quando apri la finestra su una scheda aperta prima dell'installazione, carica lo script in quella scheda.
- `host_permissions: <all_urls>`: serve per leggere il testo delle pagine alla ricerca di codici e per scrivere nel campo coupon su qualsiasi negozio (non si possono elencare tutti i siti), e per scaricare le poche pagine promo dello stesso negozio e, se accendi la condivisione, parlare con il servizio dei codici condivisi. Il testo delle pagine si legge solo sul tuo computer per trovare codici; l'estensione non salva e non invia altro.
Non ci sono i permessi `cookies`, `activeTab` (con `<all_urls>` sarebbe ridondante) e `alarms` (il controllo degli aggiornamenti da cartella parte all'avvio e all'apertura della finestra). L'estensione non legge né modifica i cookie.

## Privacy
- **Di base** (condivisione spenta) non viene inviato nulla a Cacciasconti: nessuna statistica, nessun account. Le uniche richieste di rete sono quelle dell'esploratore verso lo STESSO negozio che stai visitando (poche pagine pubbliche, senza cookie).
- **Se accendi "Condividi codici funzionanti (anonimo)"** (Opzioni, spenta di base) l'estensione parla con un servizio di Cacciasconti ospitato su Supabase: prima di una prova **scarica** i codici segnalati per il sito che stai visitando (la richiesta contiene il dominio del negozio) e dopo ogni prova **invia** solo sito (dominio), codice, se ha funzionato e la percentuale di sconto. Mai i codici scritti a mano. L'indirizzo IP non viene salvato: si tiene solo un hash con sale giornaliero, cancellato dopo 24 ore; le segnalazioni si cancellano dopo 90 giorni. Il servizio è una BOZZA da far controllare (vedi sotto).
- Il testo delle pagine che visiti si legge solo sul tuo computer per trovare codici; non si salva e non si invia altro che i codici trovati (e solo sul tuo computer).
- Nessun codice eseguibile scaricato da internet. **Nessun link di affiliazione, nessuna modifica ai cookie, nessun identificativo di tracciamento.** Vedi `privacy.html`.

## Perché è diversa da Honey e CouponBirds
Onestà prima di tutto:
- Honey e CouponBirds hanno grandi database condivisi di codici, aggiornati da milioni di utenti. **Noi no**: abbiamo solo i codici che trovi tu, quelli che aggiungi e una piccola lista di codici comuni. Su molti negozi troveranno più codici di noi.
- Cacciasconti è locale e trasparente: il codice è tutto in questa cartella e si può leggere, di base non invia nulla a nessuno (la condivisione anonima è facoltativa e spenta) e non ha affiliazioni.
- Nel dicembre 2024 un'inchiesta pubblica ha sostenuto che Honey, durante gli acquisti, sostituiva i cookie di affiliazione dei creatori di contenuti con i propri. Cacciasconti non tocca i cookie e non usa link di affiliazione, quindi non può farlo: per questo non chiede il permesso `cookies`.
- Non copiamo né nome né grafica di altre estensioni.

## Limiti onesti
- Non può avere i codici di tutto il mondo: prova solo quelli trovati, aggiunti o comuni.
- Non funziona su ogni cassa: alcune (campo dentro un frame di pagamento protetto dalla banca, shadow DOM chiusi, siti molto personalizzati) non si riescono a leggere. Funzionano invece i campi dentro iframe (anche di un altro sito) e dentro shadow DOM aperti.
- Alcuni siti bloccano o rallentano i tentativi ripetuti: in quel caso l'estensione si ferma.
- I codici personali (legati a un account o a un'email) non funzionano per altri.
- Se il sito non permette di togliere un codice, l'estensione si ferma al primo che funziona.
- Il risparmio mostrato è quello che il sito indica sul totale: controlla sempre il totale prima di pagare.

## Prove automatiche
`node test/run.js` avvia i negozi finti (WooCommerce con ricarica, negozio tipo React, campo nascosto dietro un link, IVA inclusa, riga prodotto con pulsante "rimuovi" ingannevole, messaggi estranei, ecc.), Chromium con l'estensione e una prova della Edge Function con Node. Serve Playwright. Con `--screenshot` rifà le immagini in `store/`.
