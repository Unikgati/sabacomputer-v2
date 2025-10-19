-- 00_admins_and_helpers.sql
-- Create admins table and helper function for RLS checks
-- Run this first (or alongside other files) in Supabase SQL editor.

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
