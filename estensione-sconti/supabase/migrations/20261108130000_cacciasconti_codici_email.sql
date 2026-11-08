-- Cacciasconti: codici delle TUE email. Li scrive l'automazione dell'utente, li legge solo la Edge Function con la chiave personale.
-- Questo file è identico alla tabella già attiva nel progetto (stesse colonne, stessi controlli, stessa pulizia): applicarlo di nuovo non cambia i dati.
create table if not exists public.cacciasconti_codici_email (
  id bigint generated always as identity primary key,
  domain text not null check (char_length(domain) <= 253 and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  code text not null check (code ~ '^[A-Z0-9-]{3,25}$'),
  sconto text check (char_length(sconto) <= 80),
  scade_il date,
  email_data date,
  mittente text check (char_length(mittente) <= 120),
  created_at timestamptz default now(),
  unique (domain, code)
);

alter table public.cacciasconti_codici_email enable row level security;
-- Nessuna policy: anon e authenticated non leggono né scrivono. Passa tutto dalla Edge Function (service role) e dall'automazione.
revoke all on public.cacciasconti_codici_email from anon, authenticated;

-- Conservazione: via 7 giorni dopo la scadenza, e comunque dopo 180 giorni dalla creazione (ogni notte alle 03:20 UTC).
create extension if not exists pg_cron;
select cron.unschedule('cacciasconti_email_pulizia') where exists (select 1 from cron.job where jobname = 'cacciasconti_email_pulizia');
select cron.schedule('cacciasconti_email_pulizia', '20 3 * * *', $$
  delete from public.cacciasconti_codici_email
  where (scade_il is not null and scade_il < current_date - 7)
     or created_at < now() - interval '180 days';
$$);
