-- Private event types stay bookable via direct URL but are hidden from the
-- public booking page list.

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.event_types.is_private IS
  'When true, the meeting type is omitted from /book/{page} but remains reachable at /book/{page}/{eventSlug}.';
