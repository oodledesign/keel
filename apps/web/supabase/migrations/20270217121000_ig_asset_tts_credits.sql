-- Instagram Automation v2: record media credits charged for TTS voice notes.

ALTER TABLE public.ig_automation_assets
  ADD COLUMN IF NOT EXISTS media_credits_charged integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ig_automation_assets.media_credits_charged IS
  'Media credits debited for this asset (TTS only), charged once the audio is ready.';
