-- Unified client SEO report snapshots (public share link + PDF)

create table if not exists rankly.seo_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references rankly.projects (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null default 'SEO Report',
  target_domain text not null,
  public_share_enabled boolean not null default false,
  public_share_token text,
  snapshot jsonb not null default '{}'::jsonb,
  ai_audit_report_id uuid references rankly.ai_audit_reports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_report_snapshots_token_unique unique (public_share_token)
);

create index if not exists ix_seo_report_snapshots_project_id
  on rankly.seo_report_snapshots (project_id);

create index if not exists ix_seo_report_snapshots_account_id
  on rankly.seo_report_snapshots (account_id);

create index if not exists ix_seo_report_snapshots_share_token
  on rankly.seo_report_snapshots (public_share_token)
  where public_share_token is not null;

drop trigger if exists rankly_seo_report_snapshots_set_timestamps
  on rankly.seo_report_snapshots;
create trigger rankly_seo_report_snapshots_set_timestamps
before update on rankly.seo_report_snapshots
for each row execute function public.trigger_set_timestamps();

alter table rankly.seo_report_snapshots enable row level security;

drop policy if exists rankly_seo_report_snapshots_rw on rankly.seo_report_snapshots;
create policy rankly_seo_report_snapshots_rw on rankly.seo_report_snapshots
for all
to authenticated
using (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.seo_report_snapshots.project_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1 from rankly.projects p
    where p.id = rankly.seo_report_snapshots.project_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.seo_report_snapshots to authenticated;
grant all on rankly.seo_report_snapshots to postgres, service_role;

comment on table rankly.seo_report_snapshots is
  'Immutable client SEO report snapshots with optional public share token.';

notify pgrst, 'reload schema';
