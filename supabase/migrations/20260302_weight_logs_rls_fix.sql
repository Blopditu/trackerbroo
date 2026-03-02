BEGIN;

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their own weight logs" ON public.weight_logs;
DROP POLICY IF EXISTS "Users can read their own weight logs" ON public.weight_logs;
DROP POLICY IF EXISTS "Users can insert their own weight logs" ON public.weight_logs;
DROP POLICY IF EXISTS "Users can update their own weight logs" ON public.weight_logs;
DROP POLICY IF EXISTS "Users can delete their own weight logs" ON public.weight_logs;

CREATE POLICY "Users can read their own weight logs"
  ON public.weight_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight logs"
  ON public.weight_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight logs"
  ON public.weight_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight logs"
  ON public.weight_logs
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
