-- Applicata il 08/11/2026 al progetto Supabase «Alessandro» (ref udubhzamghhlkxgepmmc, eu-west-1) come migrazione «questionari_pre_call».
-- Questionario Prima Call: risposte salvate dalla pagina pubblica tramite la Edge Function questionario-ricevi.
-- RLS attiva e nessuna policy: anon e authenticated non leggono e non scrivono. Scrive solo la funzione (service role).
create table if not exists public.questionari (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  settore text not null check (char_length(settore) between 1 and 80),
  nome text not null check (char_length(nome) between 1 and 80),
  attivita text not null check (char_length(attivita) between 1 and 80),
  telefono text not null check (char_length(telefono) between 6 and 25),
  risposte jsonb not null,
  codice_qc1 text not null check (char_length(codice_qc1) between 5 and 40000),
  importato_il timestamptz,
  stato text not null default 'nuovo' check (stato in ('nuovo','importato','cliente','scartato'))
);
comment on table public.questionari is 'Questionari pre-call. Cancellati dopo 12 mesi se stato <> cliente (pg_cron questionari-pulizia). Niente dati sanitari.';
create index if not exists questionari_da_importare on public.questionari (creato_il) where importato_il is null;
create index if not exists questionari_tel_recenti on public.questionari (telefono, creato_il);

-- Limite di invii per IP (impronta HMAC, mai l'IP in chiaro). Righe tenute 2 giorni.
create table if not exists public.questionari_limiti (
  id bigint generated always as identity primary key,
  chiave text not null check (char_length(chiave) <= 100),
  creato_il timestamptz not null default now()
);
create index if not exists questionari_limiti_chiave on public.questionari_limiti (chiave, creato_il);

-- Registro esecuzioni della funzione (solo esito e motivo, nessun dato personale). Tenuto 90 giorni.
create table if not exists public.questionari_log (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  esito text not null check (char_length(esito) <= 40),
  dettaglio text check (char_length(dettaglio) <= 300)
);

alter table public.questionari enable row level security;
alter table public.questionari_limiti enable row level security;
alter table public.questionari_log enable row level security;
revoke all on public.questionari, public.questionari_limiti, public.questionari_log from anon, authenticated;

-- Pulizia automatica ogni notte alle 03:17 UTC
select cron.unschedule(jobid) from cron.job where jobname = 'questionari-pulizia';
select cron.schedule('questionari-pulizia', '17 3 * * *', $$
  delete from public.questionari where creato_il < now() - interval '12 months' and stato <> 'cliente';
  delete from public.questionari_limiti where creato_il < now() - interval '2 days';
  delete from public.questionari_log where quando < now() - interval '90 days';
$$);
