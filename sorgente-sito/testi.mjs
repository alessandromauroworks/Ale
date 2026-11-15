/* TESTI DEL SITO. Si cambiano qui, poi: node sorgente-sito/genera.mjs
   Regole: solo fatti veri, niente numeri, clienti o recensioni inventati, niente nomi di strumenti tecnici.
   Si vende il risultato (es. «non perdi più prenotazioni»), non lo strumento. */

export const SERVIZI = [
  {
    slug: "siti", demo: "sito", nome: "Siti e landing page", breve: "Ti fai trovare e ti contattano subito.",
    desc: "Siti e landing page veloci, chiari e fatti per il telefono: presentano bene la tua attività e portano richieste e prenotazioni. Prova la demo.",
    h1: "Un sito che ti porta<br>richieste, non solo visite.",
    lead: "Siti vetrina e landing page veloci, chiari e pensati prima di tutto per il telefono: chi arriva capisce subito cosa fai e ti scrive o prenota in un tocco.",
    problemi: ["Non hai un sito, o è vecchio e lento sul telefono", "Chi ti cerca su Google trova poco o niente", "Ti chiedono sempre le stesse informazioni su prezzi e orari", "Il sito c'è, ma non arriva nessuna richiesta"],
    ottieniTit: "Un sito chiaro, che lavora per te.",
    ottieni: [["Veloce e fatto per il telefono", "Si apre in un attimo e si legge bene anche su uno schermo piccolo."], ["Contatti e prenotazioni in un tocco", "WhatsApp, chiamata, modulo o prenotazione: le richieste arrivano già ordinate."], ["Pronto per Google", "Testi, titoli e struttura curati per farti trovare da chi cerca il tuo servizio."]],
    passi: [["Mi racconti la tua attività", "Cosa fai, a chi parli, cosa vuoi che faccia chi visita il sito."], ["Ti mostro una bozza", "Vedi il sito sul telefono e sul computer prima di decidere. Lo correggiamo insieme."], ["Va online e lo seguo", "Lo pubblico sul tuo indirizzo e resto il tuo riferimento per modifiche e aggiornamenti."]],
    demoTit: "Il tuo sito, in anteprima", demoSub: "Scegli telefono o computer e cambia lo stile.",
    faq: [["Devo preparare io i testi e le foto?", "No, ti aiuto io a scriverli. Le foto migliori sono quelle vere della tua attività: se non le hai, troviamo insieme una soluzione."], ["Posso modificarlo dopo?", "Sì. Possiamo concordare un'assistenza per modifiche e aggiornamenti, oppure ti spiego come cambiare le cose semplici."], ["Meglio un sito o una landing page?", "Il sito presenta tutta l'attività; la landing page è una pagina sola, pensata per un servizio o un'offerta. In call ti dico quale serve a te."]],
    fineTit: "Vuoi vedere il tuo sito?"
  },
  {
    slug: "gestionali", demo: "gest", nome: "Gestionali", breve: "Clienti, agenda e pagamenti in un unico posto.",
    desc: "Gestionali su misura per la tua attività: clienti, appuntamenti, pagamenti, magazzino e scadenze in un unico posto, semplice da usare ogni giorno.",
    h1: "Tutto il tuo lavoro<br>in un unico posto.",
    lead: "Un gestionale costruito sul tuo modo di lavorare, non un programma già pronto da imparare: clienti, agenda, pagamenti, documenti e scadenze, chiari a colpo d'occhio.",
    problemi: ["Cerchi le cose tra quaderni, fogli e chat", "Scrivi le stesse informazioni due o tre volte", "Non sai con precisione quanto hai incassato e chi deve ancora pagare", "Scadenze e richiami li ricordi a memoria"],
    ottieniTit: "Ordine, senza complicazioni.",
    ottieni: [["Solo i moduli che ti servono", "Ogni attività è diversa: niente funzioni inutili, solo quelle che usi davvero."], ["Semplice da usare ogni giorno", "Schermate chiare, anche dal telefono, per te e per chi lavora con te."], ["Cresce con te", "Si parte dal necessario e si aggiunge il resto quando serve."]],
    passi: [["Guardiamo come lavori", "Mi mostri come gestisci oggi clienti, agenda e pagamenti, anche se è tutto su carta."], ["Provi una versione di prova", "Ti preparo i moduli principali e li provi con calma prima di decidere."], ["Lo completo e ti affianco", "Lo finisco, sposto i dati che hai già e ti spiego come usarlo."]],
    demoTit: "Il tuo gestionale, in anteprima", demoSub: "I moduli cambiano in base alla tua attività.",
    faq: [["Posso usarlo dal telefono?", "Sì, si usa dal computer, dal tablet e dal telefono."], ["I miei dati sono al sicuro?", "Si entra solo con le proprie credenziali e ognuno vede solo ciò che gli serve. Prima di iniziare ti spiego chiaramente dove sono salvati i dati e chi li può vedere."], ["E i dati che ho già su fogli o quaderni?", "Li spostiamo nel gestionale, così non riparti da zero."]],
    fineTit: "Vuoi vedere il gestionale per la tua attività?"
  },
  {
    slug: "automazioni", demo: "auto", nome: "Automazioni", breve: "I lavori che si ripetono vanno avanti da soli.",
    desc: "Automazioni per la tua attività: promemoria, conferme, richieste di recensione e solleciti che partono da soli. Meno lavoro a mano e meno dimenticanze.",
    h1: "I lavori che si ripetono<br>vanno avanti da soli.",
    lead: "Promemoria, conferme, solleciti gentili, richieste di recensione, riepiloghi: partono da soli al momento giusto. Tu decidi le regole e cosa confermare prima.",
    problemi: ["Clienti che dimenticano l'appuntamento e non si presentano", "Passi la sera a rispondere ai messaggi", "Rincorri chi deve ancora pagare o mandare un documento", "Le recensioni le chiedi solo quando te ne ricordi"],
    ottieniTit: "Meno lavoro a mano, meno dimenticanze.",
    ottieni: [["Messaggi al momento giusto", "Il promemoria il giorno prima, la conferma subito, il grazie dopo il servizio."], ["Decidi tu le regole", "Cosa parte da solo, quando e con quale testo. E cosa vuoi confermare prima tu."], ["Collegate a ciò che usi", "Funzionano con il sito, il gestionale, WhatsApp e l'email che usi già."]],
    passi: [["Troviamo cosa si ripete", "Guardiamo insieme le cose che fai a mano ogni giorno o ogni settimana."], ["Scriviamo le regole", "Per ogni automazione: quando parte, a chi, con quale testo."], ["La accendo e la controllo", "La provo con te, la accendo e controllo che funzioni nel tempo."]],
    demoTit: "Le automazioni, passo per passo", demoSub: "Guarda come funzionano e cambia le regole.",
    faq: [["E se un messaggio è sbagliato?", "Le regole e i testi li decidiamo insieme e si possono cambiare. Per i messaggi più delicati puoi scegliere di confermarli tu prima che partano."], ["Serve il consenso dei clienti?", "Per promemoria e conferme di ciò che il cliente ha chiesto no; per i messaggi che invitano a tornare sì. Le automazioni partono solo a chi l'ha dato."], ["Posso partire da una sola automazione?", "Certo. Anche una sola, come il promemoria degli appuntamenti, è un ottimo inizio."]],
    fineTit: "Quali lavori vuoi toglierti di dosso?"
  },
  {
    slug: "assistenti", demo: "ass", nome: "Assistenti WhatsApp e telefono", breve: "Risponde anche la sera e quando sei occupato.",
    desc: "Un assistente virtuale su WhatsApp e al telefono che risponde ai clienti, propone orari e prenota, anche la sera. Dichiara di essere un programma e passa a te quando serve.",
    h1: "Risponde ai clienti<br>anche quando non puoi.",
    lead: "Un assistente virtuale su WhatsApp e al telefono: risponde alle domande frequenti, propone gli orari liberi e prenota. Dice sempre di essere un programma e passa a te quando serve.",
    problemi: ["Il telefono squilla mentre lavori", "Rispondi sempre alle stesse domande, anche la sera", "Chiamate perse che diventano clienti persi", "Prenotazioni sparse tra telefono, messaggi e social"],
    ottieniTit: "Nessun cliente lasciato senza risposta.",
    ottieni: [["Risposte subito, a ogni ora", "Orari, prezzi indicativi, come arrivare, cosa portare: risponde con le tue informazioni."], ["Prenota e ricorda", "Propone gli orari liberi, segna l'appuntamento e manda il promemoria."], ["Passa a te quando serve", "Per le richieste delicate ti avvisa con la conversazione già riassunta. Tu leggi tutto quando vuoi."]],
    passi: [["Scriviamo cosa può dire", "Le domande frequenti, le risposte, cosa non deve mai fare e quando passare a te."], ["Lo provi tu", "Ci parli come un cliente e lo correggiamo finché risponde come vuoi."], ["Lo accendiamo", "Prima su WhatsApp o al telefono, poi dove serve. Io controllo che lavori bene nel tempo."]],
    demoTit: "L'assistente che risponde per te", demoSub: "Guarda tre situazioni tipiche, dal messaggio la sera alla chiamata persa.",
    faq: [["I clienti sanno che parlano con un programma?", "Sì, sempre: lo dice all'inizio di ogni conversazione, ed è giusto così. Chi vuole può chiedere di parlare con una persona."], ["Può sbagliare?", "Risponde solo con le informazioni che gli diamo e, se non sa una cosa, passa a te. Le conversazioni le puoi leggere tutte."], ["Funziona anche al telefono?", "Sì: può rispondere alle chiamate quando non puoi, oppure richiamare con un messaggio chi non ha trovato risposta."]],
    fineTit: "Quante richieste perdi oggi?"
  },
  {
    slug: "video-factory", demo: "vf", nome: "Video Factory", breve: "Video per i social, pubblicati con costanza.",
    desc: "Video Factory: una serie di video verticali professionali su misura per la tua attività, montati con cura e pubblicati con costanza sui tuoi social.",
    h1: "Video per i social,<br>pubblicati con costanza.",
    lead: "La Video Factory è una serie di video verticali professionali, fatti su misura per la tua attività. Tu giri poche riprese col telefono, io penso al resto. Niente esce senza il tuo ok.",
    problemi: ["I social sono fermi da settimane", "Non sai cosa pubblicare né come", "I video fatti col telefono non ti convincono", "Non hai tempo di montare e pubblicare"],
    ottieniTit: "Contenuti curati, senza perderci le serate.",
    ottieni: [["Idee e tracce pronte", "Ti dico cosa dire e come girarlo: bastano pochi minuti col telefono."], ["Montaggio professionale", "Un inizio che fa fermare chi scorre, sottotitoli, grafiche e musica. Chiaro anche per chi non ti conosce."], ["Calendario e pubblicazione", "Vedi in anticipo cosa esce e quando. Approvi tu, poi esce da solo nei giorni giusti."]],
    passi: [["Mi dici cosa vuoi comunicare", "Un servizio, le domande dei clienti, il dietro le quinte, un'offerta. Se non sai da dove partire, propongo io gli argomenti."], ["Giri, io monto", "Mi mandi le riprese, anche poche e imperfette: luce, audio e ritmo li sistemo io."], ["Approvi ed esce", "Ti mando i video finiti. Esce solo ciò che approvi, con costanza, secondo il calendario."]],
    demoTit: "Video Factory: il tuo calendario", demoSub: "Due settimane di contenuti di esempio, con le anteprime.",
    faq: [["Devo per forza metterci la faccia?", "No. Si possono fare video con te, con le mani al lavoro, con il tuo locale o con scene create apposta."], ["Quanti video al mese?", "Quelli che servono a te: il numero lo decidiamo in call, in base a cosa vuoi ottenere e al tempo che hai."], ["Chi pubblica i video?", "Se vuoi, escono da soli sui tuoi profili nei giorni e negli orari concordati. È un servizio a parte, su richiesta."]],
    fineTit: "Vuoi vedere il tuo calendario dei contenuti?"
  },
  {
    slug: "fogli", demo: "fogli", nome: "Fogli Excel e Google", breve: "I tuoi fogli, puliti e che fanno i conti da soli.",
    desc: "Sistemazione di fogli Excel e Google: tolgo doppioni ed errori, ordino date e importi, aggiungo totali, controlli e riepiloghi automatici.",
    h1: "I tuoi fogli in ordine,<br>con i conti che tornano.",
    lead: "Lavori già con Excel o Fogli Google? Li sistemo: tolgo doppioni ed errori, metto in ordine date e importi, aggiungo totali, controlli e riepiloghi che si aggiornano da soli.",
    problemi: ["Doppioni ed errori che nessuno trova", "Date e importi scritti ognuno a modo suo", "Totali rifatti a mano ogni volta", "Un foglio che sa usare solo una persona"],
    ottieniTit: "Fogli chiari, che chiunque sa usare.",
    ottieni: [["Dati puliti", "Niente doppioni, formati uguali per date e importi, campi che non si possono sbagliare."], ["Conti automatici", "Totali, scadenze e riepiloghi che si aggiornano da soli."], ["Un passo in più, se serve", "Promemoria a chi deve pagare o un riepilogo ogni settimana. E quando il foglio non basta più, si passa a un gestionale."]],
    passi: [["Mi mandi il foglio", "Così com'è, anche disordinato. Mi spieghi a cosa ti serve."], ["Lo sistemo", "Ti mostro prima e dopo, e cosa ho cambiato."], ["Lo usi da subito", "Ti spiego come aggiornarlo senza rovinarlo."]],
    demoTit: "Il tuo foglio, messo in ordine", demoSub: "Premi un pulsante e guarda il foglio sistemarsi da solo.",
    faq: [["Devo cambiare programma?", "No, si resta su Excel o Fogli Google, quello che usi già."], ["I miei dati restano privati?", "Sì: li uso solo per sistemare il foglio, non li condivido e posso lavorare anche su una copia senza dati personali."], ["Quando conviene un gestionale?", "Quando nel foglio lavorano più persone o servono agenda, promemoria e accessi diversi. Te lo dico io, onestamente."]],
    fineTit: "Hai un foglio che ti fa impazzire?"
  }
];

