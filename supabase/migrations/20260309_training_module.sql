BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_name TEXT;

CREATE TABLE IF NOT EXISTS public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_per_week INTEGER NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks BETWEEN 1 AND 156),
  start_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  name TEXT NOT NULL,
  target_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, day_number),
  UNIQUE(plan_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.training_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment TEXT NOT NULL CHECK (equipment IN ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'bands', 'other')),
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL CHECK (type IN ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'bands', 'other')),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT training_exercises_owner_scope_chk CHECK (
    (is_system = TRUE AND owner_id IS NULL)
    OR (is_system = FALSE AND owner_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.training_day_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES public.training_plan_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.training_exercises(id) ON DELETE RESTRICT,
  sets INTEGER NOT NULL CHECK (sets > 0),
  target_reps INTEGER CHECK (target_reps > 0),
  target_seconds INTEGER CHECK (target_seconds > 0),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT training_day_exercises_target_chk CHECK (
    target_reps IS NOT NULL OR target_seconds IS NOT NULL
  ),
  UNIQUE(day_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  plan_day_id UUID NOT NULL REFERENCES public.training_plan_days(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'aborted')),
  client_ref TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, client_ref)
);

CREATE TABLE IF NOT EXISTS public.training_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.training_exercises(id) ON DELETE RESTRICT,
  exercise_name TEXT NOT NULL,
  equipment TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL,
  planned_sets INTEGER NOT NULL CHECK (planned_sets > 0),
  target_reps INTEGER,
  target_seconds INTEGER,
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.training_set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES public.training_session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
  weight_kg NUMERIC(10,2) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps INTEGER CHECK (reps IS NULL OR reps >= 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  volume NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (volume >= 0),
  estimated_10rm NUMERIC(10,2) CHECK (estimated_10rm IS NULL OR estimated_10rm >= 0),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  client_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_exercise_id, set_number, is_warmup),
  UNIQUE(client_ref)
);

CREATE TABLE IF NOT EXISTS public.training_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weight', 'bodyfat', 'waist', 'chest')),
  value NUMERIC(10,2) NOT NULL CHECK (value >= 0),
  measured_on DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type, measured_on)
);

CREATE TABLE IF NOT EXISTS public.training_graph_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  graph_type TEXT NOT NULL CHECK (graph_type IN ('workout_count', 'exercise_10rm', 'muscle_volume', 'bodyweight', 'total_volume')),
  exercise_id UUID REFERENCES public.training_exercises(id) ON DELETE SET NULL,
  muscle_group TEXT,
  position INTEGER NOT NULL CHECK (position > 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, position)
);

