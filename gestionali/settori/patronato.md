# Patronato / sportello servizi (Patronato e CAF)

Demo per il sito vetrina, costruita sulla base comune (`gestionali/base/`). Pagina: `gestionali/patronato.html`. Ricavata dal gestionale demo del Patronato di Carapelle (repo `alessandromauroworks`, `demo-patronato/`), senza copiare dati reali: tutti i dati sono inventati.

## Le 5 domande (punto 5 della skill)
1. **Come lavora in una giornata.** Due operatrici e una titolare allo sportello: ricevono cittadini su appuntamento e senza, raccolgono documenti, fanno firmare mandato di patrocinio e informativa privacy, trasmettono a INPS, Agenzia delle Entrate o Ministero del Lavoro, segnano il protocollo, aspettano l'esito, rispondono alle integrazioni. Oggi tengono tutto tra fogli, Excel, il portale dell'ente e WhatsApp.
2. **Dove perde tempo o soldi.** (a) Pratiche ferme perché manca un documento e nessuno richiama; (b) termini persi: 68 giorni per NASpI e DIS-COLL, 7 giorni per revocare le dimissioni, termine della lettera di integrazione INPS, RED, 12 mesi per la successione, ricorsi; (c) servizi CAF a pagamento fatti e mai incassati.
3. **Moduli in più.** Pipeline delle pratiche per stato con regole di invio, checklist dei documenti per tipo, firme, protocolli nel formato dell'ente, esiti e termini di ricorso o ATP, scadenze calcolate, listino dei servizi a pagamento collegato al bilancio, richieste di appuntamento online con QR, nucleo familiare, messaggio pronto per il cittadino.
4. **Campi obbligatori per legge.** Mandato di patrocinio firmato e informativa privacy prima dell'invio; per i servizi fiscali la delega. Le regole complete stanno in `ufficio-legale` (collection `legale`): prima di una versione vera vanno ricontrollate lì, la demo non le sostituisce.
5. **Dati sensibili.** Sì: codice fiscale, documenti d'identità, IBAN, dati sanitari (invalidità civile, maternità), redditi. Nella demo sono tutti inventati (codici fiscali con X al posto del comune, telefoni `333 000 …`, email `@esempio.it`). Si chiede solo il minimo: nella scheda ci sono nome, codice fiscale, data di nascita, recapiti, nucleo familiare.

## Cifratura
Demo: **non serve**, perché ci sono solo dati inventati e restano nel browser (`localStorage`). Versione vera: oltre alla cifratura del disco di Supabase, da decidere campo per campo prima di costruirla; i candidati sono IBAN, note sanitarie delle pratiche di invalidità e i file allegati (sempre cifrati). Il codice fiscale resta in chiaro perché serve a cercare e a trovare i doppioni.

## Cosa c'è (settore)
Sezione Pratiche (per stato o tabella, trascinamento su computer, menu su telefono), scheda pratica (stato, firme, documenti, invio con protocollo controllato, esito, ricorso o ATP, pagamento, note, storico, messaggio per il cittadino), Richieste online (QR, link, modulo pubblico `patronato.html#richiesta` con consenso privacy, conferma che crea l'appuntamento), schede Pratiche e Nucleo familiare nel CRM, scadenze del mestiere, indicatori e carico per operatrice in dashboard, esportazione CSV delle pratiche. Una pratica incassata crea il movimento nel bilancio del mese; annullando l'incasso il movimento esce.

## Collaudo (18/11/2026)
Playwright, Chromium, a 390x844 e 1440x900, server locale solo per il collaudo. **267 controlli, 267 passati.**
- Ogni sezione e i suoi pulsanti; nessuno scroll orizzontale (anche con le finestre aperte); console senza errori.
- Crea, modifica, elimina con ricarica: cittadino, contatto e prossima azione, appuntamento, pratica, movimento, documento, obiettivo.
- Moduli con dati non validi: campi vuoti, codice fiscale, telefono, email, date future, ora non valida, importi «abc», zero e enormi, protocollo nel formato sbagliato, esito negativo senza motivazione, NASpI oltre 68 giorni, conflitti d'orario e giorni di chiusura.
- Collegamento vero: una pratica a pagamento incassata (45,00 €) compare nel bilancio del mese; il bilancio torna al centesimo con la somma dei movimenti; ogni mese chiuso torna con i suoi movimenti; chiusura automatica simulata; movimento in un mese chiuso con avviso e chiusura aggiornata.
- Tasti giorno/notte e Liquid Glass con ricarica; vetro spento da solo con «meno trasparenza» e su dispositivo debole; «meno movimento» spegne le animazioni.
- Rete spenta durante la compilazione: avviso, bozza salvata, bozza ripresa, salvataggio in attesa e registrato da solo al ritorno della rete.
- CSV: anteprima, associazione delle colonne, doppioni (unisci, salta, crea), righe senza nome, email errata, virgolette, CSV malformato, riepilogo; esportazioni con formule neutralizzate.
- Prova a romperlo: `<script>`, `<img onerror>`, `<svg onload>` in nomi, note, registro, ricerca e modulo pubblico (nessun codice eseguito); file `.html` e file troppo grandi rifiutati; dati del browser rovinati (riparte con i dati demo); «Ripristina dati demo».
- Controllo critico da operatrice: aggiunti il messaggio pronto per il cittadino (documenti da portare, esito, termini) e il telefono cliccabile nella scheda; le tabelle del bilancio su telefono spezzavano le parole e sono state corrette; il margine si confronta in euro, non in percentuale.

**Non collaudato qui:** il link pubblico su GitHub Pages (lo pubblica Alessandro dopo il push); il QR con la libreria vera da cdnjs (nel collaudo la rete esterna è chiusa: usata la stessa versione 1.0.0 da npm, con la stessa impronta `integrity`); la prova su un telefono vecchio vero.
