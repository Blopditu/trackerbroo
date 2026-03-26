import { Ingredient, Meal, MealItem } from '../../core/types';
import { IngredientFormGroup, MealFormGroup } from './library-editor-form-factory';

export interface LibraryLocalState {
  ingredients: Ingredient[];
  meals: Meal[];
  mealItems: MealItem[];
  ingredientsLoaded: boolean;
  mealsLoaded: boolean;
}

export interface LibraryRollbackState extends LibraryLocalState {}

export interface IngredientMutationPayload {
  source_type: Ingredient['source_type'];
  base_ingredient_id: string | null;
  name: string;
  kcal_per_100: number;
  cost_per_100: number | null;
  market_name: string | null;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  brand: string;
}

export interface IngredientMutationDraft {
  payload: IngredientMutationPayload;
  optimisticIngredient: Ingredient;
  nextIngredients: Ingredient[];
}

export interface MealMutationDraft {
  optimisticMealId: string;
  optimisticMeal: Meal;
  optimisticMeals: Meal[];
  optimisticMealItems: MealItem[];
  filteredItems: Array<{ ingredient_id: string; grams: number }>;
}

export function createRollbackState(state: LibraryLocalState): LibraryRollbackState {
  return {
    ingredients: [...state.ingredients],
    meals: [...state.meals],
    mealItems: [...state.mealItems],
    ingredientsLoaded: state.ingredientsLoaded,
    mealsLoaded: state.mealsLoaded,
  };
}

export function buildIngredientMutationDraft(
  userId: string,
  editingIngredient: Ingredient | null,
  ingredientForm: IngredientFormGroup,
  currentIngredients: Ingredient[],
): IngredientMutationDraft {
  const formValue = ingredientForm.getRawValue();
  const marketName = formValue.market_name.trim();
  const normalizedCost =
    formValue.cost_per_100 === null || formValue.cost_per_100 === undefined
      ? null
      : Number(formValue.cost_per_100);
  const payload: IngredientMutationPayload = {
    source_type: formValue.source_type,
    base_ingredient_id:
      formValue.source_type === 'custom_product' ? formValue.base_ingredient_id : null,
    name: formValue.name.trim(),
    kcal_per_100: Number(formValue.kcal_per_100),
    cost_per_100: Number.isFinite(normalizedCost) ? normalizedCost : null,
    market_name: marketName || null,
    protein_per_100: Number(formValue.protein_per_100),
    carbs_per_100: Number(formValue.carbs_per_100),
    fat_per_100: Number(formValue.fat_per_100),
    brand: formValue.brand.trim() || '',
  };

  const optimisticIngredient: Ingredient = {
    id: editingIngredient?.id || `temp-ingredient-${Date.now()}`,
    owner_id: userId,
    blv_food_id: editingIngredient?.blv_food_id ?? null,
    swissfir_id: editingIngredient?.swissfir_id ?? null,
    category: editingIngredient?.category ?? null,
    reference_unit: editingIngredient?.reference_unit ?? null,
    source_dataset: editingIngredient?.source_dataset ?? null,
    created_at: editingIngredient?.created_at || new Date().toISOString(),
    ...payload,
  };

  const nextIngredients = editingIngredient
    ? currentIngredients.map((item) =>
        item.id === editingIngredient.id ? optimisticIngredient : item,
      )
    : [optimisticIngredient, ...currentIngredients];

  return {
    payload,
    optimisticIngredient,
    nextIngredients,
  };
}

export function buildMealMutationDraft(
  userId: string,
  editingMeal: Meal | null,
  mealForm: MealFormGroup,
  currentMeals: Meal[],
  currentMealItems: MealItem[],
): MealMutationDraft {
  const filteredItems = mealForm
    .getRawValue()
    .items.filter((item) => Boolean(item.ingredient_id) && Number(item.grams) > 0)
    .map((item) => ({
      ingredient_id: item.ingredient_id,
      grams: Number(item.grams),
    }));

  const optimisticMealId = editingMeal?.id || `temp-meal-${Date.now()}`;
  const optimisticMeal: Meal = {
    id: optimisticMealId,
    owner_id: userId,
    name: mealForm.controls.name.value.trim(),
    created_at: editingMeal?.created_at || new Date().toISOString(),
  };

  const optimisticMeals = editingMeal
    ? currentMeals.map((item) => (item.id === editingMeal.id ? optimisticMeal : item))
    : [optimisticMeal, ...currentMeals];

  const optimisticMealItems = [
    ...currentMealItems.filter(
      (item) => item.meal_id !== optimisticMealId && item.meal_id !== editingMeal?.id,
    ),
    ...filteredItems.map((item) => ({
      meal_id: optimisticMealId,
      ingredient_id: item.ingredient_id,
      grams: item.grams,
    })),
  ];

  return {
    optimisticMealId,
    optimisticMeal,
    optimisticMeals,
    optimisticMealItems,
    filteredItems,
  };
}

export function remapMealItems(
  items: MealItem[],
  fromMealId: string,
  toMealId: string,
): MealItem[] {
  return items.map((item) => (item.meal_id === fromMealId ? { ...item, meal_id: toMealId } : item));
}

export function finalizeMealItems(
  currentMealItems: MealItem[],
  mealId: string,
  items: Array<{ ingredient_id: string; grams: number }>,
): MealItem[] {
  return [
    ...currentMealItems.filter((item) => item.meal_id !== mealId),
    ...items.map((item) => ({
      meal_id: mealId,
      ingredient_id: item.ingredient_id,
      grams: item.grams,
    })),
  ];
}
