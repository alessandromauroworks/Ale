---
name: ufficio-legale
description: Controllo legale, fiscale, privacy e sicurezza PRIMA di ogni azione di Alessandro (messaggi e email a clienti, telefonate, siti e gestionali per clienti, dati di pazienti, contenuti con IA, ricevute, pagamenti, contratti). Legge il registro delle regole nel pannello e decide: si può fare, si può fare con correzioni, oppure no.
---

# Ufficio legale e fiscale

Scopo: Alessandro non deve mai prendere multe, denunce o pagare tasse sbagliate. Prima si controlla, poi si agisce.

## Dove sono le regole
Pannello Workspace https://claude.ai/code/artifact/094392ed-da33-4e39-8b3e-d7eaf3150394, collection `legale` (ArtifactData).
Ogni regola ha: tema, regola, rischio, cosa_fare, quando_si_applica, stato (obbligatoria / prudenza / da_verificare), fonti, verificato_il.
Leggi SOLO le regole il cui `quando_si_applica` riguarda l'azione in corso (query mirata, non tutto il registro): costa meno.

## Controllo in 4 passi (prima di preparare l'azione)
1. **Che azione è?** (email a freddo, telefonata, WhatsApp, DM, sito cliente, gestionale, dati sanitari, video o foto con IA, recensioni, ricevuta, contratto, pagamento).
2. **Leggi le regole che la riguardano** nella collection `legale`.
3. **Decidi:**
   - nessuna regola toccata → procedi;
   - regola «obbligatoria» → applica tutto il `cosa_fare`; se non si può applicare, NON preparare l'azione;
   - regola «prudenza» con rischio alto → prepara solo la versione sicura e scrivi in una riga il rischio;
   - regola «da_verificare» → procedi con la versione più prudente e segnala ad Alessandro.
4. **Scrivi in una riga** cosa hai controllato (es. «Controllo legale: email a freddo → versione con informativa e opposizione, ok»).

## Regole che valgono sempre
- Mai inventare leggi, articoli, cifre o link. Se una regola manca nel registro e il rischio sembra serio: fermati sulla versione prudente e aggiungi la domanda nel pannello (collection `legale`, stato «da_verificare»).
- Dati sanitari (pazienti di Leonardo): solo il minimo indispensabile, mai in pagine o pannelli condivisi con link, mai nei messaggi a terzi.
- Mai dati personali, codici fiscali, IBAN, password o chiavi in chat, pannelli o file.
- Soldi: niente partita IVA → solo ricevute per prestazione occasionale, mai fatture; segnala quando i compensi o la continuità del lavoro avvicinano l'obbligo di partita IVA (skill commercialista).
- Non è un parere legale: per decisioni che toccano contratti importanti, sanzioni o tasse, la voce finale è di un commercialista o avvocato. Prepara tu la domanda già pronta da fargli.

## Aggiornamento
Il registro lo aggiornano da sole due attività programmate: «Sentinella legale» (ogni lunedì, leggera) e «Aggiornamento leggi e fisco del mese» (approfondita). Se trovi una regola superata durante il lavoro, aggiorna il documento con la fonte nuova e `verificato_il` di oggi.
