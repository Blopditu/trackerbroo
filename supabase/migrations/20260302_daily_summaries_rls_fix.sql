BEGIN;

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own or group summaries" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can insert own summaries for private or joined groups" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can update own summaries for private or joined groups" ON public.daily_summaries;
DROP POLICY IF EXISTS "Users can delete own summaries" ON public.daily_summaries;

CREATE POLICY "Users can read own summaries"
  ON public.daily_summaries
  FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own summaries"
  ON public.daily_summaries
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own summaries"
  ON public.daily_summaries
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own summaries"
  ON public.daily_summaries
  FOR DELETE
  USING (auth.uid() = owner_id);

COMMIT;
