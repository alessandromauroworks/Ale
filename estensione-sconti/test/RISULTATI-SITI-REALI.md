# Prova su negozi veri e su Firefox vero (Cacciasconti 1.3.0)

Data prova: 2026-11-08. Niente account, niente pagamenti, niente dati personali (nei negozi demo non si è scritta nessuna email né nessun indirizzo). Codici inventati o creati da noi, mai più di 5 per sito.

## Risultato in parole semplici
- **WooCommerce VERO, con IVA inclusa nei prezzi: provato e funziona** (carrello e cassa, a blocchi e classici). È il caso che nella 1.2.1 sbagliava: il totale letto era la nota "(include 5,41 € IVA)" e il risparmio risultava -1,80 € invece di -10 € (vedi sotto).
- **OpenCart 4.1.0.3 VERO (installato in locale): provato.** Trovato e corretto un difetto: il pulsante "Apply Coupon" sta FUORI dal `<form>` (collegato con `form="form-coupon"`) e l'estensione non lo vedeva. Ora il codice si applica. In questa versione di OpenCart il pulsante "Remove" del coupon restituisce una pagina di errore (non toglie niente): per questo l'estensione si ferma al primo codice che funziona e lo dice.
- **Shopify (Dawn demo ufficiale): raggiunto, prodotto nel carrello, cassa aperta; il campo del codice NON c'è.** Né nella pagina del carrello né nella cassa prima di inserire email e indirizzo. Mi sono fermato lì (regola: niente dati personali). Il totale (395,00 $) si legge giusto sia nel carrello sia nella cassa.
- **PrestaShop demo: NON provabile da qui.** `demo.prestashop.com` è solo la pagina di ingresso: crea un negozio su un sottodominio CASUALE (es. `goofy-wine.demo.prestashop.com`) che il proxy rifiuta (403 / `net::ERR_TUNNEL_CONNECTION_FAILED`); `fo.demo.prestashop.com` risponde `502 error code: 502` (Cloudflare) e `api.demo.prestashop.com` risponde `400 Bad Request` alla radice. Non aggirato.
- **Firefox 159.0.1 VERO: provato dal vivo** (vedi sezione sotto): 11 controlli su 11.
- **PowerShell 7.5.1 per Linux: provato** (sintassi, esecuzione vera di `aggiorna.ps1` su un repository git locale, parametri dell'installatore); vedi sezione sotto.

## Tabella negozi veri
Codici provati su ogni sito: PROVA99, WELCOME10, BENVENUTO10 (inventati: non esistono) più SCONTO10 e ESTATE20 (creati da noi). Prodotto nel carrello: Tazza 30,00 € (IVA 22% inclusa, quindi 5,41 € di IVA), ESTATE20 = -6 €, SCONTO10 = -10 €.

| Sito | Raggiunto | Campo | Pulsante | Totale letto | Errore riconosciuto | Codice migliore applicato | Tempo |
|---|---|---|---|---|---|---|---|
| WooCommerce vero, IVA inclusa, carrello a blocchi | sì | sì, dietro "Add coupons" | sì | 30 € -> 20 € (la 1.2.1 leggeva 5,41 € -> 3,61 €) | sì: 3 inventati "non valido" | SCONTO10 (-10 €) | 23 s |
| WooCommerce vero, IVA inclusa, cassa a blocchi | sì | sì, dietro "Add coupons" | sì | 30 € -> 20 € | sì | SCONTO10 (-10 €) | 23 s |
| WooCommerce vero, IVA inclusa, carrello classico | sì | sì | sì ("Apply coupon") | 30 € -> 20 € | sì | SCONTO10 (-10 €) | 8 s |
| WooCommerce vero, IVA inclusa, cassa classica | sì | sì, dietro "Click here to enter your code" | sì | 30 € -> 20 € | sì | SCONTO10 (-10 €) | 9 s |
| WooCommerce vero, SENZA IVA (configurazione della 1.2.1) | sì | sì | sì | 30 € -> 20 € | sì | SCONTO10 (-10 €) | vedi sotto (ripetuta) |
| OpenCart 4.1.0.3 vero (locale), carrello | sì | sì, dietro "Use Coupon Code" | sì (fuori dal form, `form=`) | 122 $ -> 98 $ (IVA 20% e eco-tassa ricalcolate dal negozio) | sì: "Warning: Coupon is either invalid, expired or reached its usage limit!" | ESTATE20 (-24 $); si ferma lì perché il "Remove" di OpenCart 4.1.0.3 non funziona | 9 s |
| Shopify Dawn demo, pagina carrello | sì | NO (nel carrello Dawn non c'è) | - | 395 $ | - | - | - |
| Shopify Dawn demo, cassa prima di email/indirizzo | sì | NO (nessun campo "discount" nel DOM; gli script di `cdn.shopify.com` sono bloccati dal proxy, quindi non si sa se arriverebbe da script) | - | 395 $ | - | - | - |
| PrestaShop demo | solo ingresso | non provato | | | | | - |
| OpenCart demo (demo.opencart.com) | no (403 Cloudflare anti-robot, non aggirato) | non provato | | | | | - |

Shopify: nel negozio demo il prodotto "Small Convertible Flex Bag" è esaurito; il test usa "Louise Slide Sandal". Gli host `cdn.shopify.com`, `checkout.pci.shopifyinc.com` e `*.shopifysvc.com` sono rifiutati dal proxy (`ERR_TUNNEL_CONNECTION_FAILED`): la pagina arriva ma senza gli script del tema.

## Il difetto dell'IVA, con le prove
Con WooCommerce vero e prezzi con IVA inclusa, la cassa scrive `Totale 30,00 € (include 5,41 € IVA)` (classico: `<small class="includes_tax">`; blocchi: `<p class="...footer-item-tax">Including 5,41 € in taxes</p>` con lo stesso nome di classe `...footer-item-tax-value` sia sul totale sia sull'IVA). La 1.2.1 prendeva l'ULTIMO importo = l'IVA: stessa prova, stessa rete, vecchio codice: "5.41 € -> dopo il test 3.61 €", codice migliore "SCONTO10 (-1.8 €)" (sbagliato: il vero risparmio è 10 €). La 1.3.0 ignora le note sulle tasse (classi `includes_tax`, `tax_label`, `...item__description`, `...footer-item-tax`, tag `<small>`, testo tra parentesi con IVA/VAT/tax) e legge il primo importo "forte" (strong/bdi) del totale.

## Firefox 159.0.1 dal vivo (`test/firefox.js`)
Firefox scaricato da ftp.mozilla.org, pilotato con geckodriver 0.36.0 e selenium-webdriver; l'estensione (pacchetto `-firefox.zip`, manifest con `background.scripts`) è installata come componente temporaneo; negozi finti di `test/server.js`. Risultato: **11 passati, 0 falliti**:
- il popup si apre e legge la versione; il permesso sui siti (`<all_urls>`) risulta concesso all'installazione temporanea;
- il Cercatore (content script) trova ESTATE20 nel testo della pagina; compare la scheda "codici da provare";
- il Tester applica il migliore: "Risparmi 20,00 € con ESTATE20" (WooCommerce con ricarica, e anche il negozio col pulsante spento e quello col campo nascosto dietro un link, -40 €); lo stato del negozio conferma il coupon applicato;
- il popup mostra l'elenco dei codici;
- onboarding dei permessi: con il permesso tolto (`permissions.remove`) il popup mostra "Dai il permesso". NON verificato: il clic su quel pulsante (apre la richiesta di Firefox, serve un gesto reale dell'utente: non automatizzabile con WebDriver).
Nessun difetto specifico di Firefox emerso. `web-ext lint` sul pacchetto Firefox: 0 errori, 5 avvisi (3 `innerHTML` con testo già ripulito, 2 perché `data_collection_permissions` è conosciuto solo da Firefox 140: su Firefox 128-139 la chiave viene ignorata, senza danni).
Come rifarla: `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 FIREFOX=<firefox> GECKODRIVER=<geckodriver> NODE_PATH=<cartella con selenium-webdriver> node test/firefox.js` (serve per aprire la scheda del popup, che WebDriver non può aprire con un indirizzo moz-extension://).

## PowerShell 7.5.1 (Linux), cartella `aggiorna/`
Verificato:
- Sintassi dei due script: nessun errore (`Parser::ParseFile`).
- `aggiorna.ps1` eseguito DAVVERO contro un repository git locale (`file://...`, copia nuda di questo repository, `uploadpack.allowFilter`): prima installazione (clone parziale `--filter=blob:none`, `sparse-checkout` della sola cartella `estensione-sconti`: nel disco restano solo quella cartella e i file in radice del repository), lettura della versione dal `manifest.json` ("Versione su disco: 1.3.0"), poi un commit nuovo nel "remoto" (1.3.1) -> "Aggiornato: 6b50d1a -> 9a25f6a", versione 1.3.1; seconda esecuzione senza novità -> "Già aggiornato."; repository ricordato in `repo.txt`; errori chiari senza repository e con ramo inesistente ("git clone non è riuscito").
- Corretti due difetti trovati provandolo: (1) il ramo non veniva ricordato, quindi una corsa a mano senza `-Ramo` passava a `main` (ora si ricorda in `ramo.txt`); (2) `git checkout ... 2>$null` con `$ErrorActionPreference='Stop'` in Windows PowerShell 5.1 può fermarsi per l'output su stderr che git scrive anche quando va bene (ora in un blocco con `Continue`).
- `installa-aggiornamento-automatico.ps1`: aggiunto `-Prova` (mostra programma, argomenti, orari e utente senza creare niente): verificato l'output e che un'ora non valida (`25:99`) dà errore chiaro.
NON verificato (impossibile su Linux): `Register-ScheduledTask`/`New-ScheduledTask*` (solo Windows), il collegamento `New-ItemType Junction` (su Linux il ramo di ripiego stampa "Collegamento non creato: usa ..."), Windows PowerShell 5.1 vero, `powershell.exe` chiamato dall'installatore.

## Difetti trovati con i negozi veri e corretti (1.3.0)
1. IVA inclusa: totale letto sbagliato (sopra).
2. OpenCart 4: pulsante "Apply Coupon" fuori dal `<form>` (attributo `form=`), non trovato.
3. OpenCart 4: dopo l'applicazione il riquadro "Use Coupon Code" si richiude: per togliere il codice ora si riapre l'interruttore e si riprova.
4. OpenCart 4: il pulsante "Remove" del prodotto ha solo `title="Remove"` e `formaction=...cart.remove`, senza classi "cart-item": ora si riconosce dall'azione (cart.remove, `?remove_item=`, `/cart/change`) e non si clicca mai.
Regressioni aggiunte al negozio finto (`test/server.js`: `ocf.` OpenCart 4, `vat.` IVA inclusa classica e a blocchi, `rmv.`, `est.`, `tro.`, `min.`, `jnk.`, `exp.`, `sel.`) e a `test/run.js`, sezione [v].

## Difetti trovati con la 1.2.1 (già corretti)
Vedi `CHANGELOG.md` (1.2.1): pulsante "Remove ... from cart" che svuotava il carrello, "Add coupons" che non si apriva, campo perso dopo aver tolto un codice, link "Click here to enter your code", messaggio "does not exist", totale letto durante i segnaposto grigi.

## Come rifare la prova
- WooCommerce locale: scarica WordPress, il plugin `sqlite-database-integration` e `woocommerce` da downloads.wordpress.org, installa con SQLite (`db.php`), crea prodotti e coupon via PHP (`WC_Tax::_insert_tax_rate`, `woocommerce_calc_taxes=yes`, `woocommerce_prices_include_tax=yes` per l'IVA), avvia `php -S 127.0.0.1:9401 -t <cartella wordpress> router.php`, poi `WOO_BASE=http://127.0.0.1:9401 WOO_PID=<id prodotto> WOO_SOLO=1 node test/siti-reali.js`. (Il server PHP va avviato con `-t` sulla cartella di WordPress, altrimenti i file statici di WooCommerce danno 404 e i blocchi non partono.)
- OpenCart locale: release zip da github.com/opencart/opencart/releases, MariaDB (`apt-get install mariadb-server`, avvio con `mysqld_safe`), `php upload/install/cli_install.php install ...`, coupon con SQL in `oc_coupon`, `php -S 127.0.0.1:9402 -t upload`, poi `OC_BASE=http://127.0.0.1:9402 OC_SOLO=1 node test/siti-reali.js`.
- Siti demo: `SOLO=shopify,prestashop node test/siti-reali.js` da una rete che li raggiunga. Nel repository non c'è nulla di WordPress, OpenCart o Firefox.
