# Prova su negozi demo pubblici (Cacciasconti 1.2.0)

Data prova: 2026-11-08. Solo negozi DEMO, niente account, niente pagamenti, niente dati personali, al massimo 5 codici inventati per sito.

## Risultato in parole semplici
**Non è stato possibile provare nessun sito vero: la rete di questa macchina blocca tutti i negozi demo.** Il proxy di uscita risponde "403" alla richiesta di connessione (Chromium: `net::ERR_TUNNEL_CONNECTION_FAILED`). Sono bloccati anche `example.com` e `www.google.com`: la rete lascia passare solo pochi indirizzi. Non ho aggirato il blocco. Quindi le colonne sul campo coupon, pulsante, totale, messaggio di errore e tempo sono **vuote: non provate**.

Host bloccati (403 dal proxy): themes.woocommerce.com, themes.shopify.com, magento.softwaretestingboard.com, demo.prestashop.com, demo.opencart.com, magento2-demo.mageplaza.com, demo.mage2.com, luma.enablers.dev, dawn-theme.myshopify.com, themes-dawn-demo.myshopify.com, demo.vuestorefront.io, woocommerce.com, demostore.woocommerce.com, wp-themes.com.

## Tabella (generata da `node test/siti-reali.js`)
| Negozio | Raggiunto | Campo coupon | Pulsante applica | Totale letto | Messaggio di errore riconosciuto | Tempo | Note |
|---|---|---|---|---|---|---|---|
| WooCommerce Storefront (demo ufficiale) (themes.woocommerce.com) | no | - | - | - | - | - | net::ERR_TUNNEL_CONNECTION_FAILED at https://themes.woocommerce.com/storefront/ |
| Shopify tema Dawn (anteprima ufficiale) (themes.shopify.com) | no | - | - | - | - | - | net::ERR_TUNNEL_CONNECTION_FAILED at https://themes.shopify.com/themes/dawn/styles/default/preview |
| Magento Luma (demo pubblica) (magento.softwaretestingboard.com) | no | - | - | - | - | - | net::ERR_TUNNEL_CONNECTION_FAILED at https://magento.softwaretestingboard.com/ |
| PrestaShop (demo ufficiale) (demo.prestashop.com) | no | - | - | - | - | - | net::ERR_TUNNEL_CONNECTION_FAILED at https://demo.prestashop.com/ |
| OpenCart (demo ufficiale, extra) (demo.opencart.com) | no | - | - | - | - | - | net::ERR_TUNNEL_CONNECTION_FAILED at https://demo.opencart.com/ |

## Cosa è stato provato al posto dei siti veri
Con negozi finti locali (nel test automatico `node test/run.js`, 129 prove) che riproducono il markup noto dei demo, **non** i siti veri:
| Piattaforma simulata | Campo | Pulsante | Totale | Errore riconosciuto | Esito |
|---|---|---|---|---|---|
| WooCommerce (ricarica completa della pagina) | sì | sì | sì | "Codice non valido" | provato, ok |
| Magento Luma ("Apply Discount Code", campo nascosto, totale in $) | sì (dietro il titolo, correzione fatta) | sì | sì | "is not valid" | provato, ok |
| PrestaShop ("Have a promo code?", pulsante "Add") | sì (dietro il link) | sì | sì | "does not exist" | provato, ok |
| Shopify | non simulato: il campo sconto sta nella cassa (richiede email) e nel carrello del tema Dawn non c'è | | | | NON provato |

Difetto trovato e corretto grazie alla simulazione: il campo dietro "Apply Discount Code" (Magento) non veniva aperto. Lo script `test/siti-reali.js` è pronto: va rilanciato da una rete che raggiunga i demo; i passi per arrivare al carrello (aggiunta del prodotto) sono scritti ma non verificati dal vivo e potrebbero richiedere ritocchi.
