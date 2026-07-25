-- Platform support ticket categories (bug, feedback, feature request, etc.)

ALTER TABLE public.platform_support_tickets
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'question';

ALTER TABLE public.platform_support_tickets
  DROP CONSTRAINT IF EXISTS platform_support_tickets_category_check;

ALTER TABLE public.platform_support_tickets
  ADD CONSTRAINT platform_support_tickets_category_check
  CHECK (
    category IN (
      'bug',
      'feedback',
      'feature_request',
      'question',
      'billing',
      'other'
    )
  );

CREATE INDEX IF NOT EXISTS platform_support_tickets_category_idx
  ON public.platform_support_tickets (category);

COMMENT ON COLUMN public.platform_support_tickets.category IS
  'User-selected ticket category for Ozer platform support triage.';

NOTIFY pgrst, 'reload schema';
