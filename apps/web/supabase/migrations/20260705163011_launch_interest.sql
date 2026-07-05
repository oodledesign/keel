create table if not exists public.launch_interest (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  interests text[] not null default '{}',
  source text not null default 'coming-soon',
  created_at timestamptz not null default now()
);

alter table public.launch_interest enable row level security;

-- No public read or direct public writes. Inserts happen via the service-role API route.
revoke all on table public.launch_interest from anon, authenticated;
grant insert on table public.launch_interest to service_role;
