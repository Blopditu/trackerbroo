BEGIN;

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS base_ingredient_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_base_ingredient_fk'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_base_ingredient_fk
      FOREIGN KEY (base_ingredient_id)
      REFERENCES public.ingredients (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ingredients_base_not_self_chk'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_base_not_self_chk
      CHECK (base_ingredient_id IS NULL OR base_ingredient_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ingredients_owner_base_ingredient_idx
  ON public.ingredients (owner_id, base_ingredient_id);

COMMIT;
