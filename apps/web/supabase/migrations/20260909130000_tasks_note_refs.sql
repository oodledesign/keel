-- Attach existing workspace notes to a task without re-linking the note row.
-- Stored as [{ "id": uuid, "title": string }] so project/client context on the note stays intact.

alter table public.tasks
  add column if not exists note_refs jsonb not null default '[]'::jsonb;

alter table public.tasks
  drop constraint if exists tasks_note_refs_is_array;

alter table public.tasks
  add constraint tasks_note_refs_is_array
  check (jsonb_typeof(note_refs) = 'array');

comment on column public.tasks.note_refs is
  'Attached workspace notes: [{ "id": uuid, "title": string }]';
