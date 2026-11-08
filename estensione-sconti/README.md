# Cacciasconti

Estensione per Chrome, Edge, Brave e Opera (stesso pacchetto, Manifest V3). Al momento del pagamento prova i codici sconto per te e applica il migliore.

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

Per pubblicarla negli store guarda `STORE.md`.

## Come si usa
1. Naviga normalmente: l'estensione raccoglie i codici che i negozi mostrano.
2. Vai al carrello o alla cassa. Se c'è un campo codice sconto, compare la scheda in basso a destra.
3. Premi **Genera sconto** (sulla scheda o nella finestra dell'estensione). Guarda il pannello sulla pagina: mostra il codice in prova, ✓/✗ per ognuno e il pulsante **Stop**. Non toccare la pagina mentre lavora.
4. Alla fine vedi ad esempio "Risparmi 12,40 € con SCONTO15 (12 codici provati in 9 s)" oppure "Nessun codice funzionante trovato".
5. Puoi aggiungere un codice a mano, regolare quanti codici provare al massimo (predefinito 20) e usare **Riprova anche i codici che non funzionavano** (di norma i codici falliti da meno di 7 giorni vengono saltati).

Ordine di prova: prima i codici che hanno funzionato di recente (risparmio più alto prima), poi quelli trovati nelle pagine del sito (i più nuovi), i codici che non funzionano da più di 30 giorni, quelli aggiunti a mano e infine i comuni.

Sicurezze: massimo di codici per prova, pausa di 150-400 ms tra un tentativo e l'altro, stop se compare un captcha o se il sito risponde "troppi tentativi" 3 volte di seguito. L'estensione tocca solo il campo del codice e il suo pulsante: mai i campi di pagamento, email o indirizzo.

## Permessi (e perché)
- `storage`: salva sul tuo computer codici, risultati, risparmi e impostazioni.
- `activeTab`: agisce sulla scheda che stai guardando quando premi il pulsante.
- `scripting`: carica lo script in una scheda già aperta prima dell'installazione.
- `host_permissions: <all_urls>`: serve per cercare i codici e scrivere nel campo coupon su qualsiasi negozio (non si possono elencare tutti i siti). Non legge password né dati di pagamento.
Non c'è il permesso `cookies`: l'estensione non legge né modifica i cookie.

## Privacy
Niente lascia il tuo computer. Nessuna statistica, nessun server, nessun codice scaricato da internet. **Nessun link di affiliazione, nessuna modifica ai cookie, nessun identificativo di tracciamento.** Vedi `privacy.html`.

## Perché è diversa da Honey e CouponBirds
Onestà prima di tutto:
- Honey e CouponBirds hanno grandi database condivisi di codici, aggiornati da milioni di utenti. **Noi no**: abbiamo solo i codici che trovi tu, quelli che aggiungi e una piccola lista di codici comuni. Su molti negozi troveranno più codici di noi.
- Cacciasconti è locale e trasparente: il codice è tutto in questa cartella e si può leggere, non invia nulla a nessuno e non ha affiliazioni.
- Nel dicembre 2024 un'inchiesta pubblica ha sostenuto che Honey, durante gli acquisti, sostituiva i cookie di affiliazione dei creatori di contenuti con i propri. Cacciasconti non tocca i cookie e non usa link di affiliazione, quindi non può farlo: per questo non chiede il permesso `cookies`.
- Non copiamo né nome né grafica di altre estensioni.

## Limiti onesti
- Non può avere i codici di tutto il mondo: prova solo quelli trovati, aggiunti o comuni.
- Non funziona su ogni cassa: alcune (campo dentro un frame di pagamento, siti molto personalizzati) non si riescono a leggere.
- Alcuni siti bloccano o rallentano i tentativi ripetuti: in quel caso l'estensione si ferma.
- I codici personali (legati a un account o a un'email) non funzionano per altri.
- Se il sito non permette di togliere un codice, l'estensione si ferma al primo che funziona.
- Il risparmio mostrato è quello che il sito indica sul totale: controlla sempre il totale prima di pagare.

## Prove automatiche
`node test/run.js` avvia tre negozi finti (WooCommerce con ricarica, negozio tipo React con risposta lenta, campo nascosto dietro un link) e Chromium con l'estensione. Serve Playwright. Con `--screenshot` rifà le immagini in `store/`.
