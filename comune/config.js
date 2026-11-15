/* CONFIGURAZIONE UNICA del sito e del questionario. Si cambia solo qui.

   PRENOTAZIONE CALL.
   Incolla qui il link della pagina di prenotazione di Google Calendar (Google Meet).
   Come si crea (2 minuti): in Google Calendar, "Crea" > "Pianificazione appuntamenti": imposta "Call conoscitiva" da 30 minuti
   e scegli di aggiungere Google Meet: il link Meet arriva da solo nell'invito. Poi copia il link della pagina di prenotazione,
   es. https://calendar.app.google/XXXX oppure https://calendar.google.com/calendar/appointments/schedules/...
   Google Calendar non permette di precompilare i campi: il link si apre così com'è. Funziona anche cal.com (con nome e riassunto
   precompilati) e Calendly. Deve iniziare con https://.
   Se resta vuoto: il pulsante «Prenota una call» porta al questionario e propone WhatsApp o email (nessun link rotto). */
const PRENOTA_URL = "";

/* Contatti pubblici (gli stessi del sito di prima). */
const CONTATTI = {
  nome: "Alessandro Mauro",
  whatsapp: "393394052935",          // solo cifre, con il prefisso 39
  telefono: "+39 339 405 2935",      // come si mostra
  email: "alessandromauro.works@gmail.com",
  /* !!! PARTITA IVA — DA COMPILARE !!!
     Per legge chi offre servizi con partita IVA deve indicarla sul sito (pié di pagina e Note legali).
     Oggi è vuota: il sito non mostra nessun numero. Appena aperta, scrivila qui (es. "IT01234567890")
     e anche nei file HTML generati: basta rilanciare `node sorgente-sito/genera.mjs`. */
  partitaIva: ""
};
