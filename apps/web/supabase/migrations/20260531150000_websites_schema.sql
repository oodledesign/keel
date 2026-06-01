-- Websites module: table, columns, FKs, and RLS aligned with team accounts (business_id = accounts.id).

CREATE TABLE IF NOT EXISTS public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  client_org_id uuid,
  name text NOT NULL DEFAULT 'Untitled',
  domain text,
  staging_url text,
  stack text NOT NULL DEFAULT 'other',
  cms_admin_url text,
  vercel_project_id text,
  github_repo_url text,
  supabase_schema text,
  status text NOT NULL DEFAULT 'in-progress',
  umami_website_id text,
  umami_share_url text,
  notes text,
  hosting_notes text,
  launched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS client_org_id uuid;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS staging_url text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS stack text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS cms_admin_url text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS vercel_project_id text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS github_repo_url text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS supabase_schema text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS umami_website_id text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS umami_share_url text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS hosting_notes text;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS launched_at timestamptz;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.websites SET stack = 'other' WHERE stack IS NULL;
UPDATE public.websites SET status = 'in-progress' WHERE status IS NULL;
UPDATE public.websites SET name = 'Untitled' WHERE name IS NULL;
UPDATE public.websites SET created_at = now() WHERE created_at IS NULL;
UPDATE public.websites SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE public.websites ALTER COLUMN stack SET DEFAULT 'other';
ALTER TABLE public.websites ALTER COLUMN status SET DEFAULT 'in-progress';
ALTER TABLE public.websites ALTER COLUMN name SET DEFAULT 'Untitled';
ALTER TABLE public.websites ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.websites ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'websites_business_id_fkey'
  ) THEN
    ALTER TABLE public.websites
      ADD CONSTRAINT websites_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'websites.business_id FK skipped: orphan rows or legacy businesses FK';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'websites_client_org_id_fkey'
  ) THEN
    ALTER TABLE public.websites
      ADD CONSTRAINT websites_client_org_id_fkey
      FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_websites_business_id ON public.websites(business_id);
CREATE INDEX IF NOT EXISTS ix_websites_client_org_id ON public.websites(client_org_id);

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS websites_select ON public.websites;
CREATE POLICY websites_select ON public.websites
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS websites_insert ON public.websites;
CREATE POLICY websites_insert ON public.websites
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS websites_update ON public.websites;
CREATE POLICY websites_update ON public.websites
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(business_id))
  WITH CHECK (public.has_role_on_account(business_id));

DROP POLICY IF EXISTS websites_delete ON public.websites;
CREATE POLICY websites_delete ON public.websites
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(business_id));
