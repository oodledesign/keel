-- Feedflow Instagram Login slice: persist posts + username on connections.
-- Do not alter public.email_campaigns.

alter table feedflow.social_accounts
  add column if not exists username text;

create table if not exists feedflow.posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  social_account_id uuid not null references feedflow.social_accounts (id) on delete cascade,
  provider text not null default 'instagram',
  external_post_id text not null,
  media_type text not null,
  media_url text,
  thumbnail_url text,
  permalink text,
  caption text,
  username text,
  posted_at timestamptz,
  children jsonb not null default '[]'::jsonb,
  raw_json jsonb,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (social_account_id, external_post_id)
);

create index if not exists feedflow_posts_social_posted_at_idx
  on feedflow.posts (social_account_id, posted_at desc nulls last);

create index if not exists feedflow_social_accounts_ig_refresh_idx
  on feedflow.social_accounts (provider, token_status, last_refreshed_at);

drop trigger if exists feedflow_posts_set_timestamps on feedflow.posts;
create trigger feedflow_posts_set_timestamps
before update on feedflow.posts
for each row
execute procedure public.trigger_set_timestamps();

alter table feedflow.posts enable row level security;

drop policy if exists feedflow_posts_rw on feedflow.posts;
create policy feedflow_posts_rw on feedflow.posts
for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant usage on schema feedflow to authenticated, service_role;
grant all on table feedflow.posts to postgres, service_role;
grant select, insert, update, delete on table feedflow.posts to authenticated;

comment on table feedflow.posts is
  'Persisted social posts for public embeds. Refreshed by cron, not per widget view.';
