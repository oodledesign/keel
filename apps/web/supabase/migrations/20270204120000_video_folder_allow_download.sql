-- Opt-in downloads for publicly shared video folders

ALTER TABLE public.video_folders
  ADD COLUMN IF NOT EXISTS public_share_allow_download boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.video_folders.public_share_allow_download IS
  'When true (and public_share_enabled), viewers of the public folder link can download the video files.';
