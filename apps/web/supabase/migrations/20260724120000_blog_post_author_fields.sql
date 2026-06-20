-- Author profile fields for blog E-E-A-T and card layout

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_bio TEXT,
  ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;

COMMENT ON COLUMN public.blog_posts.author_user_id IS 'Linked super admin user; avatar synced from personal account on save';
COMMENT ON COLUMN public.blog_posts.author_bio IS 'Author bio for bylines and Article schema (E-E-A-T)';
COMMENT ON COLUMN public.blog_posts.author_avatar_url IS 'Denormalized author avatar URL from personal account';

CREATE INDEX IF NOT EXISTS blog_posts_author_user_id_idx
  ON public.blog_posts (author_user_id)
  WHERE author_user_id IS NOT NULL;
