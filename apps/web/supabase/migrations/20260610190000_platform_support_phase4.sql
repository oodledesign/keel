-- Platform support Phase 4: ticket numbers, message thread, user updates.

alter table public.platform_support_tickets
  add column if not exists ticket_number serial;

create unique index if not exists platform_support_tickets_ticket_number_idx
  on public.platform_support_tickets (ticket_number);

create table if not exists public.platform_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.platform_support_tickets (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists platform_support_messages_ticket_id_idx
  on public.platform_support_messages (ticket_id, created_at);

alter table public.platform_support_messages enable row level security;

create policy platform_support_messages_user_read on public.platform_support_messages
  for select to authenticated
  using (
    (
      not is_internal_note
      and exists (
        select 1
        from public.platform_support_tickets t
        where t.id = ticket_id
          and t.user_id = auth.uid()
      )
    )
    or public.is_super_admin ()
  );

create policy platform_support_messages_user_insert on public.platform_support_messages
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and not is_internal_note
    and exists (
      select 1
      from public.platform_support_tickets t
      where t.id = ticket_id
        and t.user_id = auth.uid()
    )
  );

create policy platform_support_messages_super_admin on public.platform_support_messages
  for all to authenticated
  using (public.is_super_admin ())
  with check (public.is_super_admin ());

grant select, insert on public.platform_support_messages to authenticated;
grant all on public.platform_support_messages to service_role;

-- Users may update their own open tickets (e.g. mark as read); admins use super_admin policy.
create policy platform_support_tickets_user_update on public.platform_support_tickets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update on public.platform_support_tickets to authenticated;
