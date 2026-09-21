-- Workspace → client → project retainer service personalization.
-- See migration 20261225120000_retainer_service_personalization.sql.
-- Additive on top of 46-project-retainer-services.sql.

ALTER TABLE public.retainer_services
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS retainer_services_source text NOT NULL DEFAULT 'inherited';

ALTER TABLE public.project_retainers
  ADD COLUMN IF NOT EXISTS services_source text NOT NULL DEFAULT 'inherited';

CREATE TABLE IF NOT EXISTS public.client_retainer_services (
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.retainer_services (id) ON DELETE CASCADE,
  name text,
  description text,
  credit_cost integer,
  request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, service_id)
);

ALTER TABLE public.project_retainer_services
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS credit_cost integer,
  ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS retainer_service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL;
