-- PageSpeed Lighthouse recommendations (opportunities + diagnostics)

create table if not exists rankly.pagespeed_recommendations (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references rankly.pagespeed_results (id) on delete cascade,
  audit_id text not null,
  title text not null,
  description text not null default '',
  display_value text,
  savings_ms numeric,
  priority text not null,
  kind text not null,
  category text not null,
  is_quick_win boolean not null default false,
  sort_order smallint not null default 0,
  constraint pagespeed_recommendations_priority_check check (
    priority in ('high', 'medium', 'low')
  ),
  constraint pagespeed_recommendations_kind_check check (
    kind in ('opportunity', 'diagnostic')
  ),
  constraint pagespeed_recommendations_category_check check (
    category in ('performance', 'accessibility', 'best-practices', 'seo')
  )
);

create index if not exists ix_pagespeed_recommendations_result_id
  on rankly.pagespeed_recommendations (result_id, sort_order);

alter table rankly.pagespeed_recommendations enable row level security;

drop policy if exists rankly_pagespeed_recommendations_rw on rankly.pagespeed_recommendations;
create policy rankly_pagespeed_recommendations_rw on rankly.pagespeed_recommendations
for all to authenticated
using (
  exists (
    select 1
    from rankly.pagespeed_results r
    join rankly.pagespeed_pages pg on pg.id = r.page_id
    join rankly.projects p on p.id = pg.project_id
    where r.id = rankly.pagespeed_recommendations.result_id
      and public.is_account_member(p.account_id)
  )
)
with check (
  exists (
    select 1
    from rankly.pagespeed_results r
    join rankly.pagespeed_pages pg on pg.id = r.page_id
    join rankly.projects p on p.id = pg.project_id
    where r.id = rankly.pagespeed_recommendations.result_id
      and public.is_account_member(p.account_id)
  )
);

grant select, insert, update, delete on rankly.pagespeed_recommendations to authenticated;
grant all on rankly.pagespeed_recommendations to postgres, service_role;

notify pgrst, 'reload schema';