export const BISOGNI = [
  { ico: "clienti", tit: "Più clienti e visibilità", testo: "Farti trovare da chi ti cerca e farti scegliere.", servizi: ["siti", "video-factory"] },
  { ico: "mano", tit: "Meno lavoro a mano", testo: "Togliere le cose che ripeti ogni giorno.", servizi: ["automazioni", "assistenti"] },
  { ico: "ordine", tit: "Tutto in ordine", testo: "Clienti, agenda, conti e documenti sempre sotto controllo.", servizi: ["gestionali", "fogli"] }
];

/* passaggi del lavoro: [titolo, frase breve per la mappa, spiegazione] */
export const PASSI_LAVORO = [
  ["Ascolto", "Mi racconti come lavori e cosa ti pesa.", "Una call conoscitiva o il questionario: mi descrivi la tua giornata e i problemi, anche senza termini tecnici."],
  ["Mappa del tuo lavoro", "Metto in fila i passaggi e dove si perde tempo.", "Disegno la mappa dei tuoi passaggi: da dove arrivano i clienti, cosa fai a mano, dove si perdono tempo e richieste."],
  ["Prova concreta", "Ti mostro una demo sulla tua attività.", "Prima di qualsiasi impegno vedi una demo vicina al tuo lavoro e ricevi un preventivo scritto con cosa faccio, tempi e costi."],
  ["Costruisco", "Realizzo e collaudo la soluzione.", "Realizzo la soluzione concordata, la provo a fondo e te la consegno pronta da usare, spiegata con parole semplici."],
  ["Ti seguo", "Resto il tuo riferimento anche dopo.", "Dopo la consegna ti affianco per dubbi, modifiche e miglioramenti, secondo quanto scritto nel preventivo."]
];

