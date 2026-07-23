-- Google Search Console sync for Rankly keyword tracking

create table if not exists rankly.gsc_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  google_email text,
  property_uri text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  connected_by uuid references auth.users (id) on delete set null,
  last_sync_at timestamptz,
  last_sync_error text,
  sync_from_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gsc_connections_project_unique unique (project_id)
);

create index if not exists ix_gsc_connections_account_id
  on rankly.gsc_connections (account_id);

create index if not exists ix_gsc_connections_last_sync_at
  on rankly.gsc_connections (last_sync_at)
  where property_uri is not null;

drop trigger if exists rankly_gsc_connections_set_timestamps
  on rankly.gsc_connections;
create trigger rankly_gsc_connections_set_timestamps
before update on rankly.gsc_connections
for each row execute function public.trigger_set_timestamps();

alter table rankly.gsc_connections enable row level security;

drop policy if exists rankly_gsc_connections_rw on rankly.gsc_connections;
create policy rankly_gsc_connections_rw on rankly.gsc_connections
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.gsc_connections.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.gsc_connections.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.gsc_connections to authenticated;
grant all on rankly.gsc_connections to postgres, service_role;

comment on table rankly.gsc_connections is
  'Per-project Google Search Console OAuth connection and selected property.';

create table if not exists rankly.gsc_query_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  query text not null,
  query_normalized text not null,
  metric_date date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(8, 6) not null default 0,
  position numeric(8, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gsc_query_metrics_unique unique (project_id, query_normalized, metric_date)
);

create index if not exists ix_gsc_query_metrics_project_date
  on rankly.gsc_query_metrics (project_id, metric_date desc);

create index if not exists ix_gsc_query_metrics_project_query
  on rankly.gsc_query_metrics (project_id, query_normalized);

drop trigger if exists rankly_gsc_query_metrics_set_timestamps
  on rankly.gsc_query_metrics;
create trigger rankly_gsc_query_metrics_set_timestamps
before update on rankly.gsc_query_metrics
for each row execute function public.trigger_set_timestamps();

alter table rankly.gsc_query_metrics enable row level security;

drop policy if exists rankly_gsc_query_metrics_rw on rankly.gsc_query_metrics;
create policy rankly_gsc_query_metrics_rw on rankly.gsc_query_metrics
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.gsc_query_metrics.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.gsc_query_metrics.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.gsc_query_metrics to authenticated;
grant all on rankly.gsc_query_metrics to postgres, service_role;

comment on table rankly.gsc_query_metrics is
  'Daily Search Console query metrics used to supplement Rankly keyword tracking.';

notify pgrst, 'reload schema';
