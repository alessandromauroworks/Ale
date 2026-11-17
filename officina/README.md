# Officina · pannello personale di Antonio

Pannello personale di Antonio (capofficina, carpenteria metallica con taglio laser). Lo usa solo lui, dal PC principale e dal telefono.
Link: https://alessandromauroworks.github.io/Ale/officina/

## Le 5 domande (skill gestionale-per-settore)
1. **Come lavora in una giornata:** riceve fogli di carta con disegni e liste pezzi da aziende e privati, file e vocali su WhatsApp (telefono e PC), modifiche a voce. Disegna in AutoCAD e SolidWorks su due PC (uno collegato al laser), poi taglia le lamiere. Oggi tiene tutto su carta e in memoria.
2. **Dove perde tempo o rischia:** pezzi saltati o dimenticati; non sapere a che punto è ogni lavoro; modifiche arrivate a voce o su WhatsApp che si perdono; troppi cambi di lamiera al laser.
3. **Moduli:** lavori con stato (Da disegnare → Disegnato → Da tagliare → Tagliato → Consegnato) e scadenza; pezzi per lavoro con spunta; coda laser raggruppata per materiale e spessore; schermata Oggi (ritardi, scadenze, pezzi da tagliare). Avviso bloccante se si chiude un lavoro con pezzi non spuntati.
4. **Obblighi di legge:** nessun obbligo di settore per un pannello personale. I disegni e i file dei clienti sono riservati: per scelta il pannello **non** contiene file, solo appunti e il percorso della cartella sul PC.
5. **Dati sensibili:** nessuno (niente salute, documenti o dati bancari). Solo nomi dei clienti aziendali e descrizioni dei pezzi.

## Sicurezza
- Database: progetto Supabase «Alessandro», tabelle `officina_lavori` e `officina_pezzi`, RLS: ognuno vede solo le sue righe e solo se la sua email è in `officina_utenti`.
- Registrazione bloccata a livello di database (trigger su `auth.users`): può creare un account solo un'email presente in `officina_utenti`. Vale per tutto il progetto «Alessandro».
- Nessuna chiave segreta nella pagina (solo la chiave pubblica).

## Accesso
- Antonio entra solo con un **codice di 6 cifre**, una volta per dispositivo; poi la sessione resta aperta.
- Il codice è salvato cifrato (bcrypt) in `private.officina_codice` e lo controlla `public.officina_controlla_codice` (solo service_role), chiamata dalla Edge Function `officina-accesso` (`supabase/functions/officina-accesso/`). Blocchi: 5 sbagliati = 15 minuti, 20 in 24 ore = 24 ore. Tentativi in `officina_tentativi`.
- Account nascosto: `antonio@officina.invalid` (nessuna email reale, password inutilizzabile).
- **Impostare o cambiare il codice:** Supabase › SQL Editor › `select public.officina_imposta_codice('123456');` (con le proprie 6 cifre) › Run.

## Clienti da caricare nell'account di Antonio
Sono le sottocartelle della cartella Laser sul server. Si caricano in `officina_clienti` appena esiste il suo account, con la cartella base `<percorso Laser>\<nome>` (percorso Laser da chiedere).

Princes · Officina (lavori interni) · Leonardo · Privati · Giblas (ingegnere, lavori con privati) · Acquedotto Pugliese · Barilla · Ceflatech · Progetto Ambiente (rifiuti) · Pasta Armando · Nonno (lavori dei privati principali) · Fiat · IPZS · Sisecam · Ferrovie FS · Simpro · Enterra · Renzullo (lavori personali del titolare) · Bisiac

Da confermare la scrittura: Simpro, Enterra, Bisiac. Possono essercene altri.
