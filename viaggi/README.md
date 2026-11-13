# Viaggi (uso personale di Alessandro)

Pagina `viaggi/index.html` per trovare voli economici da Foggia (FOG) e Bari (BRI), scegliere andata e ritorno, aprire i link già compilati (sito della compagnia, Google Flights, Booking.com, Airbnb, GetYourGuide, Civitatis) e leggere un itinerario giorno per giorno.
Nessun pagamento e nessun dato personale passa da qui o viene salvato. Il PIN resta solo nel browser (localStorage).

## Come funziona
- `viaggi-voli` (Edge Function): per ogni combinazione aeroporto x meta x data (massimo 12) chiede prima al **Motore Jarvis** (`/voli`, gratis, legge Google Flights col browser di Cloudflare). Solo se Jarvis fallisce o è incerto usa **Firecrawl** (5 crediti a chiamata, massimo 12). Se Google dice «nessun volo» non spende crediti. Ogni volo mostra la fonte (`jarvis` o `firecrawl`). Da Foggia aggiunge una stima di 15 € per arrivare a Bari (variabile `COSTO_FOGGIA_BARI`).
- `viaggi-itinerario` (Edge Function): chiede a Claude (`claude-sonnet-5-5`) l'itinerario. Non inventa locali con indirizzo; i siti ufficiali di musei e chiese compaiono solo se il dominio è sicuro.
- Link delle compagnie: una sola mappa in `index.html` (`COMPAGNIE` e `COSTRUTTORI`). Verificato solo Ryanair (formato dato da Alessandro); per le altre c'è la pagina ufficiale più il link di Google Flights.

## Secrets da impostare su Supabase (progetto «Alessandro»)
| Secret | A cosa serve |
|---|---|
| `VIAGGI_PIN` | PIN che la pagina manda nell'header `x-pin` (obbligatorio) |
| `JARVIS_URL` | `https://motore-jarvis.alessandromauro.workers.dev` |
| `JARVIS_KEY` | chiave di Jarvis (Jarvis oggi risponde «Chiave mancante o sbagliata», quindi serve) |
| `FIRECRAWL_API_KEY` | riserva voli |
| `ANTHROPIC_API_KEY` | itinerario |

## Prima di usarla: pubblicare Jarvis
Ho aggiunto a Jarvis il comando `/voli?da=BRI&a=STN&data=2026-12-04` (file `jarvis/motore/src/index.js`, i comandi vecchi non sono toccati). Va pubblicato da Alessandro: `cd jarvis/motore && npm install && npx wrangler deploy`. Non è stato provato su Google Flights (nessun accesso a Jarvis né a Google da qui).

## Costi
- Voli con Jarvis: 0 €. Con la riserva Firecrawl: 5 crediti per ricerca.
- Itinerario: costo dell'API Anthropic per una risposta di circa 3-5 mila parole (pochi centesimi).
- Jarvis: limite gratuito Cloudflare di 10 minuti di browser al giorno.

I prezzi cambiano: conferma sempre sul sito della compagnia.
