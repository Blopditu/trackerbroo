BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS today_section_order TEXT[] NOT NULL DEFAULT ARRAY['meals','logs','habits','trends'];

UPDATE public.profiles
SET today_section_order = ARRAY['meals','logs','habits','trends']
WHERE today_section_order IS NULL
   OR array_length(today_section_order, 1) IS DISTINCT FROM 4;

COMMIT;
