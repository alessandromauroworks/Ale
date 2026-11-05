---
name: controllo-database
description: Usa prima di consegnare un gestionale con Supabase, prima di una migrazione e quando i dati sono lenti o un cliente potrebbe vedere i dati di un altro. Controlla sicurezza (RLS), velocità e modifiche sicure al database.
---

# Controllo database (Supabase)

Qui sono in gioco i dati dei clienti. Un errore può mostrare i dati di uno a un altro, o perderli.

## Chi lavora
- `lettore` guarda tabelle, policy e indici e compila la checklist (solo lettura).
- `scrittore` scrive le correzioni e le migrazioni semplici.
- `architetto` solo per schemi grossi, ruoli complicati o perdita di dati già avvenuta.

## Checklist breve

**Sicurezza (la più importante)**
- [ ] RLS attiva su ogni tabella con dati di clienti (anche tabelle «di servizio»).
- [ ] Ogni tabella con RLS ha almeno una policy: RLS attiva senza policy blocca tutto, RLS spenta lascia tutto aperto.
- [ ] Policy giuste per ruolo: il cliente vede solo i suoi dati, lo staff solo ciò che gli serve, l'admin il resto. Usare `(select auth.uid())`, non `auth.uid()` nudo (più veloce).
- [ ] Nessuna chiave `service_role` nel frontend, in `VITE_...` o nel codice pubblicato. Nel frontend solo la chiave pubblica (anon/publishable).
- [ ] Nessun `GRANT ALL` agli utenti dell'app; funzioni sensibili non esposte.
- [ ] Controllo con gli avvisi di Supabase (`get_advisors`, sicurezza e prestazioni).

**Velocità e ordine**
- [ ] Indice sulle colonne usate in filtri (`where`), ordinamenti e collegamenti.
- [ ] Indice anche sulle colonne usate dalle policy (es. `user_id`, `organizzazione_id`).
- [ ] Chiavi esterne presenti, con il comportamento scelto alla cancellazione (`on delete`) e con indice.
- [ ] Tipi giusti: `timestamptz` per le date, `numeric` per i soldi, `text` per i testi, `NOT NULL` dove serve.
- [ ] Niente `select *` su tabelle grandi; paginazione per cursore, non `offset` lunghi.

**Migrazioni (modifiche allo schema)**
- [ ] Ogni migrazione ha il modo di tornare indietro (come annullarla).
- [ ] Niente `drop` di colonne o tabelle con dati: prima si aggiunge il nuovo, si copiano i dati, poi (con ok) si toglie il vecchio.
- [ ] Colonna nuova obbligatoria: prima nullable, riempi, poi `NOT NULL`.
- [ ] **Backup prima di ogni modifica grossa** (esportazione o branch Supabase) e prova prima su un branch/copia, mai direttamente sul progetto vivo del cliente.

## Fermati e chiedi ad Alessandro se
- serve cancellare, svuotare o cambiare tipo a una colonna con dati veri;
- una tabella con dati di clienti ha RLS spenta e non è chiaro chi deve vederla;
- trovi la chiave `service_role` in un file del frontend (è già da considerare esposta: va cambiata);
- la migrazione non è reversibile o non c'è un backup;
- il progetto è di un cliente e non c'è un ramo/branch dedicato.

## Risultato
Checklist con ok / problema per voce, i problemi in ordine di gravità, e per ciascuno la correzione proposta (non applicata senza ok se tocca dati).

Adattata da Everything Claude Code (affaan-m/ECC, licenza MIT) e dalle buone pratiche Postgres di Supabase.
