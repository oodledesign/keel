-- Screen recording web editor: masters, edit projects, transcripts, export jobs

alter table public.videos
  add column if not exists has_master boolean not null default false;

alter table public.videos
  add column if not exists edit_revision integer not null default 0;

alter table public.videos
  add column if not exists published_revision integer not null default 0;

comment on column public.videos.has_master is
  'True when a re-editable master asset is stored for this video.';
comment on column public.videos.edit_revision is
  'Monotonic revision of the non-destructive edit project.';
comment on column public.videos.published_revision is
  'Edit revision that was last baked to Bunny Stream.';

create table if not exists public.video_masters (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  storage_path text not null,
  content_type text not null default 'video/mp4',
  byte_size bigint,
  width integer,
  height integer,
  duration_ms integer,
  sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_masters_video_id_unique unique (video_id)
);

create index if not exists ix_video_masters_account_id
  on public.video_masters (account_id);

comment on table public.video_masters is
  'Original screen-recording masters used by the web editor.';

create table if not exists public.video_edit_projects (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  revision integer not null default 1,
  timeline jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_edit_projects_video_id_unique unique (video_id)
);

create index if not exists ix_video_edit_projects_account_id
  on public.video_edit_projects (account_id);

comment on table public.video_edit_projects is
  'Non-destructive edit timelines (cuts, clicks, zooms) for hosted videos.';

create table if not exists public.video_transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  plain_text text not null default '',
  words jsonb not null default '[]'::jsonb,
  provider text,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_transcripts_video_id_unique unique (video_id),
  constraint video_transcripts_status_check check (
    status in ('pending', 'ready', 'failed')
  )
);

create index if not exists ix_video_transcripts_account_id
  on public.video_transcripts (account_id);

comment on table public.video_transcripts is
  'Word-timed transcripts for transcript-driven video cuts.';

create table if not exists public.video_export_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  status text not null default 'queued',
  progress numeric not null default 0,
  error text,
  output_bunny_video_id text,
  requested_by uuid references auth.users (id) on delete set null,
  edit_revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_export_jobs_status_check check (
    status in ('queued', 'processing', 'uploading', 'completed', 'failed')
  )
);

create index if not exists ix_video_export_jobs_video_id
  on public.video_export_jobs (video_id);

create index if not exists ix_video_export_jobs_account_status
  on public.video_export_jobs (account_id, status);

comment on table public.video_export_jobs is
  'Bake-and-republish jobs for edited screen recordings.';

drop trigger if exists video_masters_set_timestamps on public.video_masters;
create trigger video_masters_set_timestamps
  before update on public.video_masters
  for each row
  execute procedure public.trigger_set_timestamps();

drop trigger if exists video_edit_projects_set_timestamps on public.video_edit_projects;
create trigger video_edit_projects_set_timestamps
  before update on public.video_edit_projects
  for each row
  execute procedure public.trigger_set_timestamps();

drop trigger if exists video_transcripts_set_timestamps on public.video_transcripts;
create trigger video_transcripts_set_timestamps
  before update on public.video_transcripts
  for each row
  execute procedure public.trigger_set_timestamps();

drop trigger if exists video_export_jobs_set_timestamps on public.video_export_jobs;
create trigger video_export_jobs_set_timestamps
  before update on public.video_export_jobs
  for each row
  execute procedure public.trigger_set_timestamps();

alter table public.video_masters enable row level security;
alter table public.video_edit_projects enable row level security;
alter table public.video_transcripts enable row level security;
alter table public.video_export_jobs enable row level security;

grant select, insert, update, delete on public.video_masters to authenticated, service_role;
grant select, insert, update, delete on public.video_edit_projects to authenticated, service_role;
grant select, insert, update, delete on public.video_transcripts to authenticated, service_role;
grant select, insert, update, delete on public.video_export_jobs to authenticated, service_role;

