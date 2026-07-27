-- Instant timeline publish + dual audio sidecar paths for screen recordings

alter table public.videos
  add column if not exists published_timeline jsonb;

alter table public.videos
  add column if not exists baked_revision integer not null default 0;

comment on column public.videos.published_timeline is
  'Snapshot of the edit timeline currently live on the public watch page (player-composed).';

comment on column public.videos.published_revision is
  'Edit revision currently live on the public watch page (instant publish).';

comment on column public.videos.baked_revision is
  'Edit revision last successfully baked and swapped onto Bunny Stream.';

alter table public.video_masters
  add column if not exists mic_storage_path text;

alter table public.video_masters
  add column if not exists system_storage_path text;

comment on column public.video_masters.mic_storage_path is
  'Optional microphone-only AAC sidecar for independent gain/mute in the editor.';

comment on column public.video_masters.system_storage_path is
  'Optional system-audio-only AAC sidecar for independent gain/mute in the editor.';
