-- Distinguish support request types from billable service request types
-- for the portal multi-step Services / Support request wizard.

ALTER TABLE public.request_types
  ADD COLUMN IF NOT EXISTS is_support boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.request_types.is_support IS
  'When true, shown under the portal Support Ticket path; when false, under Request a service.';

CREATE INDEX IF NOT EXISTS ix_request_types_account_support
  ON public.request_types (account_id, is_support, is_active, sort_order);
