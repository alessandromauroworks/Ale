-- Il codice di riserva QC1 (Safari vecchi, senza compressione) con risposte lunghissime supera 40000 caratteri.
-- La funzione «questionario-ricevi» ora accetta fino a 96000: la colonna deve accettarlo, altrimenti il salvataggio fallisce.
-- Da applicare PRIMA (o insieme) al deploy della funzione. Non cambia nessun dato esistente.
alter table public.questionari drop constraint if exists questionari_codice_qc1_check;
alter table public.questionari add constraint questionari_codice_qc1_check check (char_length(codice_qc1) between 5 and 96000);
