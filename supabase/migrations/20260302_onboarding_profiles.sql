BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS track_nutrition BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS track_gym BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_age_range_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_range_chk
      CHECK (age IS NULL OR (age >= 10 AND age <= 120));
  END IF;
END $$;

COMMIT;
