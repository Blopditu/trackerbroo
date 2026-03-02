BEGIN;

CREATE OR REPLACE FUNCTION public.update_daily_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_owner_id UUID := COALESCE(NEW.owner_id, OLD.owner_id);
  target_group_id UUID := COALESCE(NEW.group_id, OLD.group_id);
  target_day DATE := COALESCE(NEW.day, OLD.day);
  has_entries BOOLEAN := FALSE;
  total_kcal DECIMAL(10,2) := 0;
  total_protein DECIMAL(10,2) := 0;
  total_carbs DECIMAL(10,2) := 0;
  total_fat DECIMAL(10,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(kcal), 0),
    COALESCE(SUM(protein), 0),
    COALESCE(SUM(carbs), 0),
    COALESCE(SUM(fat), 0)
  INTO total_kcal, total_protein, total_carbs, total_fat
  FROM public.log_entries
  WHERE owner_id = target_owner_id
    AND day = target_day
    AND (
      (group_id IS NULL AND target_group_id IS NULL)
      OR group_id = target_group_id
    );

  SELECT EXISTS (
    SELECT 1
    FROM public.log_entries
    WHERE owner_id = target_owner_id
      AND day = target_day
      AND (
        (group_id IS NULL AND target_group_id IS NULL)
        OR group_id = target_group_id
      )
  ) INTO has_entries;

  IF has_entries THEN
    INSERT INTO public.daily_summaries (owner_id, group_id, day, kcal, protein, carbs, fat, updated_at)
    VALUES (target_owner_id, target_group_id, target_day, total_kcal, total_protein, total_carbs, total_fat, NOW())
    ON CONFLICT (owner_id, group_id, day)
    DO UPDATE SET
      kcal = EXCLUDED.kcal,
      protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs,
      fat = EXCLUDED.fat,
      updated_at = NOW();
  ELSE
    DELETE FROM public.daily_summaries
    WHERE owner_id = target_owner_id
      AND day = target_day
      AND (
        (group_id IS NULL AND target_group_id IS NULL)
        OR group_id = target_group_id
      );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_daily_summary ON public.log_entries;
CREATE TRIGGER trigger_update_daily_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.log_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_daily_summary();

COMMIT;
