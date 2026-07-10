-- Scheduling: workspace notification preferences and reminder queue.

CREATE TABLE IF NOT EXISTS public.booking_notification_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  send_confirmation_to_invitee boolean NOT NULL DEFAULT true,
  send_confirmation_to_host boolean NOT NULL DEFAULT true,
  reminder_offsets_minutes integer[] NOT NULL DEFAULT '{1440,60}'::integer[],
  send_cancellation_emails boolean NOT NULL DEFAULT true,
  reply_to_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_notification_settings IS
  'One row per workspace (upserted). reminder_offsets_minutes default {1440,60} = 24h and 1h.';

COMMENT ON COLUMN public.booking_notification_settings.reminder_offsets_minutes IS
  'Minutes before start_at to enqueue reminders (e.g. 1440 = 24 hours, 60 = 1 hour).';

CREATE TABLE IF NOT EXISTS public.booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_reminders_recipient_check
    CHECK (recipient = ANY (ARRAY['invitee'::text, 'host'::text])),
  CONSTRAINT booking_reminders_status_check
    CHECK (
      status = ANY (
        ARRAY[
          'pending'::text,
          'sent'::text,
          'failed'::text,
          'cancelled'::text
        ]
      )
    )
);

COMMENT ON TABLE public.booking_reminders IS
  'Reminder queue processed by a server job. Public never reads this table directly.';

COMMENT ON COLUMN public.booking_reminders.recipient IS
  'invitee | host';

COMMENT ON COLUMN public.booking_reminders.status IS
  'pending | sent | failed | cancelled';

CREATE INDEX IF NOT EXISTS booking_reminders_booking_id_idx
  ON public.booking_reminders (booking_id);

CREATE INDEX IF NOT EXISTS booking_reminders_due_idx
  ON public.booking_reminders (send_at)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS booking_notification_settings_set_timestamps
  ON public.booking_notification_settings;
CREATE TRIGGER booking_notification_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.booking_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.booking_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_notification_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_reminders TO authenticated, service_role;
