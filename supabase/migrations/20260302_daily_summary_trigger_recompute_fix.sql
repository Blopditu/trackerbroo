BEGIN;

CREATE OR REPLACE FUNCTION public.recompute_daily_summary_row(
  p_owner_id UUID,
  p_group_id UUID,
  p_day DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  total_kcal DECIMAL(10,2) := 0;
  total_protein DECIMAL(10,2) := 0;
  total_carbs DECIMAL(10,2) := 0;
  total_fat DECIMAL(10,2) := 0;
  has_entries BOOLEAN := FALSE;
BEGIN
  IF p_owner_id IS NULL OR p_day IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(kcal), 0),
    COALESCE(SUM(protein), 0),
    COALESCE(SUM(carbs), 0),
    COALESCE(SUM(fat), 0),
    COUNT(*) > 0
  INTO total_kcal, total_protein, total_carbs, total_fat, has_entries
  FROM public.log_entries
  WHERE owner_id = p_owner_id
    AND day = p_day
    AND (
      (group_id IS NULL AND p_group_id IS NULL)
      OR group_id = p_group_id
    );

  IF has_entries THEN
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
    VALUES (
      p_owner_id,
      p_group_id,
      p_day,
      total_kcal,
      total_protein,
      total_carbs,
      total_fat,
      NOW()
    )
    ON CONFLICT (owner_id, group_id, day)
    DO UPDATE SET
      kcal = EXCLUDED.kcal,
      protein = EXCLUDED.protein,
      carbs = EXCLUDED.carbs,
      fat = EXCLUDED.fat,
      updated_at = NOW();
  ELSE
    DELETE FROM public.daily_summaries
    WHERE owner_id = p_owner_id
      AND day = p_day
      AND (
        (group_id IS NULL AND p_group_id IS NULL)
        OR group_id = p_group_id
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_daily_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_daily_summary_row(NEW.owner_id, NEW.group_id, NEW.day);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_daily_summary_row(OLD.owner_id, OLD.group_id, OLD.day);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_daily_summary_row(OLD.owner_id, OLD.group_id, OLD.day);
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
    OR NEW.group_id IS DISTINCT FROM OLD.group_id
    OR NEW.day IS DISTINCT FROM OLD.day THEN
    PERFORM public.recompute_daily_summary_row(NEW.owner_id, NEW.group_id, NEW.day);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_daily_summary ON public.log_entries;
CREATE TRIGGER trigger_update_daily_summary
  AFTER INSERT OR UPDATE OR DELETE ON public.log_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_summary();

COMMIT;
