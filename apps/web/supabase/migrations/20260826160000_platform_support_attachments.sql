-- Platform support attachments (screenshots / PDFs), matching workspace support.

ALTER TABLE public.platform_support_tickets
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.platform_support_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_support_tickets.attachments IS
  'JSON array of { name, url, mimeType, size } for the opening ticket message.';

COMMENT ON COLUMN public.platform_support_messages.attachments IS
  'JSON array of { name, url, mimeType, size } for thread replies.';

NOTIFY pgrst, 'reload schema';
