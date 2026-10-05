-- Manual video ordering within a folder + custom (frame-picked) thumbnails

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS thumbnail_custom boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.videos.sort_order IS
  'Manual position within the folder (ascending). NULL = never ordered; shown first, newest first.';
COMMENT ON COLUMN public.videos.thumbnail_custom IS
  'True when thumbnail_url was picked by a user from a video frame; Bunny syncs must not overwrite it.';

CREATE INDEX IF NOT EXISTS ix_videos_folder_sort_order
  ON public.videos (account_id, folder_id, sort_order);

-- Public so thumbnails work on public watch pages and OG cards. Objects live at
-- `{account_id}/{video_id}/{file}` and are written by the server only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-thumbnails',
  'video-thumbnails',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/webp', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
