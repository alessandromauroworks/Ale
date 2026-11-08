# Prova su negozi veri (Cacciasconti 1.2.1)

Data prova: 2026-11-08. Niente account, niente pagamenti, niente dati personali. Codici inventati o creati da noi, mai più di 5 per sito.

## Risultato in parole semplici
- **WooCommerce VERO: provato e funziona**, nei quattro casi: carrello a blocchi, cassa a blocchi, carrello classico (`[woocommerce_cart]`), cassa classica. Software vero (WordPress + plugin WooCommerce scaricato da wordpress.org, ultima versione), installato in locale con `php -S` e SQLite, valuta EUR, coupon `ESTATE20` (20%) e `SCONTO10` (10 € fissi). Il Cercatore trova `ESTATE20` scritto nella descrizione del prodotto, il Tester prova i codici, scarta quelli sbagliati con il motivo e applica il migliore.
- **PrestaShop demo e OpenCart demo: NON provati.** Sono raggiungibili solo le pagine di ingresso; il negozio vero sta su host bloccati dalla rete di questa macchina (non aggirati):
  - `demo.prestashop.com` carica il negozio in un iframe da **`fo.demo.prestashop.com`** e chiama **`api.demo.prestashop.com`**: entrambi rifiutati dal proxy (`net::ERR_TUNNEL_CONNECTION_FAILED`, 403 anche con curl, riprovato dopo 60 s).
  - `demo.opencart.com` risponde 403 "Just a moment..." (verifica anti-robot di Cloudflare, `server: cloudflare`): serve **`challenges.cloudflare.com`**, bloccato; e comunque non si deve aggirare una verifica anti-robot.
  - Restano bloccati `themes.woocommerce.com`, `themes.shopify.com`, `magento.softwaretestingboard.com` (come nel primo tentativo).
- Quindi PrestaShop, OpenCart, Magento e Shopify restano provati solo sui negozi finti (vedi più sotto), non su siti veri.

## Tabella (generata da `WOO_BASE=http://127.0.0.1:9401 WOO_PID=11 WOO_SOLO=1 node test/siti-reali.js` e da `node test/siti-reali.js`)
Codici provati su ogni sito: PROVA99, WELCOME10, BENVENUTO10 (inventati: non esistono) più SCONTO10 e ESTATE20 (creati da noi). Prodotto nel carrello: Tazza 30,00 €, quindi ESTATE20 = -6 €, SCONTO10 = -10 €.

| Sito | Raggiunto | Campo | Pulsante | Totale letto | Errore riconosciuto | Codice migliore applicato | Tempo |
|---|---|---|---|---|---|---|---|
| WooCommerce vero, carrello a blocchi | sì | sì, dietro "Add coupons" | sì (clic su "Apply") | 30 € -> 20 € dopo il test | sì: i 3 codici inventati "non valido" ("cannot be applied because it does not exist") | SCONTO10 (-10 €) | 23 s (*) |
| WooCommerce vero, cassa a blocchi | sì | sì, dietro "Add coupons" | sì | 30 € -> 20 € | sì, "non valido" | SCONTO10 (-10 €) | 23 s (*) |
| WooCommerce vero, carrello classico | sì | sì | sì ("Apply coupon") | 30 € -> 20 € | sì, "non valido" | SCONTO10 (-10 €) | 7 s |
| WooCommerce vero, cassa classica | sì | sì, dietro "Click here to enter your code" | sì | 30 € -> 20 € | sì, "non valido" | SCONTO10 (-10 €) | 8 s |
| PrestaShop demo (demo.prestashop.com) | solo la pagina di ingresso | non provato | non provato | non provato | non provato | non provato | - |
| OpenCart demo (demo.opencart.com) | no (403 Cloudflare) | non provato | non provato | non provato | non provato | non provato | - |
| WooCommerce Storefront, Shopify Dawn, Magento Luma (demo pubbliche) | no (host bloccati) | non provato | non provato | non provato | non provato | non provato | - |

