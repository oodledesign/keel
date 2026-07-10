-- Scheduling: public booking pages and event types (workspace-owned via account_id).
-- Invitee-facing reads go through service-role API routes — no anonymous SELECT policies.

CREATE TABLE IF NOT EXISTS public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES auth.users (id),
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  timezone text NOT NULL DEFAULT 'Europe/London',
  is_active boolean NOT NULL DEFAULT true,
  brand_colour text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_pages_slug_key UNIQUE (slug)
);

COMMENT ON TABLE public.booking_pages IS
  'One public scheduling link per row, owned by a workspace. Public booking flow uses service-role only.';

COMMENT ON COLUMN public.booking_pages.slug IS
  'Globally unique, URL-safe. Used as /book/{slug}. Enforced at the app layer to be lowercase and hyphen-safe.';

COMMENT ON COLUMN public.booking_pages.brand_colour IS
  'Optional brand colour for the public booking page (British English spelling).';

CREATE INDEX IF NOT EXISTS booking_pages_account_id_idx
  ON public.booking_pages (account_id);

CREATE INDEX IF NOT EXISTS booking_pages_slug_idx
  ON public.booking_pages (slug);

CREATE TABLE IF NOT EXISTS public.event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES public.booking_pages (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  durations integer[] NOT NULL DEFAULT '{30}'::integer[],
  default_duration integer NOT NULL DEFAULT 30,
  location_type text NOT NULL DEFAULT 'google_meet',
  location_detail text,
  buffer_before_minutes integer NOT NULL DEFAULT 0,
  buffer_after_minutes integer NOT NULL DEFAULT 0,
  minimum_notice_minutes integer NOT NULL DEFAULT 240,
  booking_window_days integer NOT NULL DEFAULT 60,
  max_bookings_per_day integer,
  slot_increment_minutes integer NOT NULL DEFAULT 30,
  allow_guest_invites boolean NOT NULL DEFAULT true,
  availability_schedule_id uuid NOT NULL REFERENCES public.availability_schedules (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_types_booking_page_id_slug_key UNIQUE (booking_page_id, slug),
  CONSTRAINT event_types_location_type_check
    CHECK (
      location_type = ANY (
        ARRAY[
          'google_meet'::text,
          'zoom'::text,
          'teams'::text,
          'phone'::text,
          'in_person'::text,
          'custom'::text
        ]
      )
    )
);

COMMENT ON TABLE public.event_types IS
  'Bookable meeting types on a booking page. durations supports multiple lengths (SavvyCal-style).';

COMMENT ON COLUMN public.event_types.location_type IS
  'google_meet | zoom | teams | phone | in_person | custom';

COMMENT ON COLUMN public.event_types.location_detail IS
  'Address or custom instructions for phone / in_person / custom locations.';

CREATE INDEX IF NOT EXISTS event_types_booking_page_id_idx
  ON public.event_types (booking_page_id);

CREATE INDEX IF NOT EXISTS event_types_availability_schedule_id_idx
  ON public.event_types (availability_schedule_id);

DROP TRIGGER IF EXISTS booking_pages_set_timestamps ON public.booking_pages;
CREATE TRIGGER booking_pages_set_timestamps
  BEFORE INSERT OR UPDATE ON public.booking_pages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS event_types_set_timestamps ON public.event_types;
CREATE TRIGGER event_types_set_timestamps
  BEFORE INSERT OR UPDATE ON public.event_types
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_pages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_types TO authenticated, service_role;
