---
name: ripara-build
description: Usa quando la build fallisce (npm run build, vite, tsc o Lovable che non pubblica). Legge il primo errore vero, lo corregge con la modifica più piccola e rifà la build, massimo 3 tentativi.
---

# Ripara build

Obiettivo: far passare la build cambiando il minimo. Niente riscritture, niente miglioramenti.

## Chi lavora
- `lettore` esegue la build, legge l'errore e trova il file.
- `scrittore` applica la correzione piccola (il caso normale).
- `architetto` solo se dopo 3 tentativi non si risolve o serve cambiare la struttura.

## Passi
1. **Lancia la build** (`npm run build`; se serve anche `npx tsc --noEmit`) e copia l'errore.
2. **Trova il primo errore vero**: di solito è il primo in alto. Gli altri spesso sono conseguenze e spariscono da soli.
3. **Capisci la causa** leggendo il file indicato (percorso e riga).
4. **Correggi con la modifica più piccola**: una riga, un import, un controllo `?.`.
5. **Rifai la build.** Se passa, fine. Se compare un nuovo errore, torna al punto 2.
6. **Massimo 3 tentativi** (come in `ripara-errori`). Poi fermati e spiega ad Alessandro cosa hai provato.

## Correzioni tipiche
| Errore | Rimedio piccolo |
|---|---|
| `Cannot find module` | Percorso import sbagliato, oppure `npm install` del pacchetto mancante |
| `implicitly has an 'any' type` | Scrivere il tipo del parametro |
| `Object is possibly 'undefined'` | Controllo prima dell'uso, o `?.` |
| `Property does not exist on type` | Aggiungere il campo al tipo, o correggere il nome |
| `Type 'X' is not assignable to 'Y'` | Convertire il valore o correggere il tipo |
| `Hook called conditionally` | Spostare l'hook in cima al componente |
| `'await' outside async` | Aggiungere `async` alla funzione |
| Errori dopo aver cambiato il database | Rigenerare i tipi Supabase (non scriverli a mano) |

## Mai
- Disattivare i controlli: niente `// @ts-ignore`, `any` ovunque, `"strict": false`, regole ESLint spente per far passare.
- Cancellare o saltare test che falliscono.
- Cambiare la logica, rinominare cose o «sistemare» codice che non c'entra.
- Cancellare `node_modules` o la cartella di cache come primo rimedio: solo se la causa è davvero la cache.
- Dire «build ok» senza averla rifatta.

## Fermati e chiedi se
- la correzione richiede di cambiare cosa fa il gestionale (non solo come è scritto);
- l'errore nasce da una versione di un pacchetto da aggiornare in modo grosso;
- su un progetto Lovable l'errore è nel codice che Lovable rigenera: meglio chiedere a Lovable di correggerlo che toccarlo a mano.

## Risultato
Una riga: errore trovato, file toccato, cosa è stato cambiato, build di nuovo verde.

Adattata da Everything Claude Code (affaan-m/ECC, licenza MIT).
