-- Client portal messaging: a single two-way chat_threads thread per
-- client_org, so a portal contact can message the workspace team and vice
-- versa. Reuses the existing chat_threads/chat_messages/chat_message_reads
-- schema (20260627120000_messages_module.sql) which already models a
-- `client` participant kind but has never granted client-side RLS access.

-- Postgres will not let a new enum value be referenced in the same
-- transaction it's added in, so this ALTER TYPE runs alone first.
ALTER TYPE public.chat_thread_type ADD VALUE IF NOT EXISTS 'client_portal';
