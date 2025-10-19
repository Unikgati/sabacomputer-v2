-- combined_init.sql
-- Combined initialization script for this project's database objects.
-- Generated from the per-file scripts in the same folder.
-- Run this once (for example via psql or Supabase SQL editor) to create tables, functions, triggers, indexes and policies.

-- IMPORTANT: This script preserves the original ordering and uses IF NOT EXISTS where provided.
-- Ordering rationale:
--  1) Admins & helper functions (creates auth helper and pgcrypto extension)
--  2) Destinations (creates _set_updated_at trigger function used by destinations)
--  3) Blog posts
--  4) Orders
--  5) Invoices + RPCs (depends on orders)
--  6) App settings (references admins in policies)
--  7) Reviews

-- Note: This file only combines DDL/SQL statements. It does not attempt to migrate data or alter existing objects beyond the IF NOT EXISTS semantics in the source files.

-- === 00_admins_and_helpers.sql ===
-- Create admins table and helper function for RLS checks

-- Ensure pgcrypto for gen_random_uuid if not present (Supabase usually provides it)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Admins table (match existing definition in log.txt)
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_uid uuid NULL,
  email text NULL,
  role text NULL DEFAULT 'admin'::text,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_auth_uid_unique ON public.admins USING btree (auth_uid);

-- Helper function used by RLS policies to determine if the current JWT user is an admin.
CREATE OR REPLACE FUNCTION public.auth_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins a
    WHERE a.auth_uid = (
      CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() ELSE NULLIF(current_setting('jwt.claims.sub', true), '')::uuid END
    )
  );
$$;

COMMENT ON FUNCTION public.auth_is_admin() IS 'Returns true when current jwt user is present in public.admins (checks auth_uid)';

-- RLS policies for admins table: allow a user to select/update their own admin row
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_select_self ON public.admins
  FOR SELECT USING ((auth.uid() IS NOT NULL) AND (auth.uid() = auth_uid));

CREATE POLICY admins_update_self ON public.admins
  FOR UPDATE USING ((auth.uid() IS NOT NULL) AND (auth.uid() = auth_uid))
  WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = auth_uid));


-- === 01_create_destinations.sql ===

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


-- === 02_create_blog_posts.sql ===
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


-- === 03_create_orders.sql ===
-- Orders table and RLS

CREATE TABLE IF NOT EXISTS public.orders (
  id bigserial PRIMARY KEY,
  customer_name text,
  customer_phone text,
  destination_id bigint,
  destination_title text,
  order_date timestamptz NULL DEFAULT now(),
  departure_date date,
  participants integer,
  total_price numeric,
  status text,
  payment_status text,
  payment_history jsonb,
  notes text
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public insert (matches existing policy name orders_insert_public)
CREATE POLICY orders_insert_public ON public.orders
  FOR INSERT WITH CHECK (true);

-- Select policy: admins can select (mirrors log.txt)
CREATE POLICY orders_select_admin ON public.orders
  FOR SELECT USING (public.auth_is_admin());

-- Update/Delete: admins only
CREATE POLICY orders_update_admin_only ON public.orders
  FOR UPDATE USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY orders_delete_admin_only ON public.orders
  FOR DELETE USING (public.auth_is_admin());


-- === 04_create_invoices_and_rpc.sql ===
-- Invoices table plus SECURITY DEFINER RPC for fetch-by-token

CREATE TABLE IF NOT EXISTS public.invoices (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL,
  total numeric NOT NULL,
  metadata jsonb,
  share_token text,
  created_at timestamptz NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_order_id_unique ON public.invoices USING btree (order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_share_token_unique ON public.invoices USING btree (share_token);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_admin ON public.invoices
  FOR SELECT USING (public.auth_is_admin());

CREATE POLICY invoices_insert_admin ON public.invoices
  FOR INSERT WITH CHECK (public.auth_is_admin());

CREATE POLICY invoices_update_admin ON public.invoices
  FOR UPDATE USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY invoices_delete_admin ON public.invoices
  FOR DELETE USING (public.auth_is_admin());

-- SECURITY DEFINER function to fetch invoice + order by token (named similar to previous)
CREATE OR REPLACE FUNCTION public.fetch_invoice_with_order_by_token(p_token text)
RETURNS TABLE(invoice jsonb, "order" jsonb) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT to_jsonb(i) AS invoice, to_jsonb(o) AS "order"
  FROM public.invoices i
  JOIN public.orders o ON o.id = i.order_id
  WHERE i.share_token = p_token;
END; $$;

COMMENT ON FUNCTION public.fetch_invoice_with_order_by_token IS 'SECURITY DEFINER RPC: returns invoice and order for a given public token (text)';


-- === 05_create_app_settings.sql ===
-- Single-row app settings and a public view

CREATE TABLE IF NOT EXISTS public.app_settings (
  id bigint PRIMARY KEY,
  brandname text,
  tagline text,
  theme text,
  accentcolor text,
  logolighturl text,
  logodarkurl text,
  favicon16url text,
  favicon192url text,
  favicon512url text,
  email text,
  address text,
  whatsappnumber text,
  facebookurl text,
  instagramurl text,
  twitterurl text,
  bankname text,
  bankaccountnumber text,
  bankaccountholder text,
  heroslides jsonb,
  updated_at timestamptz NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_settings_delete_admin ON public.app_settings
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admins a WHERE (a.auth_uid = auth.uid())));

CREATE POLICY app_settings_insert_admin ON public.app_settings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE (a.auth_uid = auth.uid())));

CREATE POLICY app_settings_select_admin ON public.app_settings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins a WHERE (a.auth_uid = auth.uid())));

CREATE POLICY app_settings_update_admin ON public.app_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins a WHERE (a.auth_uid = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE (a.auth_uid = auth.uid())));

CREATE OR REPLACE VIEW public.app_settings_public AS
select
  id,
  theme,
  accentcolor,
  brandname,
  tagline,
  logolighturl,
  logodarkurl,
  favicon16url,
  favicon192url,
  favicon512url,
  email,
  address,
  whatsappnumber,
  facebookurl,
  instagramurl,
  twitterurl,
  bankname,
  bankaccountnumber,
  bankaccountholder,
  heroslides
from
  app_settings
where
  id = 1;


-- === 06_create_reviews.sql ===
-- Reviews table and RLS

CREATE TABLE IF NOT EXISTS public.reviews (
  id bigint NOT NULL DEFAULT (((EXTRACT(epoch from now()) * (1000)::numeric))::bigint),
  name text NOT NULL,
  initials text NOT NULL,
  content text NOT NULL,
  rating smallint NOT NULL DEFAULT 5,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_rating_check CHECK (((rating >= 1) and (rating <= 5)))
);

-- According to log.txt, reviews RLS is disabled (no policies). Keep it public by not enabling RLS.

-- End of combined_init.sql
