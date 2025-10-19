-- Combined laptops creation + specs (idempotent)
-- This file creates the laptops table (if missing) and ensures spec/accessory columns exist.

CREATE TABLE IF NOT EXISTS public.laptops (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  slug text,
  imageurl text,
  galleryimages jsonb DEFAULT '[]'::jsonb,
  description text,
  price integer DEFAULT 0,
  inclusions text[] DEFAULT ARRAY[]::text[],
  categories text[] DEFAULT ARRAY[]::text[],
  -- Specifications and metadata
  ram text,
  storage text,
  cpu text,
  display_inch integer,
  condition text DEFAULT 'second',
  grade text,
  features jsonb DEFAULT '[]'::jsonb,
  accessories text[] DEFAULT ARRAY[]::text[],
  in_stock boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  image_public_id text,
  gallery_public_ids text[] DEFAULT ARRAY[]::text[],
  removed_public_ids text[] DEFAULT ARRAY[]::text[]
);

-- Ensure new columns exist if table was created by an older migration
ALTER TABLE IF EXISTS public.laptops
  ADD COLUMN IF NOT EXISTS ram text,
  ADD COLUMN IF NOT EXISTS storage text,
  ADD COLUMN IF NOT EXISTS cpu text,
  ADD COLUMN IF NOT EXISTS display_inch integer,
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'second',
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS accessories text[] DEFAULT ARRAY[]::text[];
  ALTER TABLE IF EXISTS public.laptops
    ADD COLUMN IF NOT EXISTS in_stock boolean DEFAULT true;

-- Enable row level security and policies
ALTER TABLE public.laptops ENABLE ROW LEVEL SECURITY;

-- Public read-only access (SELECT)
DROP POLICY IF EXISTS public_select_laptops ON public.laptops;
CREATE POLICY public_select_laptops ON public.laptops
  FOR SELECT USING (true);

-- Admin-only modifications (INSERT/UPDATE/DELETE) via helper function public.auth_is_admin()
DROP POLICY IF EXISTS admins_modify_laptops ON public.laptops;
CREATE POLICY admins_modify_laptops ON public.laptops
  FOR ALL USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS laptops_set_updated_at ON public.laptops;
CREATE TRIGGER laptops_set_updated_at
  BEFORE UPDATE ON public.laptops
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();
