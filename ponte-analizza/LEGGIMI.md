# Ponte Analizza

## A cosa serve
1. Claude lavora nel cloud e scrive i link da analizzare nella coda su Supabase.
2. Questo ponte, sul tuo PC, guarda la coda ogni 30 secondi.
3. Quando trova un link, lo passa ad Analizza e aspetta il report.
4. Poi rimette il report nella coda, e Claude lo legge.

## Installazione
1. Copia questa cartella in `Desktop\Lavoro IA\App\ponte-analizza`.
2. Dentro, copia `.env.esempio` e chiama la copia `.env`.
3. Prendi la chiave: Supabase, progetto Alessandro, Project Settings, API Keys, chiave **service_role**. Incollala nel `.env` dopo `SUPABASE_SERVICE_KEY=`.
   **Attenzione:** e' una chiave segreta. Resta solo sul PC. Non incollarla mai in chat.
4. Prova i collegamenti: apri il Prompt dei comandi nella cartella e scrivi `python ponte_analizza.py --prova`. Deve dire OK per Supabase e per la cartella dei report.
5. Avvio: doppio clic su `AVVIA_PONTE.bat`. La finestra deve restare aperta.
6. Avvio automatico all'accensione: crea una scorciatoia di `AVVIA_PONTE.bat`, premi Windows+R, scrivi `shell:startup` e metti la scorciatoia in quella cartella.

Per fare un solo giro di prova: `python ponte_analizza.py --una-volta`. Il registro di cosa succede e' nel file `ponte.log`.

## Da fare la prima volta
Il pezzo `avvia_analisi` va collegato all'app Analizza vera: la prima volta apri una sessione locale di Claude Code sul PC e chiedi «collega il ponte ad Analizza»; Claude legge il codice di Analizza e lo adatta.
