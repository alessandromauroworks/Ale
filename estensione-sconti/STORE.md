# Cacciasconti: scheda per gli store

Testi pronti da copiare per Chrome Web Store e Microsoft Edge Add-ons.

## Categoria
Shopping

## Descrizione breve (max 132 caratteri)
Al pagamento prova i codici sconto per te e applica il migliore. Di base tutto resta sul tuo computer, nessun affiliato.

## Descrizione lunga
Cacciasconti ti fa risparmiare al momento del pagamento, senza trucchi.

Come funziona:
- Mentre navighi, cerca nelle pagine dei negozi i codici sconto che il negozio stesso mostra (banner, popup, testi).
- Quando arrivi al carrello o alla cassa, ti propone di provare i codici.
- Con un clic prova i codici uno alla volta nel campo del negozio, scarta quelli che non funzionano e applica il migliore.
- Ti mostra quanto risparmi e, per ogni codice, quando è stato provato e perché non ha funzionato (non valido, scaduto, importo minimo...).
- Tiene lo storico dei tuoi risparmi e puoi salvare o ricaricare i tuoi codici in un file.

Rispetto alle altre estensioni di coupon:
- Di base non invia nulla a nessuno: niente account, niente statistiche. Il testo delle pagine si legge solo sul tuo computer per trovare codici.
- Condivisione anonima FACOLTATIVA (spenta di base, la accendi tu nelle Opzioni): se la accendi, prima di una prova scarica i codici segnalati per il sito che visiti e dopo ogni prova invia solo dominio del sito, codice, se ha funzionato e percentuale di sconto (mai i codici scritti a mano, nessun IP salvato). Puoi spegnerla quando vuoi.
- Nessun link di affiliazione. Non legge e non modifica i cookie.
- Di base i codici sono quelli trovati da te sui siti che visiti, quelli delle pagine promo dello stesso negozio, più una piccola lista di codici comuni che puoi disattivare.

