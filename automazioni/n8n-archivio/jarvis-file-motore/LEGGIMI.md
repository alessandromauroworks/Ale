# Motore Jarvis

Scraper e ricerca web gratuiti per sempre, su Cloudflare Workers (piano Free), al posto di Firecrawl.

| Comando | A cosa serve |
|---|---|
| `/leggi?url=sito.it` | Pagina in Markdown con titolo, email, telefoni, social, link, dati strutturati. I siti in JavaScript (Lovable, React, Wix) si rileggono da soli col browser di Cloudflare. |
| `/cerca?q=barberia foggia&n=10` | Ricerca web gratis (DuckDuckGo, poi Bing, poi Mojeek). |
| `/mappa?url=sito.it` | Tutte le pagine del sito (sitemap + link della home). |
| `/sito?url=sito.it&max=15` | Legge fino a 30 pagine dello stesso sito in un colpo e raccoglie email, telefoni e social. |
| `/salute` | Controlla che il motore sia acceso. |

Limiti gratuiti di Cloudflare: 100.000 chiamate al giorno; browser per i siti JavaScript 10 minuti al giorno (circa 100-200 pagine); 50 richieste esterne per chiamata.
Per i siti con protezioni anti-bot: Scrapling sul PC.

Pubblicazione: `npm install` poi `npx wrangler deploy` (accesso Cloudflare di Alessandro, nessuna chiave in chat).
Protezione facoltativa: `npx wrangler secret put CHIAVE` e poi aggiungere `&k=<chiave>` a ogni chiamata.
