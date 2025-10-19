
CREATE TABLE IF NOT EXISTS public.destinations (
  id bigint PRIMARY KEY,
  title text NOT NULL,
  slug text,
  imageurl text,
  galleryimages jsonb,
  longdescription text,
  pricetiers jsonb,
  duration integer,
  minpeople integer,
  itinerary jsonb,
  facilities text[],
  categories text[],
  mapcoordinates jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  image_public_id text,
  gallery_public_ids text[],
  removed_public_ids text[]
);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

-- Public read-only access
CREATE POLICY public_select_destinations ON public.destinations
  FOR SELECT USING (true);

-- Admin modification policy: admins only for any modification
CREATE POLICY admins_modify_destinations ON public.destinations
  FOR ALL USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS destinations_set_updated_at ON public.destinations;
CREATE TRIGGER destinations_set_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();
