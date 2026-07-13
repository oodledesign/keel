-- Invitee freeform notes on public bookings.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invitee_notes text;

COMMENT ON COLUMN public.bookings.invitee_notes IS
  'Optional notes left by the invitee when booking.';
