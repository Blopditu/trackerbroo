BEGIN;

CREATE OR REPLACE FUNCTION public.training_exercise_volume_series(
  p_exercise_id UUID,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS TABLE (
  point_date DATE,
  point_value NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_from DATE := COALESCE(p_from, CURRENT_DATE - 365);
  v_to DATE := COALESCE(p_to, CURRENT_DATE);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_exercise_id IS NULL THEN
    RAISE EXCEPTION 'Missing p_exercise_id';
  END IF;

  RETURN QUERY
  SELECT
    s.session_date AS point_date,
    COALESCE(SUM(l.volume), 0)::NUMERIC AS point_value
  FROM public.training_set_logs l
  JOIN public.training_session_exercises se ON se.id = l.session_exercise_id
  JOIN public.training_sessions s ON s.id = se.session_id
  WHERE s.user_id = v_user_id
    AND s.status = 'completed'
    AND s.session_date BETWEEN v_from AND v_to
    AND se.exercise_id = p_exercise_id
    AND l.is_warmup = FALSE
  GROUP BY s.session_date
  ORDER BY s.session_date;
END;
$$;

COMMIT;
