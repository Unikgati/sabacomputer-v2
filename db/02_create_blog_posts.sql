-- 02_create_blog_posts.sql
-- Blog posts table and RLS

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id bigint PRIMARY KEY,
  title text NOT NULL,
  slug text,
  imageurl text,
  category text,
  author text,
  date text,
  content text,
  created_at timestamptz NULL DEFAULT now(),
  image_public_id text,
  removed_public_ids text[]
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_select_blog_posts ON public.blog_posts
  FOR SELECT USING (true);

CREATE POLICY admins_modify_blog_posts ON public.blog_posts
  FOR ALL USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());
