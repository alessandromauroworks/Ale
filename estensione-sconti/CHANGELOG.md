# Novità

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
