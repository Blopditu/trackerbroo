BEGIN;

DELETE FROM public.daily_summaries;

INSERT INTO public.daily_summaries (
  owner_id,
  group_id,
  day,
  kcal,
  protein,
  carbs,
  fat,
  updated_at
)
SELECT
  owner_id,
  group_id,
  day,
  COALESCE(SUM(kcal), 0) AS kcal,
  COALESCE(SUM(protein), 0) AS protein,
  COALESCE(SUM(carbs), 0) AS carbs,
  COALESCE(SUM(fat), 0) AS fat,
  NOW() AS updated_at
FROM public.log_entries
GROUP BY owner_id, group_id, day;

COMMIT;
