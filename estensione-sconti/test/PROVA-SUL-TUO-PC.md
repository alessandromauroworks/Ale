# Prova reale di Cacciasconti sul tuo PC (10 minuti)

## Prima: installa
1. Scarica il ramo `claude/nice-carson-w7ds07` (o `git pull`) e apri la cartella `estensione-sconti`.
2. Chrome → `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
3. Accendi «Modalità sviluppatore» → «Carica estensione non pacchettizzata» → scegli `estensione-sconti`.
4. Fissa l'icona di Cacciasconti nella barra.

## I 5 controlli
| # | Cosa fai | Cosa deve succedere | Ok? |
|---|---|---|---|
| 1 | Apri la home di un negozio con un banner «usa il codice …» | L'icona mostra un numero; nel popup c'è il codice con fonte «pagina» | |
| 2 | Metti un prodotto nel carrello, vai al carrello o alla cassa e premi «Genera sconto» | Pannello con i codici provati uno a uno, ✓/✗ con motivo, alla fine «Risparmi X € con …» oppure «Nessun codice funzionante» | |
| 3 | Controlla il carrello dopo la prova | Il prodotto è ancora lì; resta applicato solo il codice migliore | |
| 4 | Opzioni → accendi «Leggi i codici dalle email aperte in Gmail»; apri in Gmail una newsletter con un codice | Il codice compare nel popup di quel negozio, fonte «email» | |
| 5 | Apri una pagina prodotto, popup → scheda «Prezzi» → «Avvisami se scende» | Grafico con il prezzo di oggi; il prodotto risulta seguito | |

Se un controllo non va: scrivi a Claude il nome del sito, il numero del controllo e cosa vedi (meglio con uno screenshot).

## Se vuoi che la faccia Claude sul tuo PC
Apri Claude Code **sul tuo computer** nella cartella del repository `Ale` e incolla:

> Carica l'estensione `estensione-sconti` in Chrome con Playwright (`chromium.launchPersistentContext` con `--load-extension`, usando il mio profilo di prova, non quello principale), vai su <NEGOZIO>, metti un prodotto nel carrello, apri il carrello e lancia «Genera sconto». Non inserire dati personali e non pagare. Riportami la tabella dei codici provati e il totale prima/dopo, con uno screenshot.
