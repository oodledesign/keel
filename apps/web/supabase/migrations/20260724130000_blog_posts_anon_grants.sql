-- Allow anonymous reads of published blog posts via PostgREST (marketing site).

GRANT SELECT ON public.blog_posts TO anon, authenticated;
