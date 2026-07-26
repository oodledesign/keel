-- Align legacy ticket_messages.content/sender_id with app columns (message/user_id),
-- then backfill opening conversation rows from ticket descriptions when missing.
--
-- Remote DBs that predate the Makerkit support alignment still have:
--   content text NOT NULL  (legacy body)
--   sender_id uuid         (legacy author)
-- while the app reads/writes `message` + `user_id`. Inserts that only set
-- `message` fail with: null value in column "content" violates not-null.

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS message text;

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- ─── Sync legacy content → message before dropping content ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ticket_messages'
      AND column_name = 'content'
  ) THEN
    UPDATE public.ticket_messages
    SET message = content
    WHERE (message IS NULL OR btrim(message) = '')
      AND content IS NOT NULL
      AND btrim(content) <> '';
  END IF;
END $$;

-- Prefer user_id; copy from sender_id when missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ticket_messages'
      AND column_name = 'sender_id'
  ) THEN
    UPDATE public.ticket_messages
    SET user_id = sender_id
    WHERE user_id IS NULL
      AND sender_id IS NOT NULL;
  END IF;
END $$;

ALTER TABLE public.ticket_messages
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop legacy columns so future inserts of `message` alone succeed.
ALTER TABLE public.ticket_messages
  DROP COLUMN IF EXISTS content;

ALTER TABLE public.ticket_messages
  DROP COLUMN IF EXISTS sender_id;

INSERT INTO public.ticket_messages (
  ticket_id,
  user_id,
  message,
  is_internal,
  author_name,
  author_email,
  created_at
)
SELECT
  t.id,
  t.created_by,
  t.description,
  false,
  COALESCE(t.submitter_name, 'Client'),
  t.submitter_email,
  COALESCE(t.created_at, now())
FROM public.support_tickets t
WHERE t.description IS NOT NULL
  AND btrim(t.description) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.ticket_messages m
    WHERE m.ticket_id = t.id
  );

NOTIFY pgrst, 'reload schema';
