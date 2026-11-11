-- Video scaricabile dal telefono (Convertitore / Analizza).
-- Colonne nuove su coda_analisi + cartella privata "analizza-video" nello Storage.
-- La cartella e' privata: la leggono solo il ponte (chiave service_role) e la
-- funzione analizza-coda, che da' al telefono link firmati validi un'ora.
-- I video si cancellano dopo 7 giorni (lo fa il ponte sul PC).

alter table public.coda_analisi
  add column if not exists solo_video boolean not null default false,
  add column if not exists video_originale text,
  add column if not exists video_iphone text,
  add column if not exists video_info jsonb;

comment on column public.coda_analisi.solo_video is 'true = scarica solo il video, senza analisi';
comment on column public.coda_analisi.video_originale is 'percorso nello Storage (bucket analizza-video) del file identico a quello della piattaforma';
comment on column public.coda_analisi.video_iphone is 'percorso della copia H.264 che si apre in Foto su iPhone (uguale a video_originale se gia'' H.264)';
comment on column public.coda_analisi.video_info is 'nome file, risoluzione, codec, peso, note';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('analizza-video', 'analizza-video', false, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'])
on conflict (id) do nothing;
