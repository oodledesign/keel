-- Contact-level chat participants (separate from CRM client rows).
-- Postgres cannot use a new enum value in the same transaction that adds it.

ALTER TYPE public.chat_participant_kind ADD VALUE IF NOT EXISTS 'contact';
