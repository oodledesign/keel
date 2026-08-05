-- Add structured links to tasks (project board task detail).
-- notes already exists; links stores [{ url, label? }] for attachable URLs.

alter table public.tasks
  add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.tasks
  drop constraint if exists tasks_links_is_array;

alter table public.tasks
  add constraint tasks_links_is_array
  check (jsonb_typeof(links) = 'array');

comment on column public.tasks.links is
  'Structured outbound links for a task: [{ "url": string, "label"?: string }]';
