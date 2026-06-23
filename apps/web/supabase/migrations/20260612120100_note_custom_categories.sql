-- Allow custom note categories per account (beyond fixed system slugs).

CREATE TABLE IF NOT EXISTS public.note_categories (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_categories_slug_check CHECK (slug ~ '^[a-z0-9_]{1,64}$'),
  CONSTRAINT note_categories_label_check CHECK (char_length(trim(label)) BETWEEN 1 AND 80),
  UNIQUE (account_id, slug)
);

CREATE INDEX IF NOT EXISTS ix_note_categories_account
  ON public.note_categories (account_id, label);

COMMENT ON TABLE public.note_categories IS
  'Per-account custom note category labels; notes.category stores the slug.';

ALTER TABLE public.note_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_categories TO authenticated, service_role;

DROP POLICY IF EXISTS note_categories_select ON public.note_categories;
CREATE POLICY note_categories_select ON public.note_categories
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_categories_insert ON public.note_categories;
CREATE POLICY note_categories_insert ON public.note_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_categories_update ON public.note_categories;
CREATE POLICY note_categories_update ON public.note_categories
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_categories_delete ON public.note_categories;
CREATE POLICY note_categories_delete ON public.note_categories
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Relax fixed enum so custom slugs can be stored.
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_category_check;
ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_category_check;
