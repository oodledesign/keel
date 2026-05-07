-- Task 4a: properties table and property_documents table
-- Used by Greentrees Homes (work space_type) for property management.

-- ─── 1. properties ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name            text NOT NULL,                    -- e.g. "12 Oak Lane"
  address         text,
  property_type   text DEFAULT 'residential'
    CHECK (property_type IN ('residential', 'commercial', 'land', 'other')),
  status          text DEFAULT 'active'
    CHECK (status IN ('active', 'vacant', 'maintenance', 'sold', 'archived')),
  bedrooms        integer,
  bathrooms       numeric(4,1),
  square_footage  integer,
  purchase_date   date,
  purchase_price  bigint,                           -- stored in pence / cents
  current_value   bigint,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_properties_account_id ON public.properties(account_id);
CREATE INDEX IF NOT EXISTS ix_properties_status ON public.properties(status);

COMMENT ON TABLE public.properties IS
  'Properties managed within a team workspace (e.g. Greentrees Homes).';
COMMENT ON COLUMN public.properties.purchase_price IS 'Price in the smallest currency unit (pence/cents).';
COMMENT ON COLUMN public.properties.current_value IS 'Current estimated value in the smallest currency unit.';

-- Timestamp trigger
DROP TRIGGER IF EXISTS properties_set_updated_at ON public.properties;
CREATE TRIGGER properties_set_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- ─── 2. property_documents ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,                    -- display name
  file_path       text NOT NULL,                    -- storage path (bucket-relative)
  file_size       bigint,                           -- bytes
  mime_type       text,
  document_type   text DEFAULT 'other'
    CHECK (document_type IN (
      'contract', 'lease', 'insurance', 'inspection', 'title_deed',
      'mortgage', 'tax', 'utility', 'photo', 'other'
    )),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_property_documents_property_id ON public.property_documents(property_id);
CREATE INDEX IF NOT EXISTS ix_property_documents_account_id ON public.property_documents(account_id);

COMMENT ON TABLE public.property_documents IS
  'Documents attached to a property, stored in Supabase Storage (property-documents bucket).';
COMMENT ON COLUMN public.property_documents.file_path IS
  'Path within the property-documents storage bucket.';

-- Timestamp trigger
DROP TRIGGER IF EXISTS property_documents_set_updated_at ON public.property_documents;
CREATE TRIGGER property_documents_set_updated_at
  BEFORE UPDATE ON public.property_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- ─── 3. RLS: properties ───────────────────────────────────────────────────────
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated, service_role;

DROP POLICY IF EXISTS properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = properties.account_id
      AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS properties_insert ON public.properties;
CREATE POLICY properties_insert ON public.properties FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = properties.account_id
      AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS properties_update ON public.properties;
CREATE POLICY properties_update ON public.properties FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = properties.account_id
      AND am.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = properties.account_id
      AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS properties_delete ON public.properties;
CREATE POLICY properties_delete ON public.properties FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = properties.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

-- ─── 4. RLS: property_documents ───────────────────────────────────────────────
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_documents TO authenticated, service_role;

DROP POLICY IF EXISTS property_documents_select ON public.property_documents;
CREATE POLICY property_documents_select ON public.property_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = property_documents.account_id
      AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS property_documents_insert ON public.property_documents;
CREATE POLICY property_documents_insert ON public.property_documents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = property_documents.account_id
      AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS property_documents_update ON public.property_documents;
CREATE POLICY property_documents_update ON public.property_documents FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = property_documents.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
)
WITH CHECK (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = property_documents.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS property_documents_delete ON public.property_documents;
CREATE POLICY property_documents_delete ON public.property_documents FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = property_documents.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

-- ─── 5. Storage bucket for property documents ─────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow members to upload/download documents for their accounts
DROP POLICY IF EXISTS "property_documents_storage_select" ON storage.objects;
CREATE POLICY "property_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-documents'
    AND EXISTS (
      SELECT 1 FROM public.property_documents pd
      JOIN public.accounts_memberships am ON am.account_id = pd.account_id
      WHERE pd.file_path = name
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_documents_storage_insert" ON storage.objects;
CREATE POLICY "property_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-documents'
    -- Enforce that the path is scoped to an account the user is a member of.
    -- Upload paths follow the pattern: <account_id>/<property_id>/<filename>
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.user_id = auth.uid()
        AND storage.objects.name LIKE (am.account_id::text || '/%')
    )
  );

DROP POLICY IF EXISTS "property_documents_storage_delete" ON storage.objects;
CREATE POLICY "property_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-documents'
    AND EXISTS (
      SELECT 1 FROM public.property_documents pd
      JOIN public.accounts_memberships am ON am.account_id = pd.account_id
      WHERE pd.file_path = name
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

NOTIFY pgrst, 'reload schema';
