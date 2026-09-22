-- Board company notify settings for commercial disposals (Let / Sold / Under offer).
-- Workspace-level JSON with optional per-branch email overrides.

alter table public.accounts
  add column if not exists commercial_board_settings jsonb not null default '{}'::jsonb;

comment on column public.accounts.commercial_board_settings is
  'Commercial board-company notify settings: email, cc, subject/body templates, optional byBranch overrides.';
