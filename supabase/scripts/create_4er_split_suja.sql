BEGIN;

DO $$
DECLARE
  -- Set one of these:
  v_target_user_id UUID := NULL;
  v_target_email TEXT := NULL;

  v_plan_name TEXT := '4er Split Suja';
  v_user_id UUID;
  v_exercise_id UUID;
  v_user_count BIGINT;
  rec RECORD;
BEGIN
  IF v_target_user_id IS NULL THEN
    IF v_target_email IS NULL OR btrim(v_target_email) = '' THEN
      SELECT COUNT(*) INTO v_user_count FROM auth.users;

      IF v_user_count = 1 THEN
        SELECT u.id INTO v_user_id FROM auth.users u LIMIT 1;
      ELSE
        RAISE EXCEPTION
          'Bitte v_target_user_id oder v_target_email setzen (auth.users hat % Eintraege).',
          v_user_count;
      END IF;
    ELSE
      SELECT u.id
      INTO v_user_id
      FROM auth.users u
      WHERE lower(u.email) = lower(v_target_email)
      LIMIT 1;
    END IF;
  ELSE
    v_user_id := v_target_user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein User gefunden (email=%).', v_target_email;
  END IF;

  CREATE TEMP TABLE _day_defs (
    day_number INTEGER PRIMARY KEY,
    day_name TEXT NOT NULL,
    target_muscles JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _day_defs (day_number, day_name, target_muscles)
  VALUES
    (1, 'Push', ' ["chest", "shoulders", "triceps", "core"] '::jsonb),
    (2, 'Pull', ' ["lats", "mid_back", "rear_delts", "biceps", "core"] '::jsonb),
    (3, 'Beine', '["quads", "hamstrings", "glutes", "core"]'::jsonb),
    (4, 'GK',    '["quads", "hamstrings", "chest", "mid_back", "shoulders", "core"]'::jsonb);

  CREATE TEMP TABLE _exercise_defs (
    day_number INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    equipment TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    sets INTEGER NOT NULL,
    target_reps INTEGER,
    target_seconds INTEGER,
    PRIMARY KEY (day_number, sort_order)
  ) ON COMMIT DROP;

  -- Push (6 Übungen, 18 Sätze)
  INSERT INTO _exercise_defs VALUES
    (1, 1, 'Bankdruecken', 'barbell', 'chest', ARRAY['triceps', 'front_delts'], 4, 8, NULL),
    (1, 2, 'Dips', 'bodyweight', 'chest', ARRAY['triceps'], 3, 10, NULL),
    (1, 3, 'Schulterdruecken im Sitzen', 'dumbbell', 'shoulders', ARRAY['triceps'], 3, 10, NULL),
    (1, 4, 'Seitheben Maschine', 'machine', 'side_delts', ARRAY['traps'], 3, 12, NULL),
    (1, 5, 'Trizepsdruecken mit dem Seil', 'cable', 'triceps', ARRAY['forearms'], 2, 10, NULL),
    (1, 6, 'Plank', 'bodyweight', 'core', ARRAY['abs'], 3, NULL, 60);

  -- Pull (7 Übungen, 18 Sätze)
  INSERT INTO _exercise_defs VALUES
    (2, 1, 'Kreuzheben', 'barbell', 'posterior_chain', ARRAY['hamstrings', 'glutes', 'lower_back'], 4, 8, NULL),
    (2, 2, 'Klimmzuege mit Unterstuetzung mit Untergriff', 'bands', 'lats', ARRAY['biceps'], 2, 10, NULL),
    (2, 3, 'Latzug weit mit Neutralgriff', 'cable', 'lats', ARRAY['biceps', 'upper_back'], 2, 8, NULL),
    (2, 4, 'Vorgebeugtes Rudern', 'barbell', 'mid_back', ARRAY['lats', 'biceps'], 3, 10, NULL),
    (2, 5, 'Butterfly Reverse weit', 'machine', 'rear_delts', ARRAY['upper_back'], 2, 12, NULL),
    (2, 6, 'Hammer Curls im Sitzen', 'dumbbell', 'brachialis', ARRAY['biceps', 'forearms'], 2, 10, NULL),
    (2, 7, 'Seitlicher Plank', 'bodyweight', 'obliques', ARRAY['core'], 3, NULL, 60);

  -- Beine (6 Übungen, 18 Sätze)
  INSERT INTO _exercise_defs VALUES
    (3, 1, 'Kniebeugen', 'barbell', 'quads', ARRAY['glutes', 'core'], 4, 8, NULL),
    (3, 2, 'Ausfallschritte im Gehen', 'dumbbell', 'quads', ARRAY['glutes', 'hamstrings'], 2, 10, NULL),
    (3, 3, 'Seitliche einbeinige Beinpresse', 'machine', 'quads', ARRAY['glutes'], 3, 10, NULL),
    (3, 4, 'Beinstrecken', 'machine', 'quads', ARRAY['rectus_femoris'], 3, 12, NULL),
    (3, 5, 'Beinbeugen im Sitzen', 'machine', 'hamstrings', ARRAY['calves'], 3, 12, NULL),
    (3, 6, 'Bird Dog', 'bodyweight', 'core', ARRAY['lower_back'], 3, 12, NULL);

  -- GK (6 Übungen, 18 Sätze)
  INSERT INTO _exercise_defs VALUES
    (4, 1, 'V-Squats', 'machine', 'quads', ARRAY['glutes'], 3, 10, NULL),
    (4, 2, 'Hyperextensions', 'bodyweight', 'lower_back', ARRAY['glutes', 'hamstrings'], 3, 10, NULL),
    (4, 3, 'Schraegbankdruecken', 'dumbbell', 'upper_chest', ARRAY['triceps', 'front_delts'], 3, 10, NULL),
    (4, 4, 'Rudern mit Brustauflage weit', 'machine', 'mid_back', ARRAY['lats', 'rear_delts'], 3, 10, NULL),
    (4, 5, 'Schulterpresse', 'machine', 'shoulders', ARRAY['triceps'], 3, 10, NULL),
    (4, 6, 'Bauchmaschine', 'machine', 'abs', ARRAY['obliques'], 3, 10, NULL);

  CREATE TEMP TABLE _resolved_exercises (
    exercise_name TEXT PRIMARY KEY,
    exercise_id UUID NOT NULL
  ) ON COMMIT DROP;

  -- Finde passende Übungen (system/custom). Falls nicht vorhanden: als Custom Übung anlegen.
  FOR rec IN
    SELECT DISTINCT
      e.exercise_name,
      e.equipment,
      e.primary_muscle,
      e.secondary_muscles
    FROM _exercise_defs e
  LOOP
    SELECT te.id
    INTO v_exercise_id
    FROM public.training_exercises te
    WHERE lower(te.name) = lower(rec.exercise_name)
      AND (te.is_system = TRUE OR te.owner_id = v_user_id)
    ORDER BY (te.owner_id = v_user_id) DESC, te.is_system DESC
    LIMIT 1;

    IF v_exercise_id IS NULL THEN
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
      VALUES (
        v_user_id,
        rec.exercise_name,
        rec.equipment,
        rec.primary_muscle,
        rec.secondary_muscles,
        ARRAY['https://dummyimage.com/640x360/1b202b/a4a9b6&text=' || replace(rec.exercise_name, ' ', '+')],
        rec.equipment,
        FALSE
      )
      RETURNING id INTO v_exercise_id;
    END IF;

    INSERT INTO _resolved_exercises (exercise_name, exercise_id)
    VALUES (rec.exercise_name, v_exercise_id)
    ON CONFLICT (exercise_name)
    DO UPDATE SET exercise_id = EXCLUDED.exercise_id;
  END LOOP;

  -- Vorhandenen Plan gleichen Namens entfernen (idempotent)
  DELETE FROM public.training_plans p
  WHERE p.user_id = v_user_id
    AND lower(p.name) = lower(v_plan_name);

  -- Alle anderen Pläne deaktivieren
  UPDATE public.training_plans
  SET is_active = FALSE,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Neuen Plan anlegen
  INSERT INTO public.training_plans (
    user_id,
    name,
    days_per_week,
    duration_weeks,
    start_date,
    is_active
  )
  VALUES (
    v_user_id,
    v_plan_name,
    4,
    12,
    CURRENT_DATE,
    TRUE
  );

  -- Tage anlegen
  INSERT INTO public.training_plan_days (
    plan_id,
    day_number,
    name,
    target_muscles,
    sort_order
  )
  SELECT
    p.id,
    d.day_number,
    d.day_name,
    d.target_muscles,
    d.day_number
  FROM _day_defs d
  CROSS JOIN LATERAL (
    SELECT id
    FROM public.training_plans p2
    WHERE p2.user_id = v_user_id
      AND lower(p2.name) = lower(v_plan_name)
    ORDER BY p2.created_at DESC
    LIMIT 1
  ) p;

  -- Übungen den Tagen zuordnen
  INSERT INTO public.training_day_exercises (
    day_id,
    exercise_id,
    sets,
    target_reps,
    target_seconds,
    sort_order
  )
  SELECT
    pd.id AS day_id,
    re.exercise_id,
    e.sets,
    e.target_reps,
    e.target_seconds,
    e.sort_order
  FROM _exercise_defs e
  JOIN _resolved_exercises re ON re.exercise_name = e.exercise_name
  JOIN public.training_plan_days pd
    ON pd.day_number = e.day_number
   AND pd.plan_id = (
     SELECT p.id
     FROM public.training_plans p
     WHERE p.user_id = v_user_id
       AND lower(p.name) = lower(v_plan_name)
     ORDER BY p.created_at DESC
     LIMIT 1
   )
  ORDER BY e.day_number, e.sort_order;

  RAISE NOTICE 'Plan "%" fuer User % erfolgreich angelegt.', v_plan_name, v_user_id;
END;
$$;

COMMIT;
