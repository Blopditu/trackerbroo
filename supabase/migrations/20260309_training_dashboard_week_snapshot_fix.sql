BEGIN;

CREATE OR REPLACE FUNCTION public.training_dashboard_week_snapshot(
  p_week_start DATE
)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  duration_weeks INTEGER,
  start_date DATE,
  week_number INTEGER,
  day_id UUID,
  day_number INTEGER,
  day_name TEXT,
  exercise_count INTEGER,
  exercise_thumbnails TEXT[],
  completed BOOLEAN,
  current_session_client_ref TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_week_end DATE := p_week_start + 6;
  v_plan_id UUID;
  v_plan_name TEXT;
  v_duration_weeks INTEGER;
  v_plan_start DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id, p.name, p.duration_weeks, p.start_date
  INTO v_plan_id, v_plan_name, v_duration_weeks, v_plan_start
  FROM public.training_plans p
  WHERE p.user_id = v_user_id
  ORDER BY p.is_active DESC, p.created_at DESC
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH day_stats AS (
    SELECT
      d.id AS day_id,
      d.day_number,
      d.name AS day_name,
      COUNT(de.id)::INTEGER AS exercise_count,
      (
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT ex.images[1] ORDER BY ex.images[1]),
          NULL
        )
      )[1:4] AS exercise_thumbnails
    FROM public.training_plan_days d
    LEFT JOIN public.training_day_exercises de ON de.day_id = d.id
    LEFT JOIN public.training_exercises ex ON ex.id = de.exercise_id
    WHERE d.plan_id = v_plan_id
    GROUP BY d.id, d.day_number, d.name
  ),
  completion AS (
    SELECT
      s.plan_day_id,
      BOOL_OR(s.status = 'completed') AS completed,
      MAX(
        CASE
          WHEN s.status = 'in_progress' AND s.session_date = CURRENT_DATE THEN s.client_ref
          ELSE NULL
        END
      ) AS current_session_client_ref
    FROM public.training_sessions s
    WHERE s.user_id = v_user_id
      AND s.plan_id = v_plan_id
      AND s.session_date BETWEEN p_week_start AND v_week_end
    GROUP BY s.plan_day_id
  )
  SELECT
    v_plan_id,
    v_plan_name,
    v_duration_weeks,
    v_plan_start,
    CASE
      WHEN v_plan_start IS NULL THEN NULL
      ELSE GREATEST(1, ((p_week_start - v_plan_start) / 7) + 1)
    END::INTEGER,
    ds.day_id,
    ds.day_number,
    ds.day_name,
    ds.exercise_count,
    COALESCE(ds.exercise_thumbnails, '{}'::TEXT[]),
    COALESCE(c.completed, FALSE),
    c.current_session_client_ref
  FROM day_stats ds
  LEFT JOIN completion c ON c.plan_day_id = ds.day_id
  ORDER BY ds.day_number;
END;
$$;

COMMIT;
