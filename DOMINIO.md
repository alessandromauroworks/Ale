# Dominio alessandromauroworks.it

Il sito è pronto su GitHub Pages. Oggi si apre su `https://alessandromauroworks.github.io/Ale/`.
Per averlo su **alessandromauroworks.it** servono questi passi.

## 1. Alessandro: compra il dominio
Su OVH compra `alessandromauroworks.it` e paga. Basta questo.
Dopo l'acquisto, il Registro dei domini .it può mandare un'email per confermare i dati: aprila e conferma (se non lo fai, il dominio può essere sospeso).

## 2. Claude: imposta i DNS su OVH (con il connettore ufficiale OVH)
Record da creare nella zona DNS di `alessandromauroworks.it` (controllati il 15/11/2026 sulla documentazione ufficiale di GitHub, pagina «Managing a custom domain for your GitHub Pages site»):

| Tipo | Nome | Valore |
|---|---|---|
| A | (vuoto, dominio principale) | 185.199.108.153 |
| A | (vuoto) | 185.199.109.153 |
| A | (vuoto) | 185.199.110.153 |
| A | (vuoto) | 185.199.111.153 |
| AAAA | (vuoto) | 2606:50c0:8000::153 |
| AAAA | (vuoto) | 2606:50c0:8001::153 |
| AAAA | (vuoto) | 2606:50c0:8002::153 |
| AAAA | (vuoto) | 2606:50c0:8003::153 |
| CNAME | www | alessandromauroworks.github.io. |

Prima vanno tolti i record A/AAAA/CNAME che OVH crea da solo sul dominio principale e su `www` (pagina di parcheggio), altrimenti si scontrano.
Il CNAME punta a `alessandromauroworks.github.io` **senza** `/Ale`.

## 3. Claude: aggiunge il file CNAME nel repo
Solo dopo i DNS: file `CNAME` nella radice del repo con una sola riga `alessandromauroworks.it`, commit e push su main.
(In alternativa: Settings → Pages → Custom domain → `alessandromauroworks.it` → Save; GitHub crea lo stesso file.)
Poi si controlla che `https://alessandromauroworks.it` si apra davvero.

## 4. Alessandro: due clic
- Se arriva, conferma l'email del Registro .it (vedi punto 1).
- Su GitHub: repo `Ale` → Settings → Pages → spunta **Enforce HTTPS**. La casella si attiva quando il certificato è pronto (di solito da pochi minuti a qualche ora dopo i DNS).

## Cosa succede ai vecchi link
Con il dominio attivo, i vecchi indirizzi `alessandromauroworks.github.io/Ale/...` (questionario compreso) portano da soli alla stessa pagina su `alessandromauroworks.it/...`. Non si rompe niente.

## Già fatto nel repo
- Tutti i link del sito sono relativi: funziona sia su github.io/Ale/ sia sul dominio.
- canonical, Open Graph, `sitemap.xml` e `robots.txt` puntano già a `https://alessandromauroworks.it/`.
- Le funzioni Supabase `questionario-ricevi` e `analizza-coda` accettano già le origini `https://alessandromauroworks.it` e `https://www.alessandromauroworks.it` nel codice: **vanno ridistribuite** (deploy) prima di passare al dominio, altrimenti l'invio del questionario dal nuovo indirizzo viene rifiutato.

## Cose da fare ancora (non legate al dominio)
- **Link di prenotazione**: incollarlo in `comune/config.js` (`PRENOTA_URL`). Vale per sito e questionario insieme.
- **Partita IVA**: oggi il sito non mostra nessun numero. Appena c'è, scriverla in `comune/config.js` (`CONTATTI.partitaIva`) e rilanciare `node sorgente-sito/genera.mjs`: compare nel piè di pagina e nelle note legali. Se l'attività è continua e organizzata, la partita IVA serve (da confermare con il commercialista).
