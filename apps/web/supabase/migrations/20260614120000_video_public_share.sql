-- Public share links for hosted videos

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS public_share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_videos_public_share_token
  ON public.videos (public_share_token)
  WHERE public_share_token IS NOT NULL;

COMMENT ON COLUMN public.videos.public_share_enabled IS
  'When true, the video is viewable at /watch/[public_share_token] without signing in.';
COMMENT ON COLUMN public.videos.public_share_token IS
  'Unguessable token for the public watch URL. Generated when sharing is first enabled.';
