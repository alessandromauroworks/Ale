# Automazioni

Regola per sempre (05/11/2026): tutte le automazioni, di Alessandro e dei clienti, si fanno solo con **Edge Function Supabase** (più pg_cron per gli orari, webhook e tabelle Postgres con RLS). N8N è stato eliminato del tutto: niente flussi, niente backup, niente reimportazioni.

## Vecchi flussi già convertiti
| Automazione | Dove gira ora |
|---|---|
| Meteo di Ordona per Jarvis | Edge Function `meteo-ordona` (progetto Supabase «Alessandro») |
| Scraper gratuito di Jarvis | Edge Function `jarvis-scraper` (per i siti in JavaScript usa il Motore Jarvis, codice in `jarvis/motore/`) |
| Demo commercialista: documenti che arrivano da soli | Edge Function `demo-commercialista` |
| Demo dentista: preventivi che si firmano | Edge Function `demo-dentista` |
| Demo barberia: richiami, recensioni, report | Edge Function `demo-barberia` |
| Risposte ai potenziali clienti da Gmail | attività programmata «Risposte clienti e riepilogo serale» (solo bozze, mai invii automatici); da portare su Edge Function quando servirà h24 |

I file dei vecchi flussi sono stati tolti da questo repository il 05/11/2026 (restano solo nella cronologia di git).
