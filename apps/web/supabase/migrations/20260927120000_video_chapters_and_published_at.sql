-- Chapters (AI/manual) and publish timestamp for hosted videos / screen recordings.

alter table public.videos
  add column if not exists chapters jsonb not null default '[]'::jsonb;

alter table public.videos
  add column if not exists published_at timestamptz;

comment on column public.videos.chapters is
  'Playback chapters [{ id, title, startMs }] for watch UI; times are in edited/playback ms.';

comment on column public.videos.published_at is
  'When the video was last published for public watch / share.';
