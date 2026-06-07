-- Link Rankly SEO projects to CRM clients (optional)

alter table rankly.projects
  add column if not exists client_id uuid references public.clients (id) on delete set null;

create index if not exists ix_rankly_projects_client_id
  on rankly.projects (client_id)
  where client_id is not null;

comment on column rankly.projects.client_id is
  'Optional CRM client this SEO project tracks. Domain often imported from linked websites.';

notify pgrst, 'reload schema';
