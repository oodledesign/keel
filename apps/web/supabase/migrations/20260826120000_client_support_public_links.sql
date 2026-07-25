-- Client support: public links, projects, submitter fields, attachments, portal RLS

-- ─── client_orgs public support link ─────────────────────────────────────────
ALTER TABLE public.client_orgs
  ADD COLUMN IF NOT EXISTS support_public_token text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_client_orgs_support_public_token
  ON public.client_orgs (support_public_token)
  WHERE support_public_token IS NOT NULL;

COMMENT ON COLUMN public.client_orgs.support_public_token IS
  'Opaque token for unauthenticated client support submit URL (/portal/support/[token]).';

-- ─── support_tickets extensions ──────────────────────────────────────────────
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS submitter_contact_id uuid,
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS submitter_email text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

UPDATE public.support_tickets
SET last_activity_at = COALESCE(updated_at, created_at, now())
WHERE last_activity_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_support_tickets_public_token
  ON public.support_tickets (public_token)
  WHERE public_token IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_project_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contacts'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_submitter_contact_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_submitter_contact_id_fkey
      FOREIGN KEY (submitter_contact_id) REFERENCES public.contacts (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_support_tickets_project_id
  ON public.support_tickets (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_support_tickets_last_activity_at
  ON public.support_tickets (account_id, last_activity_at DESC);

-- ─── ticket_messages extensions ──────────────────────────────────────────────
ALTER TABLE public.ticket_messages
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS author_email text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS external_url text;

COMMENT ON COLUMN public.ticket_messages.attachments IS
  'Array of { name, url, mimeType, size } for uploaded screenshots/PDFs.';

-- ─── Portal member RLS for support ───────────────────────────────────────────
DROP POLICY IF EXISTS support_tickets_select_client_portal ON public.support_tickets;
CREATE POLICY support_tickets_select_client_portal ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = support_tickets.client_org_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS support_tickets_insert_client_portal ON public.support_tickets;
CREATE POLICY support_tickets_insert_client_portal ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      JOIN public.client_orgs co ON co.id = cm.client_org_id
      WHERE cm.client_org_id = support_tickets.client_org_id
        AND cm.user_id = auth.uid()
        AND (
          -- client_orgs only has business_id (workspace or businesses.id depending on era).
          COALESCE(support_tickets.account_id, support_tickets.business_id) IS NULL
          OR COALESCE(support_tickets.account_id, support_tickets.business_id) = co.business_id
          OR EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = co.business_id
              AND b.account_id = COALESCE(
                support_tickets.account_id,
                support_tickets.business_id
              )
          )
        )
    )
  );

DROP POLICY IF EXISTS support_tickets_update_client_portal ON public.support_tickets;
CREATE POLICY support_tickets_update_client_portal ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = support_tickets.client_org_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = support_tickets.client_org_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ticket_messages_select_client_portal ON public.ticket_messages;
CREATE POLICY ticket_messages_select_client_portal ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      JOIN public.client_members cm ON cm.client_org_id = t.client_org_id
      WHERE t.id = ticket_messages.ticket_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ticket_messages_insert_client_portal ON public.ticket_messages;
CREATE POLICY ticket_messages_insert_client_portal ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal = false
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      JOIN public.client_members cm ON cm.client_org_id = t.client_org_id
      WHERE t.id = ticket_messages.ticket_id
        AND cm.user_id = auth.uid()
    )
  );

-- ─── Storage bucket for support attachments ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS support_attachments_public_read ON storage.objects;
CREATE POLICY support_attachments_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'support-attachments');

DROP POLICY IF EXISTS support_attachments_auth_insert ON storage.objects;
-- Client uploads go through the Next.js API (service role). No direct
-- authenticated INSERT into this bucket from the browser.

DROP POLICY IF EXISTS support_attachments_service_all ON storage.objects;
CREATE POLICY support_attachments_service_all ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'support-attachments')
  WITH CHECK (bucket_id = 'support-attachments');

NOTIFY pgrst, 'reload schema';
