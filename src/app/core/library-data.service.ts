import { Injectable, inject } from '@angular/core';
import { Ingredient, Meal, MealItem } from './types';
import { SupabaseService } from './supabase.service';
import { QueryCacheService } from './query-cache.service';

export interface MealMacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface LibrarySnapshot {
  ingredients: Ingredient[];
  meals: Meal[];
  mealItems: MealItem[];
  mealMacros: Record<string, MealMacroTotals>;
  fetchedAt: string;
}

interface LoadLibraryOptions {
  forceRefresh?: boolean;
  allowStaleOnError?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryDataService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly queryCache = inject(QueryCacheService);

  private readonly libraryTtlMs = 1000 * 60 * 60 * 12; // 12h

  async loadLibrary(userId: string, options: LoadLibraryOptions = {}): Promise<LibrarySnapshot> {
    const cacheKey = this.cacheKey(userId);

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.libraryTtlMs,
      forceRefresh: options.forceRefresh,
      allowStaleOnError: options.allowStaleOnError,
      loader: () => this.fetchFromNetwork(userId)
    });

    return value;
  }

  invalidate(userId: string): void {
    this.queryCache.invalidate(this.cacheKey(userId));
  }

  private async fetchFromNetwork(userId: string): Promise<LibrarySnapshot> {
    const [{ data: ingredientsData, error: ingredientError }, { data: mealsData, error: mealsError }] = await Promise.all([
      this.supabaseService.client
        .from('ingredients')
        .select('id,owner_id,name,source_type,blv_food_id,swissfir_id,category,reference_unit,source_dataset,base_ingredient_id,kcal_per_100,cost_per_100,market_name,protein_per_100,carbs_per_100,fat_per_100,brand,created_at')
        .eq('owner_id', userId),
      this.supabaseService.client
        .from('meals')
        .select('id,owner_id,name,created_at')
        .eq('owner_id', userId)
    ]);

    if (ingredientError) {
      throw ingredientError;
    }
    if (mealsError) {
      throw mealsError;
    }

    const ingredients = (ingredientsData || []) as Ingredient[];
    const meals = (mealsData || []) as Meal[];
    const mealIds = meals.map(item => item.id);

    const mealItems = mealIds.length > 0
      ? await this.fetchMealItems(mealIds)
      : [];

    return {
      ingredients,
      meals,
      mealItems,
      mealMacros: this.buildMealMacros(meals, mealItems, ingredients),
      fetchedAt: new Date().toISOString()
    };
  }

  private async fetchMealItems(mealIds: string[]): Promise<MealItem[]> {
    const { data, error } = await this.supabaseService.client
      .from('meal_items')
      .select('meal_id,ingredient_id,grams')
      .in('meal_id', mealIds);

    if (error) {
      throw error;
    }

    return (data || []) as MealItem[];
  }

  private buildMealMacros(meals: Meal[], mealItems: MealItem[], ingredients: Ingredient[]): Record<string, MealMacroTotals> {
    const ingredientMap = new Map(ingredients.map(item => [item.id, item]));
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

  private cacheKey(userId: string): string {
    return `library:${userId}`;
  }
}
