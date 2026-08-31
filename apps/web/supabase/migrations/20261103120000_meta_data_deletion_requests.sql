-- Meta (Facebook/Instagram) data deletion callback audit log.
-- Stores confirmation codes so users can check /data-deletion/status?code=.

CREATE TABLE IF NOT EXISTS public.meta_data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL,
  meta_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'failed')),
  deleted_ig_connections integer NOT NULL DEFAULT 0,
  deleted_feedflow_accounts integer NOT NULL DEFAULT 0,
  anonymised_comment_events integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT meta_data_deletion_requests_confirmation_code_key
    UNIQUE (confirmation_code)
);

CREATE INDEX IF NOT EXISTS ix_meta_data_deletion_requests_meta_user_id
  ON public.meta_data_deletion_requests (meta_user_id, created_at DESC);

COMMENT ON TABLE public.meta_data_deletion_requests IS
  'Audit log of Meta data-deletion callbacks (signed_request). Looked up by confirmation_code on the public status page.';
COMMENT ON COLUMN public.meta_data_deletion_requests.confirmation_code IS
  'Public code returned to Meta and shown on /data-deletion/status.';
COMMENT ON COLUMN public.meta_data_deletion_requests.meta_user_id IS
  'Instagram/Facebook user id from the signed_request payload. Not shown on the status page.';

ALTER TABLE public.meta_data_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meta_data_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meta_data_deletion_requests TO postgres, service_role;
