# Novità

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
