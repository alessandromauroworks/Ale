# Archivio dei gestionali di Alessandro Mauro

Un solo gestionale base, una versione per ogni tipo di attività. Regola completa: skill `.claude/skills/gestionale-universale/SKILL.md`.

## Struttura
- `base/` — parte comune a tutti: `base.css`, `base.js`. Dentro: impianto e navigazione, tasti giorno/notte e Liquid Glass (scelta ricordata, vetro che si spegne da solo con «meno trasparenza» o su dispositivi deboli), salvataggio in `localStorage` con «Ripristina dati demo», CRM con scheda, storico e prossime azioni, agenda giorno/settimana, scadenze e notifiche, bilancio e storico del mese con chiusura automatica, dashboard con confronto tra periodi, ricerca globale, registro modifiche, documenti per cliente, importa/esporta CSV, bozze se la rete cade, ruoli mostrati. Partita dal gestionale del Patronato di Carapelle.
- `settori/<settore>.js` — solo ciò che è del settore: sezioni, campi, stati, moduli in più, dati demo inventati. Si aggancia con `Base.avvia({...})`.
- `settori/<settore>.md` — le 5 domande sul settore, la scelta sulla cifratura ed esito del collaudo.
- `<settore>.html` — la pagina del gestionale: carica `base/` + `settori/<settore>.js`, con banner «Progetto dimostrativo · dati inventati» e CSP restrittiva.
- `index.html` — elenco di tutti i gestionali con stato.

Le demo salvano tutto nel browser di chi le apre (`localStorage`): niente Supabase, niente login. Online: `https://alessandromauroworks.github.io/Ale/gestionali/`.

## Come si aggiunge un settore
1. Rispondi alle 5 domande in `settori/<settore>.md`.
2. Copia `settori/patronato.js` in `settori/<settore>.js` e cambia solo sezioni, campi, moduli e dati demo.
3. Crea `<settore>.html` uguale agli altri, cambiando solo il file del settore.
4. Collaudo Playwright e controllo di sicurezza (punti 3 e 4 della skill); aggiorna la tabella qui sotto e `index.html`.
Se serve una funzione utile a tutti, va in `base/`, mai copiata dentro un settore.

## Stato dei settori
| Settore | Stato | Collaudo | Sicurezza |
|---|---|---|---|
| Patronato / sportello servizi | pronto (demo) · `patronato.html` | 267/267 controlli, 18/11/2026 (`settori/patronato.md`) | codice controllato: niente innerHTML con dati, CSP, no-referrer |
| Agenzia immobiliare | in costruzione | — | — |
| Parrucchiere | da portare sulla base | — | — |
| Centro estetico | da portare sulla base | — | — |
| Studio commercialista | da portare sulla base | — | — |
| Affitti brevi | da portare sulla base | — | — |
| Ristorante | da portare sulla base | — | — |
| Dietista / nutrizionista | da portare sulla base (dati sanitari: solo demo inventate) | — | — |

Tutte le demo usano solo dati inventati e mostrano il banner «Progetto dimostrativo · dati inventati».
