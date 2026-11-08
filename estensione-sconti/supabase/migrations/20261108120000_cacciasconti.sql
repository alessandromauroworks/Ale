-- Cacciasconti: codici condivisi (BOZZA da controllare prima della distribuzione pubblica).
-- Tocca SOLO oggetti con prefisso cacciasconti_. Nessun id utente, nessun IP salvato.

create table if not exists public.cacciasconti_reports (
  id bigint generated always as identity primary key,
  domain text not null check (char_length(domain) <= 253 and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'),
  code text not null check (code ~ '^[A-Z0-9-]{3,25}$'),
  worked boolean not null,
  saving_pct numeric(5,2) check (saving_pct is null or (saving_pct >= 0 and saving_pct <= 100)),
  created_at timestamptz not null default now()
);
create index if not exists cacciasconti_reports_dom_idx on public.cacciasconti_reports (domain, created_at desc);
create index if not exists cacciasconti_reports_created_idx on public.cacciasconti_reports (created_at);

-- Limite di invii: si salva solo un hash (IP + sale del giorno), cancellato dopo 24 ore.
create table if not exists public.cacciasconti_limiti (
  hash text not null,
  ora timestamptz not null,
  n integer not null default 0,
  primary key (hash, ora)
);

alter table public.cacciasconti_reports enable row level security;
alter table public.cacciasconti_limiti enable row level security;
-- Nessuna policy: anon e authenticated non possono leggere né scrivere. Passa tutto dalla Edge Function (service role).
revoke all on public.cacciasconti_reports from anon, authenticated;
revoke all on public.cacciasconti_limiti from anon, authenticated;

-- Conta un invio per l'hash nell'ora corrente e restituisce quanti ce ne sono.
create or replace function public.cacciasconti_conta(p_hash text)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  insert into public.cacciasconti_limiti (hash, ora, n) values (p_hash, date_trunc('hour', now()), 1)
  on conflict (hash, ora) do update set n = public.cacciasconti_limiti.n + 1
  returning n into v;
  return v;
end $$;
revoke all on function public.cacciasconti_conta(text) from public, anon, authenticated;
grant execute on function public.cacciasconti_conta(text) to service_role;

-- Percentuale di successo per sito + codice negli ultimi 30 giorni.
create or replace view public.cacciasconti_stats_30g with (security_invoker = true) as
select domain, code,
       count(*)::int as n_report,
       count(*) filter (where worked)::int as n_successi,
       round(100.0 * count(*) filter (where worked) / count(*), 1) as tasso_successo,
       max(created_at) filter (where worked) as ultimo_successo,
       round(avg(saving_pct) filter (where worked), 1) as sconto_medio_pct
from public.cacciasconti_reports
where created_at > now() - interval '30 days'
group by domain, code;
revoke all on public.cacciasconti_stats_30g from anon, authenticated;
grant select on public.cacciasconti_stats_30g to service_role;

-- Pulizia: segnalazioni dopo 90 giorni, hash dopo 24 ore (ogni notte alle 03:10 UTC).
create extension if not exists pg_cron;
select cron.unschedule('cacciasconti_pulizia') where exists (select 1 from cron.job where jobname = 'cacciasconti_pulizia');
select cron.schedule('cacciasconti_pulizia', '10 3 * * *', $$
  delete from public.cacciasconti_reports where created_at < now() - interval '90 days';
  delete from public.cacciasconti_limiti where ora < now() - interval '24 hours';
$$);
