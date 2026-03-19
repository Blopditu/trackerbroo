import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Ingredient, MealItem } from '../../core/types';

export type IngredientSourceType = 'manual' | 'blv_generic' | 'custom_product';

export type IngredientFormGroup = FormGroup<{
  source_type: FormControl<IngredientSourceType>;
  base_ingredient_id: FormControl<string | null>;
  name: FormControl<string>;
  kcal_per_100: FormControl<number>;
  cost_per_100: FormControl<number | null>;
  market_name: FormControl<string>;
  protein_per_100: FormControl<number>;
  carbs_per_100: FormControl<number>;
  fat_per_100: FormControl<number>;
  brand: FormControl<string>;
}>;

export type MealItemFormGroup = FormGroup<{
  ingredient_id: FormControl<string>;
  grams: FormControl<number>;
}>;

export type MealFormGroup = FormGroup<{
  name: FormControl<string>;
  items: FormArray<MealItemFormGroup>;
}>;

export interface MealItemDraft {
  ingredient_id: string;
  grams: number;
}

export function createIngredientForm(formBuilder: FormBuilder): IngredientFormGroup {
  return formBuilder.nonNullable.group({
    source_type: 'manual' as IngredientSourceType,
    base_ingredient_id: new FormControl<string | null>(null),
    name: ['', [Validators.required]],
    kcal_per_100: [0, [Validators.required]],
    cost_per_100: new FormControl<number | null>(null),
    market_name: [''],
    protein_per_100: [0, [Validators.required]],
    carbs_per_100: [0, [Validators.required]],
    fat_per_100: [0, [Validators.required]],
    brand: ['']
  });
}

export function createMealForm(formBuilder: FormBuilder): MealFormGroup {
  return formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    items: formBuilder.array<MealItemFormGroup>([createMealItemGroup(formBuilder, { ingredient_id: '', grams: 0 })])
  });
}

export function createMealItemGroup(formBuilder: FormBuilder, value: MealItemDraft): MealItemFormGroup {
  return formBuilder.nonNullable.group({
    ingredient_id: value.ingredient_id,
    grams: value.grams
  });
}

export function replaceMealItems(
  formBuilder: FormBuilder,
  mealForm: MealFormGroup,
  items: MealItemDraft[]
): void {
  const nextItems = items.length > 0 ? items : [{ ingredient_id: '', grams: 0 }];
  mealForm.setControl(
    'items',
    formBuilder.array(nextItems.map(item => createMealItemGroup(formBuilder, item)))
  );
}

export function resetIngredientFormForCreate(ingredientForm: IngredientFormGroup): void {
  ingredientForm.reset({
    source_type: 'manual',
    base_ingredient_id: null,
    name: '',
    kcal_per_100: 0,
    cost_per_100: null,
    market_name: '',
    protein_per_100: 0,
    carbs_per_100: 0,
    fat_per_100: 0,
    brand: ''
  });
}

export function resetIngredientFormForEdit(ingredientForm: IngredientFormGroup, ingredient: Ingredient): void {
  ingredientForm.reset({
    source_type: ingredient.source_type || 'manual',
    base_ingredient_id: ingredient.base_ingredient_id ?? null,
    name: ingredient.name,
    kcal_per_100: Number(ingredient.kcal_per_100),
    cost_per_100: ingredient.cost_per_100 ?? null,
    market_name: ingredient.market_name || '',
    protein_per_100: Number(ingredient.protein_per_100),
    carbs_per_100: Number(ingredient.carbs_per_100),
    fat_per_100: Number(ingredient.fat_per_100),
    brand: ingredient.brand || ''
  });
}

export function resetMealFormForCreate(
  formBuilder: FormBuilder,
  mealForm: MealFormGroup
): void {
  mealForm.reset({ name: '' });
  replaceMealItems(formBuilder, mealForm, [{ ingredient_id: '', grams: 0 }]);
}

export function resetMealFormForEdit(
  formBuilder: FormBuilder,
  mealForm: MealFormGroup,
  mealName: string,
  items: MealItem[]
): void {
  mealForm.controls.name.setValue(mealName);
  replaceMealItems(
    formBuilder,
    mealForm,
    items.map(item => ({
      ingredient_id: item.ingredient_id,
      grams: Number(item.grams)
    }))
  );
}
