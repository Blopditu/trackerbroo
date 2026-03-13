BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS track_steps BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS daily_steps_target INTEGER NOT NULL DEFAULT 8000;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_daily_steps_target_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_daily_steps_target_chk
      CHECK (daily_steps_target BETWEEN 1000 AND 50000);
  END IF;
END $$;

UPDATE public.profiles
SET daily_steps_target = 8000
WHERE daily_steps_target IS NULL
   OR daily_steps_target < 1000
   OR daily_steps_target > 50000;

CREATE TABLE IF NOT EXISTS public.step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on DATE NOT NULL,
  steps INTEGER NOT NULL CHECK (steps >= 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT step_logs_user_day_uniq UNIQUE (user_id, logged_on)
);

CREATE INDEX IF NOT EXISTS step_logs_user_date_idx
  ON public.step_logs (user_id, logged_on DESC);

ALTER TABLE public.step_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own step logs" ON public.step_logs;
CREATE POLICY "Users can CRUD own step logs"
  ON public.step_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'community_posts_post_type_check'
  ) THEN
    ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_post_type_check;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'community_posts'
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_post_type_check
      CHECK (post_type IN ('gym_checkin', 'protein_milestone', 'steps_milestone', 'custom'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
