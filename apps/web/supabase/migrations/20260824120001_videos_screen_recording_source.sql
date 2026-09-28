-- Screen recordings from Ozer Assistant

alter table public.videos
  add column if not exists source text not null default 'upload',
  add column if not exists recorded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_source_check'
  ) then
    alter table public.videos
      add constraint videos_source_check
      check (source in ('upload', 'screen_recording'));
  end if;
end $$;

comment on column public.videos.source is
  'Origin of the video: browser upload or Ozer Assistant screen recording.';
comment on column public.videos.recorded_at is
  'When the screen recording was captured on device (optional).';
