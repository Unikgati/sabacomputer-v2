-- 05_create_app_settings.sql
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