drop policy if exists video_masters_select on public.video_masters;
create policy video_masters_select on public.video_masters
  for select to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_masters_insert on public.video_masters;
create policy video_masters_insert on public.video_masters
  for insert to authenticated
  with check (public.has_role_on_account (account_id));

drop policy if exists video_masters_update on public.video_masters;
create policy video_masters_update on public.video_masters
  for update to authenticated
  using (public.has_role_on_account (account_id))
  with check (public.has_role_on_account (account_id));

drop policy if exists video_masters_delete on public.video_masters;
create policy video_masters_delete on public.video_masters
  for delete to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_edit_projects_select on public.video_edit_projects;
create policy video_edit_projects_select on public.video_edit_projects
  for select to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_edit_projects_insert on public.video_edit_projects;
create policy video_edit_projects_insert on public.video_edit_projects
  for insert to authenticated
  with check (public.has_role_on_account (account_id));

drop policy if exists video_edit_projects_update on public.video_edit_projects;
create policy video_edit_projects_update on public.video_edit_projects
  for update to authenticated
  using (public.has_role_on_account (account_id))
  with check (public.has_role_on_account (account_id));

drop policy if exists video_edit_projects_delete on public.video_edit_projects;
create policy video_edit_projects_delete on public.video_edit_projects
  for delete to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_transcripts_select on public.video_transcripts;
create policy video_transcripts_select on public.video_transcripts
  for select to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_transcripts_insert on public.video_transcripts;
create policy video_transcripts_insert on public.video_transcripts
  for insert to authenticated
  with check (public.has_role_on_account (account_id));

drop policy if exists video_transcripts_update on public.video_transcripts;
create policy video_transcripts_update on public.video_transcripts
  for update to authenticated
  using (public.has_role_on_account (account_id))
  with check (public.has_role_on_account (account_id));

drop policy if exists video_transcripts_delete on public.video_transcripts;
create policy video_transcripts_delete on public.video_transcripts
  for delete to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_export_jobs_select on public.video_export_jobs;
create policy video_export_jobs_select on public.video_export_jobs
  for select to authenticated
  using (public.has_role_on_account (account_id));

drop policy if exists video_export_jobs_insert on public.video_export_jobs;
create policy video_export_jobs_insert on public.video_export_jobs
  for insert to authenticated
  with check (public.has_role_on_account (account_id));

drop policy if exists video_export_jobs_update on public.video_export_jobs;
create policy video_export_jobs_update on public.video_export_jobs
  for update to authenticated
  using (public.has_role_on_account (account_id))
  with check (public.has_role_on_account (account_id));

drop policy if exists video_export_jobs_delete on public.video_export_jobs;
create policy video_export_jobs_delete on public.video_export_jobs
  for delete to authenticated
  using (public.has_role_on_account (account_id));

-- Private masters bucket (path: {account_id}/{video_id}/master.mp4)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-masters',
  'video-masters',
  false,
  5368709120,
  array['video/mp4', 'video/webm', 'video/quicktime', 'application/json']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists video_masters_storage_select on storage.objects;
create policy video_masters_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'video-masters'
    and public.has_role_on_account ((storage.foldername (name))[1]::uuid)
  );

drop policy if exists video_masters_storage_insert on storage.objects;
create policy video_masters_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'video-masters'
    and public.has_role_on_account ((storage.foldername (name))[1]::uuid)
  );

drop policy if exists video_masters_storage_update on storage.objects;
create policy video_masters_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'video-masters'
    and public.has_role_on_account ((storage.foldername (name))[1]::uuid)
  )
  with check (
    bucket_id = 'video-masters'
    and public.has_role_on_account ((storage.foldername (name))[1]::uuid)
  );

drop policy if exists video_masters_storage_delete on storage.objects;
create policy video_masters_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'video-masters'
    and public.has_role_on_account ((storage.foldername (name))[1]::uuid)
  );

notify pgrst, 'reload schema';