(*) Il server di prova (`php -S`) è a un solo processo e WooCommerce a blocchi mostra i totali grigi per 2-3 secondi dopo ogni cambio; su un negozio vero i tempi saranno più brevi. Nella colonna "Pulsante" dei blocchi la diagnosi dice "uso Invio" perché a campo chiuso il pulsante non esiste ancora: durante la prova il clic su "Apply" avviene (verificato dai clic registrati).

## Difetti trovati con il WooCommerce vero e corretti (1.2.1)
1. **Grave: svuotava il carrello.** Per togliere un codice, la ricetta Shopify (`button[aria-label*='Remove']`, valida su tutti i siti) e la ricerca generica trovavano per prime il pulsante "Remove Maglia Prova from cart" dei blocchi WooCommerce e toglievano il prodotto, non il codice. Ora i pulsanti che toglierebbero un prodotto ("item", "product", "from cart", "dal carrello"...) sono scartati sempre; le ricette Shopify sono limitate alle righe sconto/coupon; "Remove" da solo vale solo dentro una riga di sconto; ricetta WooCommerce con il vero pulsante del codice (`.wc-block-components-chip__remove`).
2. **"Add coupons" non si apriva** nei blocchi: il clic andava al `<div role=heading>` che lo contiene, non al `<div role=button>` interno. Ora si clicca l'elemento più interno e si riprova se non si apre.
3. **Campo "perso" dopo aver tolto un codice**: i blocchi ridisegnano il riquadro; ora l'estensione aspetta fino a 3 secondi che campo o interruttore tornino.
4. **Cassa classica**: il link "Click here to enter your code" non contiene la parola coupon (solo l'etichetta `aria-label="Enter your coupon code"`). Ora si legge anche l'etichetta.
5. **Messaggio sbagliato**: "Coupon ... cannot be applied because it does not exist" veniva segnato "non applicabile"; ora "non valido".
6. **Totale letto durante i segnaposto grigi** (cassa a blocchi): leggeva il prezzo del prodotto (30 €) invece del totale, e concludeva "non riesco a togliere i codici" fermandosi al primo. Ora i totali in caricamento sono "non leggibili", l'attesa dell'esito aspetta che la lettura si assesti e il totale torni leggibile; aggiunto il selettore del totale dei blocchi.
Casi di regressione aggiunti al negozio finto (`test/server.js`: `wcb.` WooCommerce a blocchi con le stesse trappole, `wcc.` cassa classica; `test/run.js` sezione [u], 7 controlli).

## Cosa è stato provato sui negozi finti (non siti veri)
| Piattaforma simulata | Campo | Pulsante | Totale | Errore riconosciuto | Esito |
|---|---|---|---|---|---|
| WooCommerce (ricarica completa) | sì | sì | sì | "Codice non valido" | provato, ok |
| WooCommerce a blocchi e cassa classica (nuovi, copiano il markup vero) | sì | sì | sì | "does not exist" | provato, ok |
| Magento Luma ("Apply Discount Code") | sì (dietro il titolo) | sì | sì | "is not valid" | provato, ok |
| PrestaShop ("Have a promo code?") | sì (dietro il link) | sì | sì | "does not exist" | provato, ok |
| Shopify | non simulato: il campo sconto sta nella cassa (richiede email) | | | | NON provato |

## Come rifare la prova
- WooCommerce locale: scarica WordPress, il plugin `sqlite-database-integration` e `woocommerce` da downloads.wordpress.org, installa con SQLite (`db.php`), crea prodotti e coupon via PHP, avvia `php -S 127.0.0.1:9401`, poi `WOO_BASE=http://127.0.0.1:9401 WOO_PID=<id prodotto> WOO_SOLO=1 node test/siti-reali.js`. (WordPress Playground CLI da npm non è partito: `fetch failed` già al primo scaricamento in questa rete.) Non c'è nulla di WordPress nel repository.
- Siti demo: `node test/siti-reali.js` da una rete che li raggiunga.
