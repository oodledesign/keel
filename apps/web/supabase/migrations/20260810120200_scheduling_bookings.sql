-- Scheduling: confirmed bookings and invitee-added guests.
-- management_token powers invitee cancel/reschedule links; public access is service-role only.

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id uuid NOT NULL REFERENCES public.event_types (id),
  booking_page_id uuid NOT NULL REFERENCES public.booking_pages (id),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  invitee_name text NOT NULL,
  invitee_email text NOT NULL,
  invitee_timezone text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  cancellation_reason text,
  google_event_id text,
  conferencing_url text,
  conferencing_provider text,
  reschedule_of uuid REFERENCES public.bookings (id) ON DELETE SET NULL,
  management_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_management_token_key UNIQUE (management_token),
  CONSTRAINT bookings_check CHECK (end_at > start_at),
  CONSTRAINT bookings_status_check
    CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'rescheduled'::text])),
  CONSTRAINT bookings_conferencing_provider_check
    CHECK (
      conferencing_provider IS NULL
      OR conferencing_provider = ANY (
        ARRAY['google_meet'::text, 'zoom'::text, 'teams'::text]
      )
    )
);

COMMENT ON TABLE public.bookings IS
  'Confirmed bookings. account_id is denormalised for RLS. Public cancel/reschedule uses management_token via service-role routes.';

COMMENT ON COLUMN public.bookings.management_token IS
  'Opaque token used in invitee-facing cancel/reschedule links, e.g. /book/manage/{management_token}.';

COMMENT ON COLUMN public.bookings.status IS
  'confirmed | cancelled | rescheduled';

CREATE INDEX IF NOT EXISTS bookings_account_id_idx ON public.bookings (account_id);
CREATE INDEX IF NOT EXISTS bookings_event_type_id_idx ON public.bookings (event_type_id);
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON public.bookings (client_id);
CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON public.bookings (start_at);
CREATE INDEX IF NOT EXISTS bookings_management_token_idx ON public.bookings (management_token);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_double_booking_idx
  ON public.bookings (event_type_id, start_at)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS public.booking_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_guests_booking_id_email_key UNIQUE (booking_id, email)
);

COMMENT ON TABLE public.booking_guests IS
  'Additional attendees the invitee adds when allow_guest_invites is true.';

CREATE INDEX IF NOT EXISTS booking_guests_booking_id_idx
  ON public.booking_guests (booking_id);

DROP TRIGGER IF EXISTS bookings_set_timestamps ON public.bookings;
CREATE TRIGGER bookings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_guests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_guests TO authenticated, service_role;
