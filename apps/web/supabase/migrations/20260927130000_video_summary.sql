-- Short AI-generated plain-text summary for hosted videos / screen recordings.

alter table public.videos
  add column if not exists summary text;

comment on column public.videos.summary is
  'Short AI (or manually edited) plain-text summary shown on watch/workspace pages.';