export const PERCHE = [
  ["persona", "Nessun intermediario", "Parli direttamente con me, dall'idea all'assistenza. Nessuna agenzia in mezzo."],
  ["euro", "Nessun costo nascosto", "Nel preventivo c'è tutto quello che serve, anche manutenzione e costi ricorrenti, se ci sono."],
  ["doc", "Tutto per iscritto", "Cosa faccio, in quanto tempo e a quale prezzo: lo leggi prima di decidere. Nessun impegno."]
];

export const FAQ_HOME = [
  ["Quanto costa?", "Non ho un listino fisso perché ogni progetto è diverso. Dopo averne parlato ti preparo un preventivo scritto, concordato prima di iniziare."],
  ["Posso partire da qualcosa di piccolo?", "Certo. Anche una singola automazione o un sito essenziale sono un ottimo inizio. Le soluzioni sono pensate per crescere quando ti servirà."],
  ["Lavori con clienti in tutta Italia?", "Sì: ci sentiamo su WhatsApp o in videochiamata."],
  ["La call mi impegna?", "No. Serve a capire se e come posso aiutarti. Decidi tu se proseguire dopo aver ricevuto la proposta."],
  ["Usi l'intelligenza artificiale?", "Sì, per scrivere codice, creare scene e montare video, sempre sotto il mio controllo: ogni lavoro lo verifico io prima di consegnarlo. Gli assistenti che realizzo dicono sempre ai tuoi clienti di essere un programma."],
  ["Lavori anche per privati?", "Sì: anche per chi vuole mettere in ordine documenti, scadenze e progetti personali, o ha bisogno di un sito per sé."]
];
