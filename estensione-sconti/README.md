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
- **Storico prezzi** (1.4.0): sulle pagine prodotto (dati strutturati JSON-LD, OpenGraph, microdata, Shopify, WooCommerce) salva un prezzo al giorno per prodotto (massimo 500 prodotti) sul tuo computer. Nella finestra, scheda **Prezzi**: mini grafico (SVG), minimo, massimo e prezzo di oggi. Si spegne dalle Opzioni. Nessun sito di confronto prezzi di terzi.
- **Avvisami se scende**: per i soli prodotti che scegli tu. Ad ogni visita, e al massimo una volta al giorno in secondo piano (solo per quei prodotti: `fetch` senza cookie, rispettando robots.txt), se il prezzo è più basso dell'ultimo noto arriva una notifica del browser. Per questo c'è il permesso `notifications`.
- **Cerca anche su**: nella scheda Prezzi, pulsanti che aprono (solo quando clicchi) Amazon.it, Google Shopping, Idealo.it e Trovaprezzi.it con il nome del prodotto. Nessuna lettura di quei siti, nessun codice di tracciamento.
- **Spedizione gratuita**: dalle pagine del carrello legge frasi come "spedizione gratuita sopra 49 €", "free shipping over $50", "ti mancano 7,10 € per la spedizione gratuita" e mostra "Ti mancano 7,10 € per la spedizione gratuita" nella scheda, nel pannello e nella finestra.
- **Gmail web** (SPENTO di base: lo accendi tu nelle Opzioni; da acceso agisce solo quando APRI un messaggio): cerca i codici nel testo e li assegna al negozio (mittente; se il mittente è una piattaforma come `store+123@m.shopifyemail.com`, dai link del negozio nel testo), con scadenza e sconto. Fonte "email". Il testo dell'email non esce dalla pagina: al resto dell'estensione arrivano solo negozio, codici e scadenza. Sulle pagine di Gmail non girano gli altri moduli.
- **Codici dalle tue email (automatico)**: se la tua automazione salva i codici delle tue email nel tuo Supabase (tabella `cacciasconti_codici_email`), inserisci la **chiave personale** nelle Opzioni: ogni 6 ore e prima di una prova l'estensione li scarica (fonte "email (automatico)"). La chiave resta in `chrome.storage.local`: mai sincronizzata, mai nel file di salvataggio.
- **Badge nei risultati di Google** (opzione, spenta di base): sulle pagine di ricerca Google segna con una scritta discreta "🏷 N codici" i risultati di siti per cui hai già codici sul computer. Nessun logo.
- **Codici dai siti di coupon aperti da te** (opzione, spenta di base): quando apri tu un sito di coupon (elenco statico in `recipes/siti-coupon.json` oppure titolo/indirizzo con "codici sconto", "coupon", "promo code"), legge i codici GIÀ VISIBILI nella pagina e li assegna al negozio (link "Vai a zalando.it", domini scritti nella pagina o nome nell'indirizzo abbinato a un sito che conosci già). Non clicca mai "mostra codice" e non legge il testo nascosto o sfocato. Fonte "sito di coupon (aperto da te)". Ogni sito ha i suoi termini d'uso: controllali.
- **Promemoria cashback** (opzione, spenta di base): scegli Beruby, TopCashback, iGraal, Payback, LetyShops o "Altro" con un tuo indirizzo, e se vuoi l'elenco dei negozi (oppure "tutti"). Alla cassa compare un avviso a parte ("Hai il cashback su ...: aprilo da lì prima di pagare") con un link semplice alla home del servizio. In "Risparmi" c'è il **registro cashback** a mano (negozio, importo, data, stato in attesa / accreditato / mancante) con un promemoria se qualcosa è "in attesa" da più di 90 giorni.
- **Modalità solo icona** (Opzioni): niente scheda sulla pagina, solo il numero sull'icona. Di base la scheda è piccola, in basso a destra, sparisce da sola dopo 12 secondi, non riappare nella stessa pagina una volta chiusa e non copre mai i pulsanti di pagamento (si sposta in un altro angolo o non compare).
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
La funzione è nel codice, **spenta di base** (casella "Condividi codici funzionanti (anonimo)" nelle Opzioni). Quando è accesa invia solo sito, codice, esito e percentuale. Si condividono SOLO: codici trovati sulle pagine pubbliche del negozio (non personali), codici comuni e codici condivisi che hai riconfermato. Non si condividono MAI: codici scritti a mano, codici delle email, dei siti di coupon, delle fonti che scegli tu, né codici che sembrano personali (pagine di account/ordini/referral, "il tuo codice", "esclusivo per te"). Prima di una prova scarica i codici condivisi (fonte "condivisi").
Cosa serve per attivarla in produzione:
1. **Database**: applica `supabase/migrations/20261108120000_cacciasconti.sql` al progetto Supabase (tabelle `cacciasconti_*`, RLS accesa senza policy pubbliche, vista `cacciasconti_stats_30g`, pulizia notturna con pg_cron: segnalazioni dopo 90 giorni, hash dopo 24 ore).
2. **Funzione**: pubblica `supabase/functions/cacciasconti-codici` (`verify_jwt = false` in `supabase/config.toml`; segreti: `CACCIASCONTI_SALE` casuale lungo, opzionale `CACCIASCONTI_APIKEY`). Valida dominio e codice, limite 60 segnalazioni/ora per hash IP (indirizzo = `cf-connecting-ip`, altrimenti l'ULTIMO elemento di `x-forwarded-for`), senza `CACCIASCONTI_SALE` risponde 503, corpo massimo 2 KB, GET max 20 codici con almeno 2 successi e almeno il 50% di successi nei 30 giorni (contro i codici avvelenati).
3. **Estensione**: in `background.js` la costante `ENDPOINT_CONDIVISO` punta già a `https://udubhzamghhlkxgepmmc.supabase.co/functions/v1/cacciasconti-codici`; metti la chiave pubblica nella costante `SUPABASE_ANON_KEY` (oggi vuota) se la funzione richiede `apikey`.
4. **Informativa**: `privacy.html` e la scheda degli store (`STORE.md`) descrivono già l'invio, ma sono una **BOZZA**: falle controllare (privacy/legale) prima della distribuzione pubblica.
Niente è stato pubblicato da questa cartella.

## Codici dalle email nel tuo Supabase: come accenderli
1. **Tabella**: applica `supabase/migrations/20261108130000_cacciasconti_codici_email.sql` (tabella `cacciasconti_codici_email` con `domain, code, sconto, scade_il, email_data (data), mittente, created_at`, unica per dominio+codice, RLS accesa senza policy, lavoro pg_cron `cacciasconti_email_pulizia` ogni notte alle 03:20 UTC: via 7 giorni dopo la scadenza o dopo 180 giorni dalla creazione; il file è identico alla tabella già attiva). La tua automazione giornaliera ci scrive con la chiave di servizio.
2. **Funzione**: ripubblica `supabase/functions/cacciasconti-codici` e imposta il segreto `CACCIASCONTI_TOKEN_PERSONALE` (testo casuale di **almeno 32 caratteri**, per esempio da `openssl rand -hex 24`). Dopo 10 chiavi sbagliate in un'ora dallo stesso indirizzo (se ne tiene solo l'hash, con il prefisso `tokerr|`, nella stessa tabella dei limiti) la funzione risponde 429 a qualunque chiave, anche a quella giusta (il contatore si legge con `cacciasconti_leggi`: applica anche `supabase/migrations/20261108140000_cacciasconti_leggi.sql`). I codici sono ordinati dal più recente (`email_data`, quelli senza data in fondo). `GET ?personali=1&domain=x` (senza `domain`: tutti i non scaduti, massimo 500) vuole l'intestazione `x-cacciasconti-token` uguale al segreto (confronto a tempo costante); senza segreto risponde 503, con chiave sbagliata 401. Non restituisce il mittente. La parte pubblica dei codici condivisi resta com'era.
3. **Estensione**: Opzioni > "Chiave personale codici email" > incolla lo stesso testo del segreto > Salva. Ogni 6 ore (timer `alarms`) i codici arrivano nell'archivio; prima di una prova si usano subito quelli già scaricati e, se sono più vecchi di 6 ore, l'aggiornamento parte in secondo piano (la prova non aspetta più di 0,3 secondi).

## Limiti dei nuovi pezzi
- Gmail: le classi della pagina di Gmail (`div.adn`, `div.a3s`, `span.gD`) non sono documentate e Google può cambiarle. Provato su una pagina Gmail finta con quelle classi, non su Gmail vero.
- Siti di coupon: i link dei siti di coupon spesso passano da reindirizzamenti: se non si capisce il negozio (nessun nome di sito nella pagina e nessun sito che conosci già con quel nome) i codici NON vengono assegnati. Non si inventa.
- Prezzi: se il sito non scrive il prezzo in dati strutturati o in una delle forme sopra, la pagina non viene riconosciuta. Il controllo in secondo piano non vede i prezzi che il sito disegna solo con JavaScript. Anche le pagine che mostrano il prezzo solo dopo JavaScript non si possono controllare in secondo piano (il popup lo dice): per quelle conta la visita. I timer (permesso `alarms`, che non mostra nessun avviso all'installazione) servono solo al controllo giornaliero dei prodotti che segui e all'aggiornamento ogni 6 ore dei codici personali; in più i controlli partono all'avvio del browser e all'apertura delle pagine.
- Notifiche: dipendono dalle impostazioni del sistema operativo (non disturbare, ecc.).
- Cashback: è solo un promemoria; non verifichiamo se il negozio è davvero nel servizio.
- Il ricaricamento automatico (`chrome.runtime.reload`) non si è potuto provare nell'ambiente di prova (in Chromium lanciato da Playwright l'estensione sparisce dopo il reload): per questo è una casella facoltativa e di base resta l'avviso con il pulsante. Il controllo della versione su disco e l'avviso sono provati.
- Gli script PowerShell non sono stati eseguiti (nessun PowerShell nell'ambiente di prova): provali una volta a mano.
- Firefox: controllo con `web-ext lint` (0 errori) e prova dal vivo con `test/firefox.js` (Firefox 128 o più nuovo, geckodriver).

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
- `notifications`: mostra l'avviso "il prezzo è sceso" per i soli prodotti che segui. Nient'altro.
- `host_permissions: <all_urls>`: serve per leggere il testo delle pagine alla ricerca di codici e per scrivere nel campo coupon su qualsiasi negozio (non si possono elencare tutti i siti), e per scaricare le poche pagine promo dello stesso negozio e, se accendi la condivisione, parlare con il servizio dei codici condivisi. Il testo delle pagine si legge solo sul tuo computer per trovare codici; l'estensione non salva e non invia altro.
Moduli con indirizzi propri: `google.js` gira solo su `google.*/search`, `gmail.js` solo su `mail.google.com`. 
- `alarms`: due timer, nessun avviso all'installazione: controllo giornaliero dei prezzi dei soli prodotti che segui e aggiornamento ogni 6 ore dei codici personali (se hai messo la chiave). Il controllo degli aggiornamenti da cartella parte all'avvio e all'apertura della finestra.
Non ci sono i permessi `cookies` e `activeTab` (con `<all_urls>` sarebbe ridondante). L'estensione non legge né modifica i cookie.

## Privacy
- **Di base** (condivisione spenta) non viene inviato nulla a Cacciasconti: nessuna statistica, nessun account. Le uniche richieste di rete sono quelle dell'esploratore verso lo STESSO negozio che stai visitando (poche pagine pubbliche, senza cookie).
- **Se accendi "Condividi codici funzionanti (anonimo)"** (Opzioni, spenta di base) l'estensione parla con un servizio di Cacciasconti ospitato su Supabase: prima di una prova **scarica** i codici segnalati per il sito che stai visitando (la richiesta contiene il dominio del negozio) e dopo ogni prova **invia** solo sito (dominio), codice, se ha funzionato e la percentuale di sconto. Si condividono SOLO: codici trovati sulle pagine pubbliche del negozio (non personali), codici comuni e codici condivisi che hai riconfermato. Non si condividono MAI: codici scritti a mano, codici delle email, dei siti di coupon, delle fonti che scegli tu, né codici che sembrano personali (pagine di account/ordini/referral, "il tuo codice", "esclusivo per te"). L'indirizzo IP non viene salvato: si tiene solo un hash con sale giornaliero, cancellato dopo 24 ore; le segnalazioni si cancellano dopo 90 giorni. Il servizio è una BOZZA da far controllare (vedi sotto).
- Il testo delle pagine che visiti si legge solo sul tuo computer per trovare codici; non si salva e non si invia altro che i codici trovati (e solo sul tuo computer). Lo stesso vale per i messaggi che apri in Gmail: il testo non esce dalla pagina.
- Storico prezzi: solo sul tuo computer. Per i prodotti che segui, una volta al giorno l'estensione scarica la pagina di quel prodotto (senza cookie).
- Chiave personale: se la inserisci, l'estensione parla con il TUO servizio (il tuo Supabase) mandando la chiave e il dominio del negozio; i codici ricevuti restano sul tuo computer.
- Nessun codice eseguibile scaricato da internet. **Nessun link di affiliazione, nessuna modifica ai cookie, nessun identificativo di tracciamento.** Vedi `privacy.html`.

## Perché è diversa da Honey e CouponBirds
Onestà prima di tutto:
- Honey e CouponBirds hanno grandi database condivisi di codici, aggiornati da milioni di utenti. **Noi no**: abbiamo solo i codici che trovi tu, quelli che aggiungi e una piccola lista di codici comuni. Su molti negozi troveranno più codici di noi.
- Cacciasconti è locale e trasparente: il codice è tutto in questa cartella e si può leggere, di base non invia nulla a nessuno (la condivisione anonima è facoltativa e spenta) e non ha affiliazioni.
- Sulla polemica di Honey (presentata qui come accusa, non come fatto accertato): nel dicembre 2024 lo YouTuber MegaLag ha accusato Honey di riassegnare a sé le commissioni di affiliazione dei creatori di contenuti; PayPal ha risposto di seguire le regole del settore (attribuzione all'ultimo clic); nel marzo 2025 Google ha aggiornato la politica del Chrome Web Store sugli affiliati; dal dicembre 2024 sono state depositate azioni collettive, la prima archiviata nel novembre 2025 (fonte: en.wikipedia.org/wiki/PayPal_Honey). **Cacciasconti non inserisce link di affiliazione né propri codici di tracciamento** e non tocca i cookie (per questo non chiede il permesso `cookies`; i permessi sono solo `storage`, `scripting` e `notifications`).
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
