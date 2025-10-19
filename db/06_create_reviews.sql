-- 06_create_reviews.sql
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
