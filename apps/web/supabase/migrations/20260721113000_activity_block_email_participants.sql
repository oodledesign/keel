-- Optional email participant metadata (Spark AppleScript / Accessibility enrichment).

ALTER TABLE public.activity_blocks
  ADD COLUMN IF NOT EXISTS email_from text,
  ADD COLUMN IF NOT EXISTS email_to text;

COMMENT ON COLUMN public.activity_blocks.email_from IS
  'Sender address or name when enriched by the Mac assistant (e.g. Spark AppleScript).';

COMMENT ON COLUMN public.activity_blocks.email_to IS
  'Primary recipient when enriched by the Mac assistant (e.g. Spark AppleScript).';

NOTIFY pgrst, 'reload schema';
