BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_seed_color TEXT NOT NULL DEFAULT '#4c8dff';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_theme_seed_color_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_seed_color_chk
      CHECK (theme_seed_color ~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$');
  END IF;
END $$;

UPDATE public.profiles
SET theme_seed_color = '#4c8dff'
WHERE theme_seed_color IS NULL
   OR theme_seed_color !~ '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$';

COMMIT;

