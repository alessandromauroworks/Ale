# Archivio N8N

Data: 05/11/2026

## Perché esiste
N8N è stato dismesso: Alessandro passa a Supabase. Prima di archiviare i flussi in N8N (archiviati, non cancellati) li abbiamo salvati qui come file, così non si perde niente.

Nessuna credenziale è stata salvata. Nei file restano solo i nomi dei servizi (Telegram, Gmail). L'ID chat Telegram di Alessandro è stato sostituito con `<RIMOSSO>`.

## I 6 flussi (tutti spenti da prima)

| File | Cosa faceva | Come partiva | Nodi principali | Come rifarlo su Supabase |
|---|---|---|---|---|
| `demo-barberia-richiami-recensioni-report.json` | Ogni mattina trova chi manca da 45 giorni (richiamo) e chi è passato ieri (recensione), segna gli invii. Il 1 del mese manda il report degli euro recuperati. Solo anteprima su Telegram. | Ogni giorno alle 9 e il 1 del mese alle 9 | Schedule, Tabella dati, Code, Telegram | pg_cron + Edge Function che legge la tabella clienti e manda i messaggi |
| `demo-commercialista-documenti-che-arrivano-da-soli.json` | Il cliente manda un documento, viene archiviato, parte il promemoria se manca qualcosa o la conferma se è completo. | Modulo web (form) | Form Trigger, Set, If, Telegram | Edge Function chiamata da webhook, più una tabella `documenti` |
| `demo-dentista-preventivi-che-si-firmano.json` | Tre demo: risposta in 30 secondi a una richiesta, conferma dopo la caparra Stripe, preventivo scritto da Claude a partire dal piano di cura (anche da vocale). | Due moduli web e un webhook Stripe | Form Trigger, Webhook, OpenAI (trascrizione), Claude (chain), Telegram | Edge Function per ogni passo (webhook Stripe, trascrizione, chiamata a Claude) e una tabella `preventivi` |
| `jarvis-meteo-ordona.json` | Ogni 30 minuti legge il meteo di Ordona da Open-Meteo (gratis, senza chiavi) e lo salva nella tabella Jarvis Meteo. | Ogni 30 minuti | Schedule, HTTP Request, Tabella dati | pg_cron ogni 30 minuti che chiama una Edge Function e fa upsert nella tabella `jarvis_meteo` |
| `jarvis-scraper.json` | Scraper gratuito: `?url=...` restituisce titolo, testo in Markdown, email, telefoni, social e link. Per i siti in JavaScript chiama il Motore Jarvis su Cloudflare. | Webhook GET `/jarvis-scraper` | Webhook, HTTP Request, Code, Respond to Webhook | Una Edge Function GET con lo stesso codice (il codice del Motore Jarvis è in `jarvis-file-motore/`) |
| `risposte-ai-potenziali-clienti-gmail.json` | Legge le email nuove, le classifica con 3 agenti Claude (classifica, scrive, rivede). I "no grazie" si chiudono da soli, il resto va approvato su Telegram prima dell'invio. | Nuova email su Gmail (controllo ogni minuto) | Gmail Trigger, Claude x3, Switch, Telegram (approva), Gmail | pg_cron che legge Gmail (o webhook Gmail) con Edge Function; l'approvazione resta su Telegram (bot webhook); tabella `email_gestite` |

## Le tabelle dati

| Tabella | Dove | Cosa contiene |
|---|---|---|
| Jarvis Meteo | `tabella-jarvis-meteo.csv` | Una riga: il meteo di Ordona (dati tecnici). Colonne: luogo, temp, codice, vento, max_oggi, min_oggi, pioggia_oggi, codice_domani, max_domani, min_domani, pioggia_domani, aggiornato. |
| Jarvis File Motore | cartella `jarvis-file-motore/` | 4 file di codice del Motore Jarvis (Cloudflare Worker): `wrangler.toml`, `package.json`, `LEGGIMI.md`, `src/index.js`. Salvati come file veri. |
| Demo Barberia – Clienti | NON salvata | Contiene nomi e telefoni di persone, quindi non è stata copiata. 7 righe. Colonne: nome, telefono, ultima_visita, scontrino_medio, consenso_marketing, richiamo_inviato_il, tornato_dopo_richiamo, recensione_chiesta_il. Per rifare la demo bastano 7 righe inventate con queste colonne. |

## Come reimportare un flusso in N8N (se mai servisse)
1. In N8N: Workflows, Add workflow, menu con i tre puntini, Import from File.
2. Scegli il file `.json`.
3. Ricollega le credenziali sui nodi col triangolo rosso (Telegram, Gmail, Anthropic, OpenAI): vanno ricreate, non sono nei file.
4. Dove c'è `<RIMOSSO>` inserisci il tuo ID chat Telegram.
5. Per i flussi che usano tabelle dati: ricrea prima la tabella (per il meteo importa il CSV; per la barberia crea la tabella con le colonne indicate sopra) e ricollega il nodo.
6. Prova con «Execute workflow». Solo dopo accendi («Publish»).
7. Si possono importare anche su un N8N installato gratis sul PC.

## Nota
I flussi sono stati archiviati in N8N il 05/11/2026 (non cancellati): si possono ripristinare da lì.
