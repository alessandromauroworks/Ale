---
name: gestionale-universale
description: Gestionale universale su misura - da usare ogni volta che si crea un gestionale, una demo di gestionale per il sito vetrina o una demo vera per un cliente, di qualsiasi settore (privati, imprenditori, aziende piccole, medie e grandi; enti pubblici esclusi). Base comune obbligatoria (CRM su Supabase, CSV, dashboard, ricerca, notifiche, registro modifiche, documenti, telefono, backup, ruoli, dati di esempio), sezioni su misura del mestiere, stile di Alessandro, sicurezza per dati sensibili, moduli opzionali e collaudo.
---

# Gestionale universale su misura

## Quando usarla
Ogni volta che si crea un gestionale, una demo di gestionale per il sito vetrina o una demo vera per un cliente, di qualsiasi settore o nicchia: privati, imprenditori, aziende piccole, medie e grandi. Gli enti pubblici, per ora, sono esclusi.

Si usa insieme a `gestionale-per-settore` (struttura dei file `gestionali/base` + `gestionali/settori`, domande prima di costruire, collaudo con Playwright, consegna). Dove le due skill dicono cose diverse su base, stile, sicurezza e collaudo, vale questa.

## Principio
La base è sempre la stessa e vale per tutti. Sopra la base si costruiscono le sezioni e il workflow specifici del mestiere del cliente, in modo sartoriale. Un nutrizionista, un commercialista, un dentista e un parrucchiere con magazzino hanno problemi diversi e devono avere sezioni diverse.

## Stile
- Lo stile è quello di Alessandro, non l'Apple generico: moderno, pulito, minimalista, essenziale, professionale, con ispirazione iOS 27.
- Mai futuristico fatto male, mai effetti finti da intelligenza artificiale, mai elementi decorativi inutili.
- Animazioni soft, pulite e giuste, che danno un tocco premium senza eccessi: su clic, schede, finestre, filtri, grafici e cambi pagina.
- «Chiaro» significa comprensibile: chi usa il gestionale deve capirlo subito, senza cose strane o che non funzionano. Non indica il colore.
- Impostazioni: modalità giorno e notte, e Liquid Glass attivabile e disattivabile. Il Liquid Glass deve essere vero e applicato a tutta l'interfaccia, mai un finto effetto vetro.
- In alto a destra, appena si apre la dashboard, due tasti rapidi per cambiare entrambe le opzioni (giorno/notte e Liquid Glass).

## Base obbligatoria
1. **CRM.** Archivio centrale su Supabase e unica fonte di verità: clienti, contatti, storico di chiamate, messaggi, appuntamenti e note, con scheda completa e prossime azioni. Tutte le sezioni leggono da qui.
2. **CSV.** Serve solo a spostare dati dentro e fuori, mai come archivio. Importazione con anteprima, associazione guidata delle colonne, controllo dei duplicati con scelta tra unire, saltare o creare nuovo, e riepilogo finale. Esportazione di clienti, report e backup. Ogni importazione passa dal CRM.
3. **Dashboard.** Animata, con storico, andamenti, analitiche, grafici e report su entrate, spese, guadagni e confronto tra periodi.
4. **Ricerca globale.** Una barra che trova al volo clienti, pratiche e prodotti.
5. **Notifiche e scadenze.** Per esempio magazzino in esaurimento e appuntamenti in arrivo.
6. **Registro delle modifiche.** Chi ha cambiato cosa e quando.
7. **Area documenti per cliente.** Contratti, fatture e PDF allegati alla scheda del CRM.
8. **Uso da telefono.** Pensato prima di tutto per schermi piccoli, con tasti grandi e tabelle che non si rompono.
9. **Backup automatici con ripristino.** Il ripristino va provato davvero, non solo attivato.
10. **Permessi e ruoli.** Titolare, dipendenti e figure esterne vedono cose diverse, con accesso minimo ai soli dati necessari.
11. **Dati di esempio realistici.** Per ogni settore, così la demo sembra viva e non vuota (sempre segnati come dati dimostrativi).

## Sicurezza e privacy per dati sensibili
Per studi medici, dietisti e qualsiasi attività con dati sensibili:
- account personali, mai condivisi, con autenticazione a due fattori;
- ruoli con accesso minimo;
- dati cifrati nel database e nei file allegati;
- registro degli accessi conservato 24 mesi, protetto da modifiche e leggibile, che registra anche la sola consultazione;
- backup con ripristino provato;
- procedura per data breach: Alessandro (responsabile) avvisa il cliente (titolare) senza ritardo appena se ne accorge; il cliente notifica il Garante entro 72 ore (art. 33 GDPR). Il gestionale deve dare al cliente i dati per farlo (cosa, quando, quanti interessati).

Alessandro è responsabile del trattamento: serve un contratto di nomina ai sensi dell'art. 28 GDPR e un'informativa privacy, da far redigere una volta a un professionista e poi riusare come modello. **Senza questi documenti non si vendono gestionali con dati sanitari.** Controllo anche con la skill `ufficio-legale`.

## Moduli opzionali
Si attivano solo quando servono, non fanno parte della base.
- **Fatturazione e pagamenti.** Preventivi, fatture, scadenze di incasso. Tramite intermediario accreditato SDI, con le specifiche tecniche FatturaPA in vigore (indicate come 1.9.1: verificare la versione sul sito dell'Agenzia delle Entrate prima di costruire il modulo). Per medici e dentisti con pazienti privati il modulo giusto è il Sistema Tessera Sanitaria, non la fattura SDI.
- **Comunicazione.** Integrazione con WhatsApp, email e calendario dalla scheda cliente.
- **Magazzino.** Con codici a barre attivabili, per le attività che vendono prodotti.

## Collaudo obbligatorio prima di ogni demo
1. Ogni collegamento va provato davvero. Esempio: una vendita scala il magazzino e compare nei report.
2. Un agent prova a rompere il gestionale.
3. Controllo critico finale nei panni del professionista di quel settore: cercare buchi e mancanze e sistemarli prima di dire che è pronto.
4. Prova finale da telefono, anche vecchio, senza account né app.

## Regole sempre valide
- Niente strumenti tecnici o sezioni di vendita visibili al cliente.
- Niente dati inventati spacciati per veri.
- A fine lavoro elencare onestamente tutti i problemi rimasti.
