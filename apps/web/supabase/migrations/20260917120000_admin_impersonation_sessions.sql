-- Time-boxed stash of encrypted super-admin session tokens for impersonation restore.
-- Secrets are service_role-only; authenticated clients have no table access.

create table if not exists public.admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  encrypted_payload text not null,
  reason text not null,
  support_ticket_id uuid null,
  expires_at timestamptz not null,
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint admin_impersonation_sessions_reason_len check (
    char_length(trim(reason)) >= 3
    and char_length(reason) <= 500
  )
);

comment on table public.admin_impersonation_sessions is
  'Encrypted admin session stash for secure impersonation restore. service_role writes only.';

comment on column public.admin_impersonation_sessions.encrypted_payload is
  'AES-GCM ciphertext of admin access_token + refresh_token JSON. Never expose to clients.';

create index if not exists admin_impersonation_sessions_target_active_idx
  on public.admin_impersonation_sessions (target_user_id, ended_at);

create index if not exists admin_impersonation_sessions_expires_at_idx
  on public.admin_impersonation_sessions (expires_at);

create index if not exists admin_impersonation_sessions_actor_user_id_idx
  on public.admin_impersonation_sessions (actor_user_id);

alter table public.admin_impersonation_sessions enable row level security;

revoke all on table public.admin_impersonation_sessions from authenticated;
revoke all on table public.admin_impersonation_sessions from anon;
grant all on table public.admin_impersonation_sessions to service_role;
