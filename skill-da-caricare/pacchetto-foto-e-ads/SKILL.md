---
name: "pacchetto-foto-e-ads"
description: "Usa quando bisogna vendere a un'attività foto migliorate + video walkthrough (B&B, case vacanza, hotel, immobiliari, ristoranti), reel dalle foto di un annuncio immobiliare, o varianti di pubblicità mensili a chi fa già ads."
---

# Pacchetto foto e ads (metodo Iman Gadzhi adattato ad Alessandro)

Due offerte che si vendono con un assaggio gratuito. Strumento: sempre Horacle, mai Higgsfield (foto: nano-banana o GPT Image via Horacle e `upscale_image`; video: Kling 4.0 con `kling4-horacle` o Seedance con `seedance-horacle`). Si integra con bnb-video-agent, crea-ads-ugc, competitive-ads-extractor, prezzo-onesto.

Prima di scrivere a qualsiasi lead: leggere /topics/messaggi-potenziali-clienti.md e applicare le regole di primo contatto.

## Offerta A — Foto migliorate + video walkthrough
Clienti: B&B, case vacanza, annunci Airbnb/Booking, hotel, agenzie immobiliari, ristoranti.
Argomento di vendita: foto migliori = più clic = più prenotazioni e prezzo a notte più alto. Il cliente non paga le foto, paga le prenotazioni in più.

1. Trovare i lead: annunci con foto scure/storte/sgranate (Airbnb, Booking) o attività su Google Maps con foto scarse. Registrarli nel pannello.
2. Assaggio gratuito: SOLO 2–3 foto migliorate, con filigrana leggera o risoluzione ridotta (regola demo protette). Mai il pacchetto intero prima del sì.
3. Migliorare con Horacle: upscale_image per nitidezza/risoluzione; modifica d'immagine per luce, raddrizzamento, colori, ordine. Testare prima UNA foto, poi le altre con lo stesso prompt.
4. Controllo onestà (obbligatorio): ogni foto deve rappresentare la struttura com'è. Vietato aggiungere piscine, viste, mobili, metri quadri o servizi che non esistono. Si migliora la presentazione, non si inventa.
5. Dopo il sì: tutte le foto + video walkthrough/flyover come «bonus». Video con Seedance (prove a 720p/clip corte, finale alla massima qualità), montaggio professionale secondo le regole video di Alessandro.
6. Trasformare in canone: proporre reel mensili o contenuti social, così il cliente non è una tantum.

Prompt base per una foto (adattare al locale):
«Migliora questa foto di un annuncio di casa vacanza mantenendo identici ambienti, mobili, dimensioni e oggetti. Correggi esposizione e bilanciamento del bianco, raddrizza le linee verticali, aumenta nitidezza e dettaglio, luce naturale calda e realistica, stile fotografia immobiliare professionale. Non aggiungere né rimuovere elementi.»

## Offerta B — Ads mensili per chi fa già pubblicità
Clienti: attività che GIÀ pagano Meta Ads ma con creatività scarse. Si trovano nella Meta Ad Library (filtrare per zona/settore).
1. Scaricare/registrare il loro annuncio attuale come riferimento (competitive-ads-extractor).
2. Assaggio gratuito: 1–2 varianti, protette.
3. Varianti partendo dal LORO messaggio e script (stesso prodotto, offerta vera): cambiare hook, formato, visual, UGC (crea-ads-ugc). Niente promesse o prezzi inventati.
4. Offerta mensile: pacchetto fisso di nuove ads (es. 3 a settimana) con canone ricorrente. Argomento: le ads vanno testate in tante varianti per trovare quella che vende; un'agenzia ne fa una al prezzo di molte.

## Variante C — Reel dalle foto di un annuncio immobiliare (Enzo, reel/annuncio, 07/11/2026)
Clienti: agenzie immobiliari della zona. Quasi nessun annuncio ha un video: è lì lo spazio.
1. Scegliere UN immobile vero di un'agenzia: foto, prezzo, zona, metri quadri, locali presi dall'annuncio.
2. Caricare le foto su Horacle Video Edit (upload prima di generare) con questo messaggio:
   «Con queste foto crea un reel verticale che cammina dentro la casa, stanza per stanza, senza cambiare arredi, finestre o dimensioni. Inserisci nel montaggio prezzo e dettagli: [prezzo], [zona], [metri quadri], [locali]. Usa solo i dati che ti ho dato.»
   Prima: estimate_credits e prova corta a bassa risoluzione; segnare i crediti spesi per calcolare il prezzo mensile.
3. Controllo fotogramma per fotogramma (obbligatorio): l'IA inventa i passaggi tra le stanze. Scartare o rigenerare ogni scena con stanze, corridoi, viste dalle finestre, arredi o dimensioni che non sono nelle foto. Se non si riesce, montare solo le foto con movimenti di camera, senza camminata.
4. Avatar dell'agente con la sua voce: solo con consenso scritto, video segnalato come fatto con l'IA, e prima passare da ufficio-legale.
5. Foto dell'agenzia: il video si manda SOLO a quell'agenzia, protetto (regola demo protette). Mai pubblicarlo o usarlo come esempio con altri senza il suo permesso scritto.
6. Primo contatto: regole di outreach-legale-instantly e lista-non-contattare. Si manda il video già fatto, senza chiedere niente prima.
7. Vendere il servizio mensile: tutti gli immobili che l'agenzia mette in vendita o affitto ogni mese (prezzo con prezzo-onesto). Si vende il risultato («ogni tuo annuncio ha il suo video»), non lo strumento.

## Prezzi
Non usare i numeri in dollari del video. Calcolare con la skill prezzo-onesto e seguire la regola trattativa: prima il tempo/valore risparmiato, poi chiedere il budget massimo.

## Risparmio crediti (sempre)
1. Ricerca, piano e prompt con Claude/modelli economici: i crediti Horacle solo per generare.
2. Prove a bassa risoluzione e clip corte; qualità massima solo per il file finale (stime con estimate_credits prima di lanciare).
3. Prima di generare chiarire tutto col brief: niente tentativi a caso.
4. Musica libera e voce registrata/clonata a parte invece di audio generato.
5. Una foto/clip di prova prima del lotto intero.
6. Se una scena è sbagliata, rigenerare solo quella.

## Controllo finale
Prima di mostrarlo ad Alessandro: agent revisore controlla qualità, coerenza con il cliente e onestà delle foto.