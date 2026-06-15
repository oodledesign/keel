-- Shared Google OAuth grant (Gmail is first consumer; calendar/OOO add scopes later)
create table if not exists public.google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gmail-specific state + draft style (separate from auth)
create table if not exists public.email_assistant_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_history_id text,
  last_synced_at timestamptz,
  style_notes text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- email_threads
create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  participants jsonb not null default '[]'::jsonb,
  snippet text,
  label_ids text[] default '{}',
  is_unread boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_thread_id)
);

-- email_messages
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  gmail_message_id text not null,
  from_address text,
  to_addresses text[] default '{}',
  cc_addresses text[] default '{}',
  subject text,
  snippet text,
  body_text text,
  body_html text,
  internal_date timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

-- email_action_items: suggested to-dos (accept into tasks)
create table if not exists public.email_action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  message_id uuid references public.email_messages(id) on delete set null,
  title text not null,
  detail text,
  suggested_due_date date,
  status text not null default 'suggested',
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

-- email_drafts: generated replies, optionally saved to Gmail
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  reply_to_message_id uuid references public.email_messages(id) on delete set null,
  subject text,
  body_text text not null,
  gmail_draft_id text,
  status text not null default 'draft',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_email_threads_user_last on public.email_threads (user_id, last_message_at desc);
create index if not exists idx_email_messages_thread on public.email_messages (thread_id, internal_date);
create index if not exists idx_action_items_user_status on public.email_action_items (user_id, status);
create index if not exists idx_email_drafts_thread on public.email_drafts (thread_id);

-- RLS
alter table public.google_connections enable row level security;
alter table public.email_assistant_settings enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_action_items enable row level security;
alter table public.email_drafts enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'google_connections','email_assistant_settings','email_threads',
    'email_messages','email_action_items','email_drafts'
  ] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;
