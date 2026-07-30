-- Link commercial requirements to a specific contact as well as a client.
ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS contact_id uuid
    REFERENCES public.contacts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_requirements_client_id_idx
  ON public.commercial_requirements (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_requirements_contact_id_idx
  ON public.commercial_requirements (contact_id)
  WHERE contact_id IS NOT NULL;
