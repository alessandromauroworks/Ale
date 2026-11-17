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
- Accesso: email e password una volta per dispositivo, poi un codice di 4 cifre (5 errori = serve di nuovo l'accesso completo). Il codice protegge il dispositivo, non il server: dal server senza il primo accesso non entra nessuno.
- Nessuna chiave segreta nella pagina (solo la chiave pubblica).

## Aggiungere l'account di Antonio
1. In Supabase › SQL: `insert into public.officina_utenti(email) values ('email-di-antonio');`
2. Supabase › Authentication › Users › Add user › email e password (spunta «Auto confirm»).
3. Sul PC e sul telefono di Antonio: apri il link, inserisci email e password, scegli il codice di 4 cifre insieme a lui.
