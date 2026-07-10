-- Scheduling: custom intake forms per event type and captured responses.

CREATE TABLE IF NOT EXISTS public.booking_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id uuid NOT NULL REFERENCES public.event_types (id) ON DELETE CASCADE,
  label text NOT NULL,
  field_type text NOT NULL,
  options jsonb,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_form_fields_field_type_check
    CHECK (
      field_type = ANY (
        ARRAY[
          'text'::text,
          'textarea'::text,
          'select'::text,
          'multiselect'::text,
          'checkbox'::text,
          'phone'::text,
          'url'::text
        ]
      )
    )
);

COMMENT ON TABLE public.booking_form_fields IS
  'Custom form definition per event type. Public form render/submit uses service-role routes.';

COMMENT ON COLUMN public.booking_form_fields.field_type IS
  'text | textarea | select | multiselect | checkbox | phone | url';

CREATE INDEX IF NOT EXISTS booking_form_fields_event_type_id_idx
  ON public.booking_form_fields (event_type_id);

CREATE TABLE IF NOT EXISTS public.booking_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  form_field_id uuid NOT NULL REFERENCES public.booking_form_fields (id),
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_form_responses_booking_id_form_field_id_key
    UNIQUE (booking_id, form_field_id)
);

COMMENT ON TABLE public.booking_form_responses IS
  'Invitee answers for booking_form_fields. Written by service-role on public book.';

CREATE INDEX IF NOT EXISTS booking_form_responses_booking_id_idx
  ON public.booking_form_responses (booking_id);

DROP TRIGGER IF EXISTS booking_form_fields_set_timestamps
  ON public.booking_form_fields;
CREATE TRIGGER booking_form_fields_set_timestamps
  BEFORE INSERT OR UPDATE ON public.booking_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.booking_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_form_responses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_form_fields TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_form_responses TO authenticated, service_role;