CREATE INDEX IF NOT EXISTS training_sessions_user_date_idx
  ON public.training_sessions (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS training_plan_days_plan_day_idx
  ON public.training_plan_days (plan_id, day_number);
CREATE INDEX IF NOT EXISTS training_set_logs_session_set_idx
  ON public.training_set_logs (session_exercise_id, set_number);
CREATE INDEX IF NOT EXISTS training_measurements_user_date_idx
  ON public.training_measurements (user_id, measured_on DESC);
CREATE INDEX IF NOT EXISTS training_graph_configs_user_position_idx
  ON public.training_graph_configs (user_id, position);
CREATE INDEX IF NOT EXISTS training_day_exercises_day_idx
  ON public.training_day_exercises (day_id, sort_order);
CREATE INDEX IF NOT EXISTS training_session_exercises_session_idx
  ON public.training_session_exercises (session_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS training_exercises_system_name_equipment_uniq
  ON public.training_exercises (is_system, lower(name), equipment)
  WHERE is_system = TRUE;

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_day_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_graph_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own training plans" ON public.training_plans;
CREATE POLICY "Users can CRUD own training plans" ON public.training_plans
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own training plan days" ON public.training_plan_days;
CREATE POLICY "Users can CRUD own training plan days" ON public.training_plan_days
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.training_plans
      WHERE training_plans.id = training_plan_days.plan_id
        AND training_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.training_plans
      WHERE training_plans.id = training_plan_days.plan_id
        AND training_plans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read system and own exercises" ON public.training_exercises;
DROP POLICY IF EXISTS "Users can insert own custom exercises" ON public.training_exercises;
DROP POLICY IF EXISTS "Users can update own custom exercises" ON public.training_exercises;
DROP POLICY IF EXISTS "Users can delete own custom exercises" ON public.training_exercises;

CREATE POLICY "Users can read system and own exercises" ON public.training_exercises
  FOR SELECT USING (auth.uid() IS NOT NULL AND (is_system = TRUE OR owner_id = auth.uid()));

CREATE POLICY "Users can insert own custom exercises" ON public.training_exercises
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND is_system = FALSE);

CREATE POLICY "Users can update own custom exercises" ON public.training_exercises
  FOR UPDATE USING (auth.uid() = owner_id AND is_system = FALSE)
  WITH CHECK (auth.uid() = owner_id AND is_system = FALSE);

CREATE POLICY "Users can delete own custom exercises" ON public.training_exercises
  FOR DELETE USING (auth.uid() = owner_id AND is_system = FALSE);

DROP POLICY IF EXISTS "Users can CRUD own training day exercises" ON public.training_day_exercises;
CREATE POLICY "Users can CRUD own training day exercises" ON public.training_day_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.training_plan_days day
      JOIN public.training_plans plan ON plan.id = day.plan_id
      WHERE day.id = training_day_exercises.day_id
        AND plan.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.training_plan_days day
      JOIN public.training_plans plan ON plan.id = day.plan_id
      WHERE day.id = training_day_exercises.day_id
        AND plan.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can CRUD own training sessions" ON public.training_sessions;
CREATE POLICY "Users can CRUD own training sessions" ON public.training_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own training session exercises" ON public.training_session_exercises;
CREATE POLICY "Users can CRUD own training session exercises" ON public.training_session_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_exercises.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = training_session_exercises.session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can CRUD own training set logs" ON public.training_set_logs;
CREATE POLICY "Users can CRUD own training set logs" ON public.training_set_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.training_session_exercises se
      JOIN public.training_sessions s ON s.id = se.session_id
      WHERE se.id = training_set_logs.session_exercise_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.training_session_exercises se
      JOIN public.training_sessions s ON s.id = se.session_id
      WHERE se.id = training_set_logs.session_exercise_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can CRUD own training measurements" ON public.training_measurements;
CREATE POLICY "Users can CRUD own training measurements" ON public.training_measurements
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can CRUD own training graph configs" ON public.training_graph_configs;
CREATE POLICY "Users can CRUD own training graph configs" ON public.training_graph_configs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.training_start_session(
  p_plan_day_id UUID,
  p_session_date DATE,
  p_client_ref TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_plan_id UUID;
  v_session_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT d.plan_id
  INTO v_plan_id
  FROM public.training_plan_days d
  JOIN public.training_plans p ON p.id = d.plan_id
  WHERE d.id = p_plan_day_id
    AND p.user_id = v_user_id;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan day not found';
  END IF;

  INSERT INTO public.training_sessions (
    user_id,
    plan_id,
    plan_day_id,
    session_date,
    started_at,
    status,
    client_ref
  )
  VALUES (
    v_user_id,
    v_plan_id,
    p_plan_day_id,
    p_session_date,
    NOW(),
    'in_progress',
    p_client_ref
  )
  ON CONFLICT (user_id, client_ref)
  DO UPDATE SET
    plan_day_id = EXCLUDED.plan_day_id,
    plan_id = EXCLUDED.plan_id,
    session_date = EXCLUDED.session_date,
    updated_at = NOW()
  RETURNING id INTO v_session_id;

  INSERT INTO public.training_session_exercises (
    session_id,
    exercise_id,
    exercise_name,
    equipment,
    primary_muscle,
    secondary_muscles,
    images,
    type,
    planned_sets,
    target_reps,
    target_seconds,
    sort_order
  )
  SELECT
    v_session_id,
    de.exercise_id,
    ex.name,
    ex.equipment,
    ex.primary_muscle,
    ex.secondary_muscles,
    ex.images,
    ex.type,
    de.sets,
    de.target_reps,
    de.target_seconds,
    de.sort_order
  FROM public.training_day_exercises de
  JOIN public.training_exercises ex ON ex.id = de.exercise_id
  WHERE de.day_id = p_plan_day_id
  ORDER BY de.sort_order
  ON CONFLICT (session_id, sort_order) DO NOTHING;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.training_upsert_set_log_by_client(
  p_session_client_ref TEXT,
  p_exercise_sort_order INTEGER,
  p_set_number INTEGER,
  p_is_warmup BOOLEAN,
  p_weight_kg NUMERIC,
  p_reps INTEGER,
  p_duration_seconds INTEGER,
  p_is_completed BOOLEAN,
  p_client_ref TEXT
)
RETURNS TABLE (
  id UUID,
  volume NUMERIC,
  estimated_10rm NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session_id UUID;
  v_session_exercise_id UUID;
  v_volume NUMERIC(12,2);
  v_10rm NUMERIC(10,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id
  INTO v_session_id
  FROM public.training_sessions
  WHERE user_id = v_user_id
    AND client_ref = p_session_client_ref
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found for client_ref %', p_session_client_ref;
  END IF;

  SELECT id
  INTO v_session_exercise_id
  FROM public.training_session_exercises
  WHERE session_id = v_session_id
    AND sort_order = p_exercise_sort_order;

  IF v_session_exercise_id IS NULL THEN
    RAISE EXCEPTION 'Session exercise not found for sort order %', p_exercise_sort_order;
  END IF;

  v_volume := COALESCE(p_weight_kg, 0) * COALESCE(p_reps, 0);
  v_10rm := NULL;

  IF COALESCE(p_weight_kg, 0) > 0 AND COALESCE(p_reps, 0) > 0 THEN
    v_10rm := ROUND((p_weight_kg * (1 + p_reps / 30.0) * 0.75)::NUMERIC, 2);
  END IF;

  INSERT INTO public.training_set_logs (
    session_exercise_id,
    set_number,
    is_warmup,
    weight_kg,
    reps,
    duration_seconds,
    volume,
    estimated_10rm,
    is_completed,
    client_ref,
    updated_at
  )
  VALUES (
    v_session_exercise_id,
    p_set_number,
    COALESCE(p_is_warmup, FALSE),
    p_weight_kg,
    p_reps,
    p_duration_seconds,
    v_volume,
    v_10rm,
    COALESCE(p_is_completed, FALSE),
    p_client_ref,
    NOW()
  )
  ON CONFLICT (session_exercise_id, set_number, is_warmup)
  DO UPDATE SET
    weight_kg = EXCLUDED.weight_kg,
    reps = EXCLUDED.reps,
    duration_seconds = EXCLUDED.duration_seconds,
    volume = EXCLUDED.volume,
    estimated_10rm = EXCLUDED.estimated_10rm,
    is_completed = EXCLUDED.is_completed,
    client_ref = EXCLUDED.client_ref,
    updated_at = NOW()
  RETURNING training_set_logs.id, training_set_logs.volume, training_set_logs.estimated_10rm
  INTO id, volume, estimated_10rm;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.training_complete_session_by_client(
  p_session_client_ref TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session_id UUID;
  v_day DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.training_sessions
  SET
    status = 'completed',
    completed_at = COALESCE(completed_at, NOW()),
    duration_seconds = COALESCE(
      duration_seconds,
      GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
    ),
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND client_ref = p_session_client_ref
  RETURNING id, session_date INTO v_session_id, v_day;

  IF v_session_id IS NULL THEN
    SELECT id, session_date INTO v_session_id, v_day
    FROM public.training_sessions
    WHERE user_id = v_user_id
      AND client_ref = p_session_client_ref
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  INSERT INTO public.community_posts (
    user_id,
    post_type,
    day,
    note,
    summary,
    photo_url
  )
  VALUES (
    v_user_id,
    'gym_checkin',
    v_day,
    'Training abgeschlossen.',
    jsonb_build_object('source', 'training_module', 'session_id', v_session_id),
    NULL
  )
  ON CONFLICT (user_id, day, post_type)
  DO UPDATE SET
    summary = COALESCE(public.community_posts.summary, '{}'::jsonb) || jsonb_build_object('session_id', v_session_id, 'source', 'training_module');

  RETURN v_session_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.training_previous_exercise_performance(
  p_exercise_id UUID,
  p_before DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  session_date DATE,
  set_number INTEGER,
  is_warmup BOOLEAN,
  weight_kg NUMERIC,
  reps INTEGER,
  estimated_10rm NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_session_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.id
  INTO v_session_id
  FROM public.training_sessions s
  JOIN public.training_session_exercises se ON se.session_id = s.id
  WHERE s.user_id = v_user_id
    AND s.status = 'completed'
    AND s.session_date < p_before
    AND se.exercise_id = p_exercise_id
  ORDER BY s.session_date DESC, s.completed_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.session_date,
    l.set_number,
    l.is_warmup,
    l.weight_kg,
    l.reps,
    l.estimated_10rm
  FROM public.training_set_logs l
  JOIN public.training_session_exercises se ON se.id = l.session_exercise_id
  JOIN public.training_sessions s ON s.id = se.session_id
  WHERE s.id = v_session_id
    AND se.exercise_id = p_exercise_id
  ORDER BY l.is_warmup, l.set_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.training_progress_series(
  p_graph_type TEXT,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_exercise_id UUID DEFAULT NULL,
  p_muscle_group TEXT DEFAULT NULL
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

  IF p_graph_type = 'workout_count' THEN
    RETURN QUERY
    SELECT
      DATE_TRUNC('week', s.session_date)::DATE AS point_date,
      COUNT(*)::NUMERIC AS point_value
    FROM public.training_sessions s
    WHERE s.user_id = v_user_id
      AND s.status = 'completed'
      AND s.session_date BETWEEN v_from AND v_to
    GROUP BY DATE_TRUNC('week', s.session_date)::DATE
    ORDER BY point_date;
  ELSIF p_graph_type = 'exercise_10rm' THEN
    RETURN QUERY
    SELECT
      s.session_date AS point_date,
      MAX(l.estimated_10rm) AS point_value
    FROM public.training_set_logs l
    JOIN public.training_session_exercises se ON se.id = l.session_exercise_id
    JOIN public.training_sessions s ON s.id = se.session_id
    WHERE s.user_id = v_user_id
      AND s.status = 'completed'
      AND s.session_date BETWEEN v_from AND v_to
      AND p_exercise_id IS NOT NULL
      AND se.exercise_id = p_exercise_id
      AND l.is_warmup = FALSE
    GROUP BY s.session_date
    ORDER BY s.session_date;
  ELSIF p_graph_type = 'muscle_volume' THEN
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
      AND l.is_warmup = FALSE
      AND (
        p_muscle_group IS NULL
        OR se.primary_muscle = p_muscle_group
        OR p_muscle_group = ANY(se.secondary_muscles)
      )
    GROUP BY s.session_date
    ORDER BY s.session_date;
  ELSIF p_graph_type = 'bodyweight' THEN
    RETURN QUERY
    SELECT
      w.logged_on AS point_date,
      MAX(w.weight_kg)::NUMERIC AS point_value
    FROM public.weight_logs w
    WHERE w.user_id = v_user_id
      AND w.logged_on BETWEEN v_from AND v_to
    GROUP BY w.logged_on
    ORDER BY w.logged_on;
  ELSIF p_graph_type = 'total_volume' THEN
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
    GROUP BY s.session_date
    ORDER BY s.session_date;
  ELSE
    RAISE EXCEPTION 'Unsupported graph type: %', p_graph_type;
  END IF;
END;
$$;

INSERT INTO public.training_exercises (
  owner_id,
  name,
  equipment,
  primary_muscle,
  secondary_muscles,
  images,
  type,
  is_system
)
SELECT
  NULL,
  seed.name,
  seed.equipment,
  seed.primary_muscle,
  seed.secondary_muscles,
  seed.images,
  seed.type,
  TRUE
FROM (
  VALUES
    ('Barbell Bench Press', 'barbell', 'chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Barbell+Bench+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Bench+Press+Lockout'], 'barbell'),
    ('Incline Bench Press', 'barbell', 'upper_chest', ARRAY['front_delts', 'triceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Incline+Bench+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Incline+Press+Top'], 'barbell'),
    ('Decline Bench Press', 'barbell', 'lower_chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Decline+Bench+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Decline+Press+Top'], 'barbell'),
    ('Dumbbell Flat Press', 'dumbbell', 'chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Dumbbell+Flat+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Dumbbell+Press+Top'], 'dumbbell'),
    ('Dumbbell Incline Press', 'dumbbell', 'upper_chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Dumbbell+Incline+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Incline+DB+Top'], 'dumbbell'),
    ('Machine Chest Press', 'machine', 'chest', ARRAY['triceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Machine+Chest+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Machine+Press'], 'machine'),
    ('Cable Fly', 'cable', 'chest', ARRAY['front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Cable+Fly', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Cable+Fly+Contract'], 'cable'),
    ('Pec Deck', 'machine', 'chest', ARRAY['front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Pec+Deck', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pec+Deck+Squeeze'], 'machine'),
    ('Push Up', 'bodyweight', 'chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Push+Up', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Push+Up+Top'], 'bodyweight'),
    ('Weighted Dip', 'bodyweight', 'chest', ARRAY['triceps', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Weighted+Dip', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Dip+Top'], 'bodyweight'),
    ('Overhead Press', 'barbell', 'shoulders', ARRAY['triceps', 'upper_chest'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Overhead+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=OHP+Lockout'], 'barbell'),
    ('Seated Dumbbell Shoulder Press', 'dumbbell', 'shoulders', ARRAY['triceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Seated+DB+Shoulder+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=DB+Press+Top'], 'dumbbell'),
    ('Lateral Raise', 'dumbbell', 'side_delts', ARRAY['traps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Lateral+Raise', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Lateral+Raise+Top'], 'dumbbell'),
    ('Cable Lateral Raise', 'cable', 'side_delts', ARRAY['traps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Cable+Lateral+Raise', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Cable+Lateral+Top'], 'cable'),
    ('Rear Delt Fly', 'machine', 'rear_delts', ARRAY['upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Rear+Delt+Fly', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Rear+Delt+Squeeze'], 'machine'),
    ('Face Pull', 'cable', 'rear_delts', ARRAY['traps', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Face+Pull', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Face+Pull+End'], 'cable'),
    ('Upright Row', 'barbell', 'shoulders', ARRAY['traps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Upright+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Upright+Row+Top'], 'barbell'),
    ('Barbell Shrug', 'barbell', 'traps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Barbell+Shrug', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Shrug+Top'], 'barbell'),
    ('Dumbbell Shrug', 'dumbbell', 'traps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Dumbbell+Shrug', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=DB+Shrug+Top'], 'dumbbell'),
    ('Deadlift', 'barbell', 'posterior_chain', ARRAY['hamstrings', 'glutes', 'lower_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Deadlift', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Deadlift+Top'], 'barbell'),
    ('Romanian Deadlift', 'barbell', 'hamstrings', ARRAY['glutes', 'lower_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Romanian+Deadlift', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=RDL+Stretch'], 'barbell'),
    ('Stiff Leg Deadlift', 'barbell', 'hamstrings', ARRAY['glutes'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Stiff+Leg+Deadlift', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=SLDL+Top'], 'barbell'),
    ('Good Morning', 'barbell', 'hamstrings', ARRAY['lower_back', 'glutes'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Good+Morning', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Good+Morning+Top'], 'barbell'),
    ('Pull Up', 'bodyweight', 'lats', ARRAY['biceps', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Pull+Up', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pull+Up+Top'], 'bodyweight'),
    ('Assisted Pull Up', 'bands', 'lats', ARRAY['biceps', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Assisted+Pull+Up', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Assisted+Top'], 'bands'),
    ('Chin Up', 'bodyweight', 'lats', ARRAY['biceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Chin+Up', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Chin+Up+Top'], 'bodyweight'),
    ('Lat Pulldown Wide', 'cable', 'lats', ARRAY['biceps', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Lat+Pulldown+Wide', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pulldown+Bottom'], 'cable'),
    ('Lat Pulldown Neutral', 'cable', 'lats', ARRAY['biceps', 'teres_major'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Lat+Pulldown+Neutral', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pulldown+Neutral'], 'cable'),
    ('Seated Cable Row', 'cable', 'mid_back', ARRAY['biceps', 'rear_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Seated+Cable+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Cable+Row+Contract'], 'cable'),
    ('Barbell Row', 'barbell', 'mid_back', ARRAY['lats', 'rear_delts', 'biceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Barbell+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Row+Top'], 'barbell'),
    ('T-Bar Row', 'machine', 'mid_back', ARRAY['lats', 'rear_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=T-Bar+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=T-Bar+Top'], 'machine'),
    ('Chest Supported Row', 'machine', 'mid_back', ARRAY['lats', 'biceps'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Chest+Supported+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Supported+Row+Top'], 'machine'),
    ('Single Arm Dumbbell Row', 'dumbbell', 'lats', ARRAY['biceps', 'rear_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Single+Arm+DB+Row', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=DB+Row+Top'], 'dumbbell'),
    ('Straight Arm Pulldown', 'cable', 'lats', ARRAY['teres_major'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Straight+Arm+Pulldown', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pulldown+End'], 'cable'),
    ('Barbell Squat', 'barbell', 'quads', ARRAY['glutes', 'core'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Barbell+Squat', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Squat+Top'], 'barbell'),
    ('Front Squat', 'barbell', 'quads', ARRAY['core', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Front+Squat', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Front+Squat+Top'], 'barbell'),
    ('Hack Squat', 'machine', 'quads', ARRAY['glutes'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Hack+Squat', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Hack+Squat+Top'], 'machine'),
    ('Leg Press', 'machine', 'quads', ARRAY['glutes', 'hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Leg+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Leg+Press+Top'], 'machine'),
    ('Bulgarian Split Squat', 'dumbbell', 'quads', ARRAY['glutes', 'core'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Bulgarian+Split+Squat', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Split+Squat+Top'], 'dumbbell'),
    ('Walking Lunge', 'dumbbell', 'quads', ARRAY['glutes', 'hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Walking+Lunge', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Lunge+Step'], 'dumbbell'),
    ('Step Up', 'dumbbell', 'quads', ARRAY['glutes'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Step+Up', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Step+Up+Top'], 'dumbbell'),
    ('Leg Extension', 'machine', 'quads', ARRAY['rectus_femoris'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Leg+Extension', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Leg+Extension+Top'], 'machine'),
    ('Leg Curl', 'machine', 'hamstrings', ARRAY['calves'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Leg+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Leg+Curl+Squeeze'], 'machine'),
    ('Seated Leg Curl', 'machine', 'hamstrings', ARRAY['calves'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Seated+Leg+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Seated+Curl+Top'], 'machine'),
    ('Hip Thrust', 'barbell', 'glutes', ARRAY['hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Hip+Thrust', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Hip+Thrust+Top'], 'barbell'),
    ('Glute Bridge', 'bodyweight', 'glutes', ARRAY['hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Glute+Bridge', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Glute+Bridge+Top'], 'bodyweight'),
    ('Cable Kickback', 'cable', 'glutes', ARRAY['hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Cable+Kickback', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Kickback+Top'], 'cable'),
    ('Standing Calf Raise', 'machine', 'calves', ARRAY['soleus'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Standing+Calf+Raise', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Calf+Raise+Top'], 'machine'),
    ('Seated Calf Raise', 'machine', 'calves', ARRAY['soleus'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Seated+Calf+Raise', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Seated+Calf+Top'], 'machine'),
    ('Barbell Curl', 'barbell', 'biceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Barbell+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Curl+Top'], 'barbell'),
    ('EZ Bar Curl', 'barbell', 'biceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=EZ+Bar+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=EZ+Curl+Top'], 'barbell'),
    ('Dumbbell Curl', 'dumbbell', 'biceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Dumbbell+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=DB+Curl+Top'], 'dumbbell'),
    ('Hammer Curl', 'dumbbell', 'brachialis', ARRAY['biceps', 'forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Hammer+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Hammer+Curl+Top'], 'dumbbell'),
    ('Preacher Curl', 'machine', 'biceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Preacher+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Preacher+Top'], 'machine'),
    ('Cable Curl', 'cable', 'biceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Cable+Curl', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Cable+Curl+Top'], 'cable'),
    ('Triceps Pushdown', 'cable', 'triceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Triceps+Pushdown', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Pushdown+Bottom'], 'cable'),
    ('Overhead Triceps Extension', 'dumbbell', 'triceps', ARRAY['shoulders'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Overhead+Triceps+Extension', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Overhead+Triceps+Top'], 'dumbbell'),
    ('Skull Crusher', 'barbell', 'triceps', ARRAY['front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Skull+Crusher', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Skull+Crusher+Top'], 'barbell'),
    ('Close Grip Bench Press', 'barbell', 'triceps', ARRAY['chest', 'front_delts'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Close+Grip+Bench+Press', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Close+Grip+Top'], 'barbell'),
    ('Rope Pushdown', 'cable', 'triceps', ARRAY['forearms'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Rope+Pushdown', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Rope+Pushdown+Bottom'], 'cable'),
    ('Crunch', 'bodyweight', 'abs', ARRAY['hip_flexors'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Crunch', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Crunch+Top'], 'bodyweight'),
    ('Cable Crunch', 'cable', 'abs', ARRAY['obliques'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Cable+Crunch', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Cable+Crunch+Bottom'], 'cable'),
    ('Plank', 'bodyweight', 'core', ARRAY['abs', 'lower_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Plank', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Plank+Hold'], 'bodyweight'),
    ('Side Plank', 'bodyweight', 'obliques', ARRAY['core'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Side+Plank', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Side+Plank+Hold'], 'bodyweight'),
    ('Hanging Leg Raise', 'bodyweight', 'abs', ARRAY['hip_flexors'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Hanging+Leg+Raise', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Leg+Raise+Top'], 'bodyweight'),
    ('Russian Twist', 'bodyweight', 'obliques', ARRAY['abs'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Russian+Twist', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Twist+Side'], 'bodyweight'),
    ('Back Extension', 'machine', 'lower_back', ARRAY['glutes', 'hamstrings'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Back+Extension', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Back+Extension+Top'], 'machine'),
    ('Bird Dog', 'bodyweight', 'core', ARRAY['lower_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Bird+Dog', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Bird+Dog+Hold'], 'bodyweight'),
    ('Band Pull Apart', 'bands', 'rear_delts', ARRAY['upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Band+Pull+Apart', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Band+Pull+Apart+End'], 'bands'),
    ('Band Face Pull', 'bands', 'rear_delts', ARRAY['traps', 'upper_back'], ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Band+Face+Pull', 'https://dummyimage.com/640x360/0f1115/e6e8ec&text=Band+Face+Pull+End'], 'bands')
) AS seed(name, equipment, primary_muscle, secondary_muscles, images, type)
ON CONFLICT DO NOTHING;

COMMIT;
