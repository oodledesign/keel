-- Public share tokens for family recipes + curated recipe books.
-- Public pages load via admin client (token + enabled), same as /share/listing
-- and /share/meetings. Intentionally no anon SELECT policies.

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS public_share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_family_recipes_public_share_token
  ON public.family_recipes (public_share_token)
  WHERE public_share_token IS NOT NULL;

ALTER TABLE public.family_recipes
  DROP CONSTRAINT IF EXISTS family_recipes_share_token_len;
ALTER TABLE public.family_recipes
  ADD CONSTRAINT family_recipes_share_token_len
    CHECK (
      public_share_token IS NULL OR char_length(public_share_token) >= 16
    );

COMMENT ON COLUMN public.family_recipes.public_share_enabled IS
  'When true, the recipe is viewable at /share/recipe/[public_share_token] without signing in.';

COMMENT ON COLUMN public.family_recipes.public_share_token IS
  'Opaque public share token. Generated on first enable; preserved when disabled.';

-- ---------------------------------------------------------------------------
-- Recipe books (curated, ordered collections)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_recipe_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  public_share_enabled boolean NOT NULL DEFAULT false,
  public_share_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_recipe_books_name_len
    CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 160),
  CONSTRAINT family_recipe_books_description_len
    CHECK (description IS NULL OR char_length(description) <= 2000)
);

CREATE INDEX IF NOT EXISTS ix_family_recipe_books_user_id
  ON public.family_recipe_books (user_id)
  WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_family_recipe_books_account_id
  ON public.family_recipe_books (account_id)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_family_recipe_books_public_share_token
  ON public.family_recipe_books (public_share_token)
  WHERE public_share_token IS NOT NULL;

ALTER TABLE public.family_recipe_books
  DROP CONSTRAINT IF EXISTS family_recipe_books_share_token_len;
ALTER TABLE public.family_recipe_books
  ADD CONSTRAINT family_recipe_books_share_token_len
    CHECK (
      public_share_token IS NULL OR char_length(public_share_token) >= 16
    );

COMMENT ON TABLE public.family_recipe_books IS
  'Curated recipe collections. Personal when account_id is null; workspace-shared otherwise.';

COMMENT ON COLUMN public.family_recipe_books.public_share_enabled IS
  'When true, the book is viewable at /share/recipe-book/[public_share_token] without signing in.';

CREATE TABLE IF NOT EXISTS public.family_recipe_book_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.family_recipe_books (id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.family_recipes (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_recipe_book_items_unique UNIQUE (book_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS ix_family_recipe_book_items_book
  ON public.family_recipe_book_items (book_id, sort_order);

CREATE INDEX IF NOT EXISTS ix_family_recipe_book_items_recipe
  ON public.family_recipe_book_items (recipe_id);

COMMENT ON TABLE public.family_recipe_book_items IS
  'Ordered membership of a recipe in a family recipe book.';

DROP TRIGGER IF EXISTS family_recipe_books_set_timestamps
  ON public.family_recipe_books;
CREATE TRIGGER family_recipe_books_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_recipe_books
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- Keep book membership in the same personal/workspace scope as the book.
CREATE OR REPLACE FUNCTION public.family_recipe_book_item_same_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  book_user uuid;
  book_account uuid;
  recipe_user uuid;
  recipe_account uuid;
BEGIN
  SELECT user_id, account_id
    INTO book_user, book_account
  FROM public.family_recipe_books
  WHERE id = NEW.book_id;

  IF book_user IS NULL THEN
    RAISE EXCEPTION 'Recipe book not found';
  END IF;

  SELECT user_id, account_id
    INTO recipe_user, recipe_account
  FROM public.family_recipes
  WHERE id = NEW.recipe_id;

  IF recipe_user IS NULL THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  IF book_account IS NOT NULL THEN
    IF recipe_account IS DISTINCT FROM book_account THEN
      RAISE EXCEPTION 'Recipe must belong to the same workspace as the book';
    END IF;
  ELSIF recipe_account IS NOT NULL OR recipe_user IS DISTINCT FROM book_user THEN
    RAISE EXCEPTION 'Recipe must belong to the same personal library as the book';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_recipe_book_items_same_scope
  ON public.family_recipe_book_items;
CREATE TRIGGER family_recipe_book_items_same_scope
  BEFORE INSERT OR UPDATE ON public.family_recipe_book_items
  FOR EACH ROW EXECUTE FUNCTION public.family_recipe_book_item_same_scope();

ALTER TABLE public.family_recipe_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_recipe_book_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_books
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_book_items
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.family_recipe_book_is_accessible(p_book_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_recipe_books b
    WHERE b.id = p_book_id
      AND (
        (b.account_id IS NULL AND b.user_id = (SELECT auth.uid()))
        OR (b.account_id IS NOT NULL AND public.has_role_on_account(b.account_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.family_recipe_book_is_accessible(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.family_recipe_book_is_accessible(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.family_recipe_book_item_same_scope() FROM public;

DROP POLICY IF EXISTS family_recipe_books_select ON public.family_recipe_books;
CREATE POLICY family_recipe_books_select ON public.family_recipe_books
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipe_books_insert ON public.family_recipe_books;
CREATE POLICY family_recipe_books_insert ON public.family_recipe_books
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipe_books_update ON public.family_recipe_books;
CREATE POLICY family_recipe_books_update ON public.family_recipe_books
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipe_books_delete ON public.family_recipe_books;
CREATE POLICY family_recipe_books_delete ON public.family_recipe_books
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipe_book_items_select
  ON public.family_recipe_book_items;
CREATE POLICY family_recipe_book_items_select ON public.family_recipe_book_items
  FOR SELECT TO authenticated
  USING (public.family_recipe_book_is_accessible(book_id));

DROP POLICY IF EXISTS family_recipe_book_items_insert
  ON public.family_recipe_book_items;
CREATE POLICY family_recipe_book_items_insert ON public.family_recipe_book_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.family_recipe_book_is_accessible(book_id)
    AND public.family_recipe_is_accessible(recipe_id)
  );

DROP POLICY IF EXISTS family_recipe_book_items_update
  ON public.family_recipe_book_items;
CREATE POLICY family_recipe_book_items_update ON public.family_recipe_book_items
  FOR UPDATE TO authenticated
  USING (public.family_recipe_book_is_accessible(book_id))
  WITH CHECK (
    public.family_recipe_book_is_accessible(book_id)
    AND public.family_recipe_is_accessible(recipe_id)
  );

DROP POLICY IF EXISTS family_recipe_book_items_delete
  ON public.family_recipe_book_items;
CREATE POLICY family_recipe_book_items_delete ON public.family_recipe_book_items
  FOR DELETE TO authenticated
  USING (public.family_recipe_book_is_accessible(book_id));
