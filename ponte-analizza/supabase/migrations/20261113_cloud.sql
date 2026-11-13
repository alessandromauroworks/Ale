-- Analizza nel cloud (GitHub Actions) quando il PC e' spento.
-- Il PC resta il lavoratore principale (fa anche l'analisi con IA). Il cloud prende un link solo se:
--   * il PC non manda il battito da piu' di 2 minuti, oppure il link aspetta da piu' di 10 minuti;
--   * la piattaforma e' tra quelle che dal cloud si scaricano (vedi analizza_cloud_idoneo);
--   * non e' un «solo video» (quello serve al telefono e lo fa il PC);
--   * il cloud non ci ha gia' provato (cloud_nota vuota).
-- Se il cloud non ce la fa, il link torna «in_attesa» con cloud_nota = motivo: lo fara' il PC.

alter table public.coda_analisi
  add column if not exists lavorato_da text,
  add column if not exists cloud_nota text;

comment on column public.coda_analisi.lavorato_da is 'chi ha preso il lavoro: pc oppure cloud';
comment on column public.coda_analisi.cloud_nota is 'perche'' il cloud non l''ha fatto (il link resta per il PC). Vuota = il cloud puo'' provarci';

alter table public.ponte_stato
  add column if not exists ultimo_avvio_cloud timestamptz;

-- Quali link puo' fare il cloud. Elenco deciso con la prova del 13/11/2026: cambiarlo solo qui.
create or replace function public.analizza_cloud_idoneo(p_link text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce((
    select bool_or(h = d or h like '%.' || d)
      from (select lower(substring(coalesce(p_link, '') from '^https?://([^/?#:]+)')) as h) x,
           unnest(array['tiktok.com', 'instagram.com']) as d
  ), false);
$$;

-- Il PC (ponte) continua a usare questa funzione: ora segna anche lavorato_da = 'pc'.
create or replace function public.prendi_prossima_analisi()
returns setof public.coda_analisi language sql security definer set search_path = public as $$
  update public.coda_analisi c
     set stato = 'in_lavoro', preso_il = now(), lavorato_da = 'pc'
   where c.id = (
     select id from public.coda_analisi
      where stato = 'in_attesa'
         or (stato = 'in_lavoro' and preso_il < now() - interval '30 minutes')
      order by creato_il
      limit 1
      for update skip locked)
  returning c.*;
$$;

-- Il cloud prende UN link alla volta, con lo stesso blocco del PC (mai due volte lo stesso link).
create or replace function public.prendi_analisi_cloud()
returns setof public.coda_analisi language sql security definer set search_path = public as $$
  update public.coda_analisi c
     set stato = 'in_lavoro', preso_il = now(), lavorato_da = 'cloud'
   where c.id = (
     select id from public.coda_analisi
      where stato = 'in_attesa' and not solo_video and cloud_nota is null
        and public.analizza_cloud_idoneo(link)
      order by creato_il
      limit 1
      for update skip locked)
  returning c.*;
$$;

-- Chiamata ogni minuto (dalla Edge Function analizza-cloud, azione «sveglia»).
-- 1) i lavori del cloud rimasti a meta' da piu' di 35 minuti tornano al PC;
-- 2) ritorna true se c'e' lavoro per il cloud e l'ultimo avvio e' di almeno 4 minuti fa
--    (e in quel caso segna l'avvio: il controllo e' atomico, niente doppi avvii).
create or replace function public.analizza_cloud_sveglia()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  pc_acceso boolean;
  da_fare integer;
  avviato integer;
begin
  update public.coda_analisi
     set stato = 'in_attesa', preso_il = null, lavorato_da = null,
         cloud_nota = 'Il lavoro nel cloud si e'' interrotto: lo fara'' il PC.'
   where stato = 'in_lavoro' and lavorato_da = 'cloud' and preso_il < now() - interval '35 minutes';

  select coalesce(ultimo_battito > now() - interval '2 minutes', false)
    into pc_acceso from public.ponte_stato where id = 1;

  select count(*) into da_fare from public.coda_analisi
   where stato = 'in_attesa' and not solo_video and cloud_nota is null
     and public.analizza_cloud_idoneo(link)
     and (not coalesce(pc_acceso, false) or creato_il < now() - interval '10 minutes');

  if da_fare = 0 then
    return false;
  end if;

  update public.ponte_stato set ultimo_avvio_cloud = now()
   where id = 1 and (ultimo_avvio_cloud is null or ultimo_avvio_cloud < now() - interval '4 minutes');
  get diagnostics avviato = row_count;
  return avviato > 0;
end;
$$;

-- Solo il server (chiave service_role, usata dalla Edge Function) puo' chiamarle.
revoke all on function public.prendi_analisi_cloud() from public, anon, authenticated;
revoke all on function public.analizza_cloud_sveglia() from public, anon, authenticated;
grant execute on function public.prendi_analisi_cloud() to service_role;
grant execute on function public.analizza_cloud_sveglia() to service_role;

-- Ogni minuto: la «sveglia» guarda se serve il cloud (applicata come migrazione analizza_cloud_cron).
select cron.schedule(
  'analizza-cloud-sveglia',
  '* * * * *',
  $$select net.http_post(
      url := 'https://udubhzamghhlkxgepmmc.supabase.co/functions/v1/analizza-cloud',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"azione": "sveglia"}'::jsonb,
      timeout_milliseconds := 20000)$$
);
