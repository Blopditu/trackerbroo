BEGIN;

-- Imports all exercises from wger into public.training_exercises as system rows.
-- Safe to re-run: existing system rows are updated, missing rows are inserted.
--
-- Run this in Supabase SQL Editor (postgres role).

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

DO $$
DECLARE
  v_url TEXT := 'https://wger.de/api/v2/exerciseinfo/?language=2&limit=200';
  v_http_response extensions.http_response;
  v_page JSONB;
  v_loaded_total INTEGER := 0;
  v_loaded_batch INTEGER := 0;
  v_updated INTEGER := 0;
  v_inserted INTEGER := 0;
BEGIN
  CREATE TEMP TABLE _wger_raw (
    external_id BIGINT PRIMARY KEY,
    payload JSONB NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE _wger_muscle_map (
    source_key TEXT PRIMARY KEY,
    muscle_key TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _wger_muscle_map (source_key, muscle_key)
  VALUES
    ('anterior_deltoid', 'front_delts'),
    ('deltoid_anterior', 'front_delts'),
    ('lateral_deltoid', 'side_delts'),
    ('middle_deltoid', 'side_delts'),
    ('posterior_deltoid', 'rear_delts'),
    ('deltoid_posterior', 'rear_delts'),
    ('shoulders', 'shoulders'),
    ('biceps_brachii', 'biceps'),
    ('biceps', 'biceps'),
    ('triceps_brachii', 'triceps'),
    ('triceps', 'triceps'),
    ('brachialis', 'brachialis'),
    ('brachioradialis', 'forearms'),
    ('forearms', 'forearms'),
    ('pectoralis_major', 'chest'),
    ('pectorals', 'chest'),
    ('chest', 'chest'),
    ('latissimus_dorsi', 'lats'),
    ('latissimus', 'lats'),
    ('lats', 'lats'),
    ('trapezius', 'traps'),
    ('upper_trapezius', 'traps'),
    ('erector_spinae', 'lower_back'),
    ('lower_back', 'lower_back'),
    ('rectus_abdominis', 'abs'),
    ('abs', 'abs'),
    ('obliquus_externus_abdominis', 'obliques'),
    ('obliques', 'obliques'),
    ('gluteus_maximus', 'glutes'),
    ('gluteus_medius', 'glutes'),
    ('gluteus_minimus', 'glutes'),
    ('glutes', 'glutes'),
    ('quadriceps_femoris', 'quads'),
    ('quadriceps', 'quads'),
    ('quads', 'quads'),
    ('biceps_femoris', 'hamstrings'),
    ('hamstrings', 'hamstrings'),
    ('gastrocnemius', 'calves'),
    ('soleus', 'calves'),
    ('calves', 'calves'),
    ('hip_flexors', 'hip_flexors'),
    ('serratus_anterior', 'serratus_anterior'),
    ('teres_major', 'teres_major'),
    ('neck', 'neck'),
    ('adductors', 'adductors'),
    ('abductors', 'abductors');

  WHILE v_url IS NOT NULL LOOP
    SELECT * INTO v_http_response
    FROM extensions.http_get(v_url);

    IF v_http_response.status < 200 OR v_http_response.status >= 300 THEN
      RAISE EXCEPTION 'wger request failed: % %', v_http_response.status, left(v_http_response.content, 400);
    END IF;

    v_page := v_http_response.content::jsonb;

    INSERT INTO _wger_raw (external_id, payload)
    SELECT
      (item->>'id')::BIGINT AS external_id,
      item AS payload
    FROM jsonb_array_elements(COALESCE(v_page->'results', '[]'::jsonb)) item
    ON CONFLICT (external_id) DO UPDATE
      SET payload = EXCLUDED.payload;

    GET DIAGNOSTICS v_loaded_batch = ROW_COUNT;
    v_loaded_total := v_loaded_total + v_loaded_batch;

    v_url := NULLIF(v_page->>'next', '');
  END LOOP;

  CREATE TEMP TABLE _wger_stage AS
  WITH parsed AS (
    SELECT
      r.external_id,
      COALESCE(
        (
          SELECT NULLIF(btrim(t->>'name'), '')
          FROM jsonb_array_elements(COALESCE(r.payload->'translations', '[]'::jsonb)) t
          WHERE t->>'language' = '2'
            AND NULLIF(btrim(t->>'name'), '') IS NOT NULL
          LIMIT 1
        ),
        (
          SELECT NULLIF(btrim(t->>'name'), '')
          FROM jsonb_array_elements(COALESCE(r.payload->'translations', '[]'::jsonb)) t
          WHERE NULLIF(btrim(t->>'name'), '') IS NOT NULL
          LIMIT 1
        ),
        'exercise_' || r.external_id::TEXT
      ) AS name,
      lower(
        COALESCE(
          (
            SELECT NULLIF(btrim(t->>'name'), '')
            FROM jsonb_array_elements(COALESCE(r.payload->'translations', '[]'::jsonb)) t
            WHERE t->>'language' = '2'
              AND NULLIF(btrim(t->>'name'), '') IS NOT NULL
            LIMIT 1
          ),
          (
            SELECT NULLIF(btrim(t->>'name'), '')
            FROM jsonb_array_elements(COALESCE(r.payload->'translations', '[]'::jsonb)) t
            WHERE NULLIF(btrim(t->>'name'), '') IS NOT NULL
            LIMIT 1
          ),
          'exercise_' || r.external_id::TEXT
        )
      ) AS name_lc,
      ARRAY(
        SELECT lower(COALESCE(eq->>'name', ''))
        FROM jsonb_array_elements(COALESCE(r.payload->'equipment', '[]'::jsonb)) eq
      ) AS equipment_names,
      COALESCE(r.payload->'muscles', '[]'::jsonb) || COALESCE(r.payload->'muscles_secondary', '[]'::jsonb) AS all_muscles,
      ARRAY(
        SELECT DISTINCT img->>'image'
        FROM jsonb_array_elements(COALESCE(r.payload->'images', '[]'::jsonb)) img
        WHERE NULLIF(img->>'image', '') IS NOT NULL
      ) AS images
    FROM _wger_raw r
  )
  SELECT
    p.external_id,
    p.name,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM unnest(p.equipment_names) n
        WHERE n LIKE '%dumbbell%' OR n LIKE '%kettlebell%'
      ) THEN 'dumbbell'
      WHEN EXISTS (
        SELECT 1
        FROM unnest(p.equipment_names) n
        WHERE n LIKE '%barbell%' OR n LIKE '%sz-bar%' OR n LIKE '%ez-bar%' OR n LIKE '%hex bar%' OR n LIKE '%trap bar%'
      ) THEN 'barbell'
      WHEN EXISTS (
        SELECT 1
        FROM unnest(p.equipment_names) n
        WHERE n LIKE '%resistance band%' OR n LIKE '%band%' OR n LIKE '%trx%' OR n LIKE '%suspension%'
      ) THEN 'bands'
      WHEN EXISTS (
        SELECT 1
        FROM unnest(p.equipment_names) n
        WHERE n LIKE '%none (bodyweight exercise)%' OR n LIKE '%bodyweight%' OR n LIKE '%pull-up bar%'
      ) THEN 'bodyweight'
      WHEN p.name_lc ~ '(cable|kabel|seilzug)' THEN 'cable'
      WHEN p.name_lc ~ '(machine|maschin|smith|lever)' THEN 'machine'
      WHEN COALESCE(array_length(p.equipment_names, 1), 0) = 0 THEN 'bodyweight'
      ELSE 'other'
    END AS equipment,
    COALESCE(mus.primary_muscle, 'core') AS primary_muscle,
    COALESCE(mus.secondary_muscles, '{}'::TEXT[]) AS secondary_muscles,
    COALESCE(p.images, '{}'::TEXT[]) AS images
  FROM parsed p
  LEFT JOIN LATERAL (
    WITH dedup AS (
      SELECT
        COALESCE(mm.muscle_key, NULLIF(norm.normalized_name, '')) AS muscle_key,
        MIN(x.ord) AS first_ord
      FROM (
        SELECT
          m.obj,
          m.ord::INT AS ord
        FROM jsonb_array_elements(p.all_muscles) WITH ORDINALITY AS m(obj, ord)
      ) x
      CROSS JOIN LATERAL (
        SELECT trim(
          BOTH '_' FROM regexp_replace(lower(COALESCE(x.obj->>'name_en', x.obj->>'name', '')), '[^a-z0-9]+', '_', 'g')
        ) AS normalized_name
      ) norm
      LEFT JOIN _wger_muscle_map mm
        ON mm.source_key = norm.normalized_name
      WHERE COALESCE(mm.muscle_key, NULLIF(norm.normalized_name, '')) IS NOT NULL
      GROUP BY COALESCE(mm.muscle_key, NULLIF(norm.normalized_name, ''))
    ),
    muscle_arr AS (
      SELECT array_agg(muscle_key ORDER BY first_ord) AS arr
      FROM dedup
    )
    SELECT
      arr[1] AS primary_muscle,
      COALESCE(ARRAY(SELECT v FROM unnest(arr) WITH ORDINALITY u(v, idx) WHERE idx > 1 LIMIT 8), '{}'::TEXT[]) AS secondary_muscles
    FROM muscle_arr
  ) mus ON TRUE;

  CREATE TEMP TABLE _wger_final AS
  SELECT DISTINCT ON (lower(name), equipment)
    name,
    equipment,
    primary_muscle,
    secondary_muscles,
    images
  FROM _wger_stage
  ORDER BY lower(name), equipment, COALESCE(array_length(images, 1), 0) DESC, external_id ASC;

  UPDATE public.training_exercises te
  SET
    primary_muscle = f.primary_muscle,
    secondary_muscles = f.secondary_muscles,
    images = CASE
      WHEN COALESCE(array_length(f.images, 1), 0) > 0 THEN f.images
      ELSE te.images
    END,
    type = f.equipment,
    updated_at = NOW()
  FROM _wger_final f
  WHERE te.is_system = TRUE
    AND lower(te.name) = lower(f.name)
    AND te.equipment = f.equipment;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

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
    f.name,
    f.equipment,
    f.primary_muscle,
    f.secondary_muscles,
    f.images,
    f.equipment,
    TRUE
  FROM _wger_final f
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.training_exercises te
    WHERE te.is_system = TRUE
      AND lower(te.name) = lower(f.name)
      AND te.equipment = f.equipment
  );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'wger import finished: loaded %, updated %, inserted %',
    v_loaded_total,
    v_updated,
    v_inserted;
END
$$;

COMMIT;
