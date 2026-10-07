-- Feedflow: per-review table (Google, manual, CSV) and Webflow CMS sync state.

create table if not exists feedflow.reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  google_account_id uuid references feedflow.google_accounts (id) on delete set null,
  source text not null default 'manual'
    check (source in ('google', 'manual', 'csv')),
  external_id text not null,
  reviewer_name text not null,
  reviewer_photo_url text,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  reply text,
  reviewed_at timestamptz,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, source, external_id)
);

create index if not exists reviews_account_client_idx
  on feedflow.reviews (account_id, client_id, reviewed_at desc);

alter table feedflow.reviews enable row level security;

drop policy if exists feedflow_reviews_rw on feedflow.reviews;
create policy feedflow_reviews_rw on feedflow.reviews for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

-- Webflow connections are created before a site/collection is chosen.
alter table feedflow.webflow_connections
  alter column webflow_site_id drop not null,
  alter column webflow_collection_id drop not null;

alter table feedflow.webflow_connections
  add column if not exists site_name text,
  add column if not exists collection_name text,
  add column if not exists field_mapping jsonb not null default '{}'::jsonb,
  add column if not exists sync_started_at timestamptz,
  add column if not exists min_rating smallint not null default 1
    check (min_rating between 1 and 5);

-- Which Webflow item represents which review (idempotent syncing).
create table if not exists feedflow.webflow_review_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  webflow_connection_id uuid not null
    references feedflow.webflow_connections (id) on delete cascade,
  -- Null once the review is deleted: the sync then removes the Webflow item.
  review_id uuid references feedflow.reviews (id) on delete set null,
  webflow_item_id text not null,
  content_hash text not null,
  synced_at timestamptz not null default now(),
  unique (webflow_connection_id, review_id)
);

alter table feedflow.webflow_review_items enable row level security;

drop policy if exists feedflow_webflow_review_items_rw
  on feedflow.webflow_review_items;
create policy feedflow_webflow_review_items_rw
  on feedflow.webflow_review_items for all to authenticated
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update, delete
  on feedflow.reviews, feedflow.webflow_review_items to authenticated;
grant all on feedflow.reviews, feedflow.webflow_review_items
  to postgres, service_role;
