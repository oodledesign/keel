-- Rankly Site Explorer: cached domain metrics + brand visibility snapshot

create table if not exists rankly.site_overviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  domain text not null,
  country_code text not null default 'gb',
  domain_power integer,
  authority_rank integer,
  link_trust integer,
  citation_strength integer,
  spam_score integer,
  referring_domains integer,
  backlinks_count integer,
  page_authority integer,
  organic_keywords integer,
  organic_top3 integer,
  organic_traffic numeric,
  organic_value numeric,
  organic_keywords_delta integer,
  organic_traffic_delta numeric,
  organic_value_delta numeric,
  paid_keywords integer,
  paid_traffic numeric,
  paid_value numeric,
  ai_overviews_count integer,
  brand_signal numeric,
  brand_visibility jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_overviews_unique_project unique (project_id)
);

create index if not exists ix_site_overviews_project_id
  on rankly.site_overviews (project_id);

create index if not exists ix_site_overviews_expires_at
  on rankly.site_overviews (expires_at);

drop trigger if exists rankly_site_overviews_set_timestamps on rankly.site_overviews;
create trigger rankly_site_overviews_set_timestamps
before update on rankly.site_overviews
for each row execute function public.trigger_set_timestamps();

alter table rankly.site_overviews enable row level security;

drop policy if exists rankly_site_overviews_rw on rankly.site_overviews;
create policy rankly_site_overviews_rw on rankly.site_overviews
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_overviews.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.site_overviews.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.site_overviews to authenticated;
grant all on rankly.site_overviews to postgres, service_role;

notify pgrst, 'reload schema';
