-- Cacciasconti: legge il contatore dell'ora corrente SENZA aumentarlo (serve al freno contro le chiavi personali sbagliate).
create or replace function public.cacciasconti_leggi(p_hash text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select n from public.cacciasconti_limiti where hash = p_hash and ora = date_trunc('hour', now())), 0);
$$;
revoke all on function public.cacciasconti_leggi(text) from public, anon, authenticated;
grant execute on function public.cacciasconti_leggi(text) to service_role;
