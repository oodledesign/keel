-- Scheduling: store Zoom/Teams meeting ids + host-attention flag when
-- conferencing link creation fails (graceful fallback — booking still succeeds).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_meeting_id text;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS needs_host_attention boolean NOT NULL DEFAULT false;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS host_attention_reason text;

COMMENT ON COLUMN public.bookings.provider_meeting_id IS
  'Zoom meeting id or Teams onlineMeeting id for cancel/reschedule cleanup.';

COMMENT ON COLUMN public.bookings.needs_host_attention IS
  'True when Zoom/Teams meeting creation failed; booking and calendar event still exist without a join link.';

COMMENT ON COLUMN public.bookings.host_attention_reason IS
  'Short reason shown to host when needs_host_attention is true.';

COMMENT ON COLUMN public.conferencing_connections.access_token IS
  'Encrypted at rest (enc:v1:… via TOKEN_ENCRYPTION_KEY). Legacy plaintext rows still decrypt as passthrough.';

COMMENT ON COLUMN public.conferencing_connections.refresh_token IS
  'Encrypted at rest (enc:v1:…). Legacy plaintext rows still decrypt as passthrough.';
