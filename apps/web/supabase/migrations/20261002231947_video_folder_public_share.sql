-- Public share links for hosted video folders

ALTER TABLE public.video_folders
  ADD COLUMN IF NOT EXISTS public_share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS ix_video_folders_public_share_token
  ON public.video_folders (public_share_token)
  WHERE public_share_token IS NOT NULL;

COMMENT ON COLUMN public.video_folders.public_share_enabled IS
  'When true, ready videos in this folder (and its subfolders) are viewable at /watch/folder/[public_share_token] without signing in.';
COMMENT ON COLUMN public.video_folders.public_share_token IS
  'Unguessable token for the public folder URL. Generated when sharing is first enabled.';
