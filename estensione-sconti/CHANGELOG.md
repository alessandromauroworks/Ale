# Novità

## 1.4.0
Prezzi, email e altre fonti di codici, tutte spente o solo locali di base.
- **Storico prezzi**: sulle pagine prodotto (JSON-LD, OpenGraph, microdata, Shopify, WooCommerce) salva un prezzo al giorno sul tuo computer (massimo 500 prodotti). Scheda **Prezzi** nella finestra: mini grafico, minimo, massimo, prezzo di oggi.
- **Avvisami se scende**: per i prodotti che scegli tu. Ad ogni visita, e una volta al giorno in secondo piano (senza cookie, rispettando robots.txt), se il prezzo è sceso arriva una notifica. Nuovo permesso: `notifications`.
- **Cerca anche su**: pulsanti Amazon.it, Google Shopping, Idealo.it, Trovaprezzi.it con il nome del prodotto (si apre una scheda solo quando clicchi).
- **Spedizione gratuita**: "Ti mancano 7,10 € per la spedizione gratuita" nella scheda, nel pannello e nella finestra.
- **Gmail**: quando apri un messaggio, cerca i codici nel testo e li salva per il negozio (fonte "email"). Solo sul tuo computer.
- **Codici dalle tue email (automatico)**: chiave personale nelle Opzioni; ogni 6 ore e prima di una prova scarica dal tuo Supabase i codici non scaduti. La chiave resta solo qui (mai sincronizzata, mai nei salvataggi).
- **Google**: opzione (spenta) che segna i risultati con "🏷 N codici" per i siti di cui hai codici.
- **Siti di coupon aperti da te**: opzione (spenta) che legge i codici già visibili nella pagina e li assegna al negozio. Non clicca mai "mostra codice".
- **Cashback**: promemoria alla cassa (opzione spenta) con link semplice al servizio scelto, e **registro cashback** a mano con promemoria dopo 90 giorni "in attesa".
- **Modalità solo icona** e scheda più educata: in basso a destra, sparisce dopo 12 secondi, non torna nella stessa pagina e non copre mai i pulsanti di pagamento.
- Servizio dei codici (bozza): nuova lettura `?personali=1` protetta da `CACCIASCONTI_TOKEN_PERSONALE` (503 se manca il segreto, 401 se la chiave non è giusta).

## 1.3.0
Correzioni dopo la revisione indipendente.
- Il pulsante "rimuovi" non può più togliere un prodotto dal carrello: dentro una riga prodotto non si clicca mai, anche se nel testo ci sono parole come "Promo" o "Codice".
- IVA inclusa (WooCommerce classico e a blocchi): il totale non viene più confuso con la nota "(include X € IVA)". Prima il risparmio poteva risultare sbagliato.
- Messaggi del sito: un errore o un "aggiunto al carrello" che non c'entra con il coupon non fa più segnare un codice buono come "non funziona" (o uno sbagliato come "funziona"). "Troppi tentativi" si riconosce in qualunque messaggio.
- Nuovo stato "da riprovare": importo minimo, non applicabile a questo carrello, carrello vuoto, totale non leggibile, troppi tentativi non fanno più scartare il codice per 7 giorni. Il codice con "importo minimo" torna in coda quando il carrello cresce.
- Un solo "Genera sconto" alla volta, anche con due clic veloci.
- Meno codici inventati: parole come "ITALIA" o "NUOVO" dentro elementi con classe "promo" o "code" non vengono più salvate (serve una cifra o un contesto coupon/voucher/sconto) e, se salvate, si provano dopo quelle scritte a mano. L'archivio si ripulisce da solo (massimo 40 codici per sito, 200 siti, via i codici mai provati da più di 60 giorni).
- Se la pagina scrive una scadenza ("scade il 30/11", "valido fino al 31/12/2026", "expires Dec 5") i codici scaduti non si provano.
- L'estensione ricorda per ogni sito il campo e il pulsante che hanno funzionato.
- L'esploratore segna "fatto oggi" solo dopo uno scarico riuscito.
- Permessi: tolti "alarms" e "activeTab" (restano "storage" e "scripting"). Il controllo degli aggiornamenti da cartella ora parte all'avvio e quando apri la finestra.
- Firefox: serve la versione 128 o più nuova.
- Testi di privacy e scheda dello store riscritti: spiegano cosa viene inviato quando accendi la condivisione.
- Servizio dei codici condivisi (bozza): il limite per ora usa l'ultimo indirizzo di x-forwarded-for (o cf-connecting-ip), senza sale non accetta segnalazioni (503), l'elenco pubblico mostra solo codici con almeno 2 successi e almeno il 50% di successi nei 30 giorni.

## 1.2.1
- Provata su un WooCommerce vero (carrello e cassa, sia classici sia a blocchi): ora trova il campo anche dietro "Add coupons" e "Click here to enter your code".
- Corretto un errore grave: su WooCommerce a blocchi e su alcuni negozi Shopify poteva cliccare "Remove ... from cart" e svuotare il carrello invece di togliere il codice sconto. Ora non tocca mai i pulsanti che tolgono un prodotto.
- "Coupon ... does not exist" è ora riconosciuto come codice non valido (prima veniva segnato "non applicabile").
- Aspetta che i totali tornino leggibili quando il negozio mostra i segnaposto grigi mentre ricalcola.

## 1.2.0
- Funziona anche su Firefox (stesso codice).
- Cerca i codici anche nelle pagine promo del negozio (una volta al giorno, rispetta robots.txt) e in fonti che scegli tu.
- Codici condivisi in modo anonimo: spenti di base, li accendi tu dalle Opzioni.
- Aggiornamento da cartella: se la cartella dell'estensione cambia, si ricarica da sola (ogni 6 ore).
- Il popup mostra la versione e queste novità.

## 1.1.0
- La valuta del negozio (euro, dollari, sterline, franchi) è mostrata giusta; i risparmi sono sommati per valuta.
- Casse dentro un iframe, campi dentro shadow DOM, pulsanti che non sono pulsanti, totali con formati diversi e prezzi vecchi barrati.
- Se il sito ridisegna il campo mentre scrivi, l'estensione lo ritrova.

## 1.0.0
- Prima versione: cerca i codici, li prova alla cassa e applica il migliore.
