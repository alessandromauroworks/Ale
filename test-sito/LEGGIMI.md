# Collaudo del sito

Controlla con un browser vero (Chromium) che il sito funzioni su telefono e computer. Non va online.

## Come si lancia
1. Una volta sola: `cd test-sito && npm install && npx playwright install chromium`
   (se `axe-core` è già installato in `questionario/test/node_modules`, lo usa da lì).
2. Dalla radice del repo: `node test-sito/collaudo.cjs`
   Parte da solo un server di prova sulla porta 8812 (serve `python3`). Screenshot in una cartella temporanea
   o in quella indicata con `SHOT_DIR=/percorso`. Dura alcuni minuti.

Alla fine c'è la riga `TOTALE: ... passati, ... falliti`. Se i falliti non sono zero, esce con errore.
Ogni richiesta verso internet è bloccata: non parte nessun dato vero.

## Cosa controlla
1. Tutte le pagine (sitemap + strumenti + 404) a 320, 390, 768, 1280 e 1440 px: si aprono, niente scroll di lato,
   zero errori in console, accessibilità (axe-core: zero problemi seri o critici a 390 e 1280), un solo titolo h1, nessuna scritta Lovable.
2. Tutti i link interni (anche le ancore `#`) esistono.
3. Le 6 demo con **ogni** settore del questionario, a 390 e 1280: si aprono con clic o tastiera, hanno l'etichetta
   «Esempio con dati inventati», usano il settore scelto, non escono dallo schermo, si chiudono con Esc, con la X o da tastiera
   e il focus torna al pulsante. A 1280 prova anche un'azione per demo. Ogni pagina servizio apre la sua demo.
4. Menu del telefono (apre/chiude con Esc) e «Vai al contenuto» con il primo Tab.
5. Movimento ridotto: nessuna animazione di comparsa, tutto visibile subito.
6. Velocità: prima schermata sotto i 2 secondi con la CPU rallentata 4 volte.
7. Prenota una call: con `PRENOTA_URL` vuoto propone WhatsApp ed email e non ci sono link rotti; con un link di prova
   (`calendar.app.google`) il pulsante apre il calendario e anche il questionario legge lo stesso link.
8. SEO: title, description, canonical, Open Graph, favicon, lingua; robots e noindex sulle pagine personali.
9. Screenshot di home, una pagina servizio, prenota e ogni demo a 390 e 1280.

## Quando si cambia qualcosa
Testi e pagine: `sorgente-sito/testi.mjs` e `sorgente-sito/genera.mjs`, poi `node sorgente-sito/genera.mjs`, poi questo collaudo
e quello del questionario (`node questionario/test/collaudo.mjs`).
