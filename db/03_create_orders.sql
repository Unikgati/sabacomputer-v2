-- 03_create_orders.sql
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
