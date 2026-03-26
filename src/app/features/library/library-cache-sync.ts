import {
  IngredientsSnapshot,
  LibraryDataService,
  MealsSnapshot,
} from '../../core/library-data.service';
import { Ingredient, Meal, MealItem } from '../../core/types';
import { buildMealCosts, buildMealMacros } from './library-view-utils';

export interface DerivedLibraryMetrics {
  mealMacros: Record<string, { kcal: number; protein: number; carbs: number; fat: number }>;
  mealCosts: Record<string, number>;
}

export function deriveLibraryMetrics(
  ingredients: Ingredient[],
  meals: Meal[],
  mealItems: MealItem[],
): DerivedLibraryMetrics {
  return {
    mealMacros: buildMealMacros(meals, mealItems, ingredients),
    mealCosts: buildMealCosts(meals, mealItems, ingredients),
  };
}

export function createIngredientsSnapshot(ingredients: Ingredient[]): IngredientsSnapshot {
  return {
    ingredients,
    fetchedAt: new Date().toISOString(),
  };
}

export function createMealsSnapshot(
  meals: Meal[],
  mealItems: MealItem[],
  ingredients: Ingredient[],
): MealsSnapshot {
  return {
    meals,
    mealItems,
    mealMacros: buildMealMacros(meals, mealItems, ingredients),
    fetchedAt: new Date().toISOString(),
  };
}

export function syncLibraryCaches(params: {
  libraryDataService: LibraryDataService;
  userId: string | null;
  ingredientsLoaded: boolean;
  mealsLoaded: boolean;
  ingredients: Ingredient[];
  meals: Meal[];
  mealItems: MealItem[];
}): void {
  if (!params.userId) {
    return;
  }

  if (params.ingredientsLoaded) {
    params.libraryDataService.setIngredientsSnapshot(
      params.userId,
      createIngredientsSnapshot(params.ingredients),
    );
  }

  if (params.mealsLoaded) {
    params.libraryDataService.setMealsSnapshot(
      params.userId,
      createMealsSnapshot(params.meals, params.mealItems, params.ingredients),
    );
  }
}