Limiti onesti: non esistono codici per tutti i negozi, non funziona su ogni cassa, alcuni siti bloccano i troppi tentativi (in quel caso l'estensione si ferma) e i codici personali non funzionano per altri.

## Scopo unico (single purpose)
Trovare e provare i codici sconto sulla pagina del carrello o della cassa di un negozio online e applicare quello che fa risparmiare di più.

## Motivazione dei permessi
- **storage**: salva sul computer i codici, i risultati delle prove, lo storico dei risparmi e le impostazioni.
- **scripting**: permette di caricare lo script nella scheda già aperta prima dell'installazione, quando l'utente apre la finestra dell'estensione.
- **Accesso a tutti i siti (host_permissions <all_urls>)**: i negozi online sono migliaia e non si possono elencare. Serve per leggere il testo delle pagine alla ricerca di codici sconto (solo sul computer dell'utente), per scrivere nel campo coupon della cassa, per scaricare le poche pagine promo dello stesso negozio e, solo se l'utente accende la condivisione, per parlare con il servizio dei codici condivisi. Il testo letto non viene salvato né inviato, a parte i codici trovati (salvati solo sul computer).
- Non sono richiesti `activeTab` (ridondante con l'accesso a tutti i siti), `alarms`, `cookies`.

## Uso dei dati (Data use disclosure)
- Di base: dati raccolti **nessuno**. "Contenuto dei siti web": il testo delle pagine si elabora solo sul computer dell'utente per trovare i codici e non viene trasmesso.
- Da dichiarare nel modulo dei dati: **"Attività di navigazione sul web"** = solo il dominio del negozio, inviato SOLO se l'utente accende la condivisione facoltativa; mai venduto, mai usato per pubblicità.
- Cacciasconti non inserisce link di affiliazione né propri codici di tracciamento.
- **Solo se l'utente accende "Condividi codici funzionanti (anonimo)"** (spento di base) si inviano: sito (dominio), codice, se ha funzionato, percentuale di sconto. Nessun account, nessun IP salvato (solo un hash con sale giornaliero per limitare gli abusi, cancellato dopo 24 ore); le segnalazioni si cancellano dopo 90 giorni. Titolare: Alessandro Mauro, alessandromauro.works@gmail.com. I codici scritti a mano dall'utente non si inviano mai.
- L'"esploratore del negozio" scarica poche pagine pubbliche (max 8, una volta al giorno) dello STESSO negozio che l'utente sta visitando, senza cookie, rispettando robots.txt; non scarica siti di terzi.
- BOZZA da far controllare (privacy/legale) prima della pubblicazione: nella scheda dello store va dichiarata la raccolta opzionale di "attività di navigazione" (dominio).
- I dati salvati (codici, risultati, risparmi, impostazioni) restano nel browser dell'utente.
- Non vendiamo, non condividiamo e non trasferiamo dati a terzi.
- Non usiamo i dati per scopi estranei alla funzione unica dell'estensione.
- Nessun codice remoto: tutto il codice è dentro il pacchetto.
- Informativa: file `privacy.html` (da pubblicare a un indirizzo web, vedi sotto).

## Immagini per la scheda
Nella cartella `store/` ci sono due schermate 1280x800:
- `schermata-1-popup.png`: la finestra con i codici e il risultato.
- `schermata-2-risultato.png`: il pannello sulla pagina del negozio dopo una prova riuscita.
L'icona 128x128 è in `icons/icon128.png`. (Le schermate sono fatte su negozi finti di prova.)

## Come pubblicare

### 1. Crea il pacchetto
Dalla cartella `estensione-sconti` esegui `./pacchetto.sh`. Crea DUE file: `dist/cacciasconti-<versione>-chrome.zip` (Chrome, Edge, Brave, Opera) e `dist/cacciasconti-<versione>-firefox.zip` (Firefox, con il manifest adattato).

### 2. Chrome Web Store (vale anche per Brave e Opera)
1. Vai su https://chrome.google.com/webstore/devconsole e accedi con un account Google.
2. Paga la quota di iscrizione, una volta sola: 5 dollari.
3. Premi "Nuovo elemento" e carica lo zip.
4. Compila la scheda con i testi sopra, aggiungi le schermate e l'icona.
5. Scheda "Privacy": inserisci lo scopo unico, la motivazione dei permessi e dichiara che non raccogli dati. Per l'informativa serve un indirizzo web: pubblica `privacy.html` (per esempio con GitHub Pages) e incolla il link.
6. In "Distribuzione" scegli la visibilità: **Non in elenco** (solo chi ha il link) oppure **Privata** (solo account che indichi tu). Per uso personale va bene una di queste due.
7. Invia in revisione. Di solito servono da poche ore a qualche giorno.
8. Brave si installa dal Chrome Web Store, quindi usa lo stesso elemento.

### 3. Microsoft Edge Add-ons
1. Vai su https://partner.microsoft.com/dashboard/microsoftedge e accedi (iscrizione gratuita).
2. Premi "Crea una nuova estensione" e carica lo stesso zip.
3. Compila i testi, la categoria Shopping, le schermate e il link all'informativa.
4. Scegli la visibilità (nascosta o pubblica) e invia. 

### 4. Firefox (AMO)
1. Vai su https://addons.mozilla.org/developers/ e accedi (gratis).
2. "Invia un nuovo componente aggiuntivo", carica lo zip `-firefox.zip`.
3. Scegli **"Su questo sito"** (pubblico) oppure **"Da solo"** = distribuzione propria/non in elenco: Mozilla lo firma gratis e ti restituisce un `.xpi` da installare. La firma è obbligatoria per l'installazione permanente su Firefox.
4. Id dell'estensione: `cacciasconti@alessandro.local` (nel manifest). Firefox richiede Firefox 128 o più nuovo (serve per `match_origin_as_fallback`).
5. Per provarla subito senza firma: `about:debugging` > Questo Firefox > **Carica componente aggiuntivo temporaneo** > scegli `manifest.json` (sparisce alla chiusura di Firefox).
6. In Firefox i permessi sui siti sono facoltativi: al primo avvio il popup mostra "Dai il permesso" per "tutti i siti".

### 5. Aggiornamenti
Aumenta `version` in `manifest.json`, aggiorna `CHANGELOG.md`, rilancia `./pacchetto.sh` e carica i nuovi zip. Gli aggiornamenti automatici arrivano agli utenti SOLO tramite Chrome Web Store, Edge Add-ons e AMO (Firefox).
