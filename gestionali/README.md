# Archivio dei gestionali di Alessandro Mauro

Un solo gestionale base, una versione per ogni tipo di attività. Regola completa: skill `.claude/skills/gestionale-per-settore/SKILL.md`.

## Struttura (piano)
Attenzione: questa è la struttura prevista, non quella attuale. Per ora nel repo c'è solo questo README: nessuna cartella o file elencato qui sotto esiste ancora. La base comune va presa dal gestionale del Patronato di Carapelle, che non è ancora caricato qui: va aggiunto in `gestionali/base/` quando Alessandro lo porta.

- `base/` — parte comune a tutti: `base.css`, `base.js` (layout, navigazione, tasti Liquid Glass / normale e chiaro / scuro, salvataggio, tabelle, schede, agenda, pipeline, modali, statistiche, ricerca, esporta CSV).
- `settori/<settore>.js` — solo ciò che è del settore: sezioni, campi, stati, moduli in più, dati demo inventati.
- `settori/<settore>.md` — le 5 domande sul settore (come lavora, dove perde tempo, moduli in più, obblighi di legge, dati sensibili) ed esito del collaudo.
- `<settore>.html` — la pagina del gestionale: carica `base/` + `settori/<settore>.js`.
- `index.html` — elenco di tutti i gestionali con stato.

## Come si aggiunge un settore
1. Rispondi alle 5 domande in `settori/<settore>.md`.
2. Copia un settore esistente in `settori/<settore>.js` e cambia solo sezioni, campi, moduli e dati demo.
3. Crea `<settore>.html` uguale agli altri, cambiando solo il file del settore.
4. Collaudo Playwright e controllo di sicurezza (punti 3 e 4 della skill); aggiorna la tabella qui sotto e `index.html`.
Se serve una funzione utile a tutti, va in `base/`, mai copiata dentro un settore.

## Stato dei settori
Nessun file di settore è ancora nel repo: la tabella è lo stato previsto, da aggiornare quando i file vengono caricati.

| Settore | Stato | Collaudo | Sicurezza |
|---|---|---|---|
| Agenzia immobiliare | in costruzione | — | — |
| Parrucchiere | da portare sulla base | — | — |
| Centro estetico | da portare sulla base | — | — |
| Studio commercialista | da portare sulla base | — | — |
| Affitti brevi | da portare sulla base | — | — |
| Ristorante | da portare sulla base | — | — |
| Dietista / nutrizionista | da portare sulla base (dati sanitari: solo demo inventate) | — | — |
| Patronato / sportello servizi | da portare sulla base | — | — |

Tutte le demo usano solo dati inventati e mostrano il banner «Progetto dimostrativo · dati inventati».
