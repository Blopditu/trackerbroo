import { Ingredient, Meal, MealItem } from '../../core/types';
import { MealMacroTotals } from '../../core/library-data.service';

export interface LibraryMealListRow {
  id: string;
  name: string;
  costLabel: string;
  macros: MealMacroTotals | null;
}

export function buildMealMacros(
  meals: Meal[],
  mealItems: MealItem[],
  ingredients: Ingredient[],
): Record<string, MealMacroTotals> {
  const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));
  const mealMacros: Record<string, MealMacroTotals> = {};

  for (const meal of meals) {
    mealMacros[meal.id] = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }

  for (const item of mealItems) {
    const ingredient = ingredientMap.get(item.ingredient_id);
    const target = mealMacros[item.meal_id];
    if (!ingredient || !target) {
      continue;
    }

    const factor = Number(item.grams) / 100;
    target.kcal += Number(ingredient.kcal_per_100) * factor;
    target.protein += Number(ingredient.protein_per_100) * factor;
    target.carbs += Number(ingredient.carbs_per_100) * factor;
    target.fat += Number(ingredient.fat_per_100) * factor;
  }

  return mealMacros;
}

export function buildMealCosts(
  meals: Meal[],
  mealItems: MealItem[],
  ingredients: Ingredient[],
): Record<string, number> {
  const ingredientCostMap = new Map(
    ingredients.map((ingredient) => [ingredient.id, Number(ingredient.cost_per_100 || 0)]),
  );
  const costs: Record<string, number> = {};

  for (const meal of meals) {
    costs[meal.id] = 0;
  }

  for (const item of mealItems) {
    const unitCost = ingredientCostMap.get(item.ingredient_id) || 0;
    costs[item.meal_id] = (costs[item.meal_id] || 0) + (Number(item.grams) / 100) * unitCost;
  }

  for (const mealId of Object.keys(costs)) {
    costs[mealId] = Number(costs[mealId].toFixed(2));
  }

  return costs;
}

export function formatCurrency(value: number): string {
  return `${value.toFixed(2)} €`;
}

export function formatMacroValue(value: number): string {
  return Number(value).toFixed(1);
}

export function roundKcal(value: number): number {
  return Math.max(0, Math.round(value));
}

export function sourceTypeLabel(sourceType?: Ingredient['source_type']): string {
  if (sourceType === 'blv_generic') return 'BLV generisch';
  if (sourceType === 'custom_product') return 'Konkretes Produkt';
  return 'Manuell';
}
