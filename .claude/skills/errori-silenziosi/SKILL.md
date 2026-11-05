---
name: errori-silenziosi
description: Usa prima di consegnare un gestionale o un sito, e ogni volta che «non succede niente» ma non compare nessun errore (il pulsante non salva, la lista è vuota). Cerca nel codice gli errori nascosti che nessuno vede.
---

# Errori silenziosi

Un errore silenzioso è un guasto che il codice nasconde: il cliente preme «Salva», vede «Fatto», ma il dato non c'è. È il tipo di guasto peggiore, perché nessuno se ne accorge finché il cliente si arrabbia.

## Chi lavora
- `lettore` cerca nel codice e fa l'elenco (non modifica nulla).
- `scrittore` applica le correzioni dopo l'ok di Alessandro.
- `architetto` solo se il problema è nel modo in cui è costruito tutto il salvataggio.

## Cosa cercare
1. **Catch vuoti**: `catch {}` o `catch (e) { }` senza fare niente.
2. **Supabase senza controllo**: chiamate dove si legge `data` ma `error` non viene guardato. Esempio: `const { data } = await supabase.from(...)`.
3. **Promesse senza gestione**: `await` fuori da `try/catch`, `.then()` senza `.catch()`, funzioni async lanciate senza attendere.
4. **Fallback che nascondono**: `.catch(() => [])`, `data ?? []`, `|| 0` dove un errore diventa «lista vuota» o «zero».
5. **Salvataggi bugiardi**: toast «Salvato!» mostrato prima di sapere se il salvataggio è riuscito, o dopo un update che ha toccato 0 righe (spesso colpa della RLS).
6. **Log inutili**: solo `console.log(e)` e poi si va avanti come se niente fosse; il cliente non vede nulla.
7. **Edge Function e automazioni**: risposte `200 OK` anche quando dentro è fallito qualcosa; errori ingoiati nei webhook.
8. **Nessun limite di attesa** su chiamate di rete, upload, invio email.

## Come si fa
1. Cerca con ricerca testuale i punti sopra (`catch`, `.catch`, `await supabase`, `toast`).
2. Per ogni punto chiediti: «se questo fallisce, il cliente se ne accorge?». Se no, è un problema.
3. Non correggere da soli lo stesso giorno cose grosse: prima l'elenco.

## Risultato da consegnare
Una lista, un punto per riga:
- `percorso/file.tsx:42`
- **Cosa vede il cliente**: es. «Preme Salva, compare "Fatto", ma l'appuntamento non esiste».
- **Gravità**: alta (si perdono dati o soldi), media, bassa.
- **Correzione proposta**: es. «controllare `error`, mostrare messaggio chiaro, non dire "Fatto" se è fallito».

## Regola per la correzione
Controlla sempre `error`, mostra al cliente un messaggio semplice («Non sono riuscito a salvare, riprova»), e non mostrare «Fatto» finché il database non ha risposto bene. Mai nascondere un errore con un valore finto.

Adattata da Everything Claude Code (affaan-m/ECC, licenza MIT).
