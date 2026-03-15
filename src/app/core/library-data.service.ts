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

export interface IngredientsSnapshot {
  ingredients: Ingredient[];
  fetchedAt: string;
}

export interface MealsSnapshot {
  meals: Meal[];
  mealItems: MealItem[];
  mealMacros: Record<string, MealMacroTotals>;
  fetchedAt: string;
}

export interface LoadLibraryOptions {
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

  async loadIngredients(userId: string, options: LoadLibraryOptions = {}): Promise<IngredientsSnapshot> {
    const cacheKey = this.ingredientsCacheKey(userId);

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.libraryTtlMs,
      forceRefresh: options.forceRefresh,
      allowStaleOnError: options.allowStaleOnError,
      loader: () => this.fetchIngredientsFromNetwork(userId)
    });

    return value;
  }

  async loadMeals(userId: string, options: LoadLibraryOptions = {}): Promise<MealsSnapshot> {
    const cacheKey = this.mealsCacheKey(userId);

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.libraryTtlMs,
      forceRefresh: options.forceRefresh,
      allowStaleOnError: options.allowStaleOnError,
      loader: () => this.fetchMealsFromNetwork(userId)
    });

    return value;
  }

  async loadLibrary(userId: string, options: LoadLibraryOptions = {}): Promise<LibrarySnapshot> {
    const [ingredientsSnapshot, mealsSnapshot] = await Promise.all([
      this.loadIngredients(userId, options),
      this.loadMeals(userId, options)
    ]);

    const snapshot: LibrarySnapshot = {
      ingredients: ingredientsSnapshot.ingredients,
      meals: mealsSnapshot.meals,
      mealItems: mealsSnapshot.mealItems,
      mealMacros: mealsSnapshot.mealMacros,
      fetchedAt: new Date().toISOString()
    };

    this.queryCache.set(this.libraryCacheKey(userId), snapshot, this.libraryTtlMs);
    return snapshot;
  }

  setIngredientsSnapshot(userId: string, snapshot: IngredientsSnapshot): void {
    this.queryCache.set(this.ingredientsCacheKey(userId), snapshot, this.libraryTtlMs);
    this.syncCombinedSnapshot(userId, snapshot, this.getCachedMealsSnapshot(userId));
  }

  setMealsSnapshot(userId: string, snapshot: MealsSnapshot): void {
    this.queryCache.set(this.mealsCacheKey(userId), snapshot, this.libraryTtlMs);
    this.syncCombinedSnapshot(userId, this.getCachedIngredientsSnapshot(userId), snapshot);
  }

  invalidate(userId: string): void {
    this.queryCache.invalidate(this.ingredientsCacheKey(userId));
    this.queryCache.invalidate(this.mealsCacheKey(userId));
    this.queryCache.invalidate(this.libraryCacheKey(userId));
  }

  getCachedIngredientsSnapshot(userId: string): IngredientsSnapshot | null {
    return this.queryCache.getFresh<IngredientsSnapshot>(this.ingredientsCacheKey(userId))
      || this.queryCache.getStale<IngredientsSnapshot>(this.ingredientsCacheKey(userId));
  }

  getCachedMealsSnapshot(userId: string): MealsSnapshot | null {
    return this.queryCache.getFresh<MealsSnapshot>(this.mealsCacheKey(userId))
      || this.queryCache.getStale<MealsSnapshot>(this.mealsCacheKey(userId));
  }

  private async fetchIngredientsFromNetwork(userId: string): Promise<IngredientsSnapshot> {
    const { data, error } = await this.supabaseService.client
      .from('ingredients')
      .select('id,owner_id,name,source_type,blv_food_id,swissfir_id,category,reference_unit,source_dataset,base_ingredient_id,kcal_per_100,cost_per_100,market_name,protein_per_100,carbs_per_100,fat_per_100,brand,created_at')
      .eq('owner_id', userId);

    if (error) {
      throw error;
    }

    return {
      ingredients: (data || []) as Ingredient[],
      fetchedAt: new Date().toISOString()
    };
  }

  private async fetchMealsFromNetwork(userId: string): Promise<MealsSnapshot> {
    const ingredientsSnapshot = this.getCachedIngredientsSnapshot(userId) || await this.fetchIngredientsFromNetwork(userId);
    const { data: mealsData, error: mealsError } = await this.supabaseService.client
      .from('meals')
      .select('id,owner_id,name,created_at')
      .eq('owner_id', userId);

    if (mealsError) {
      throw mealsError;
    }

    const meals = (mealsData || []) as Meal[];
    const mealIds = meals.map(item => item.id);
    const mealItems = mealIds.length > 0 ? await this.fetchMealItems(mealIds) : [];

    return {
      meals,
      mealItems,
      mealMacros: this.buildMealMacros(meals, mealItems, ingredientsSnapshot.ingredients),
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

  private syncCombinedSnapshot(
    userId: string,
    ingredientsSnapshot: IngredientsSnapshot | null,
    mealsSnapshot: MealsSnapshot | null
  ): void {
    if (!ingredientsSnapshot || !mealsSnapshot) {
      return;
    }

    this.queryCache.set(this.libraryCacheKey(userId), {
      ingredients: ingredientsSnapshot.ingredients,
      meals: mealsSnapshot.meals,
      mealItems: mealsSnapshot.mealItems,
      mealMacros: mealsSnapshot.mealMacros,
      fetchedAt: new Date().toISOString()
    }, this.libraryTtlMs);
  }

  private ingredientsCacheKey(userId: string): string {
    return `library:ingredients:${userId}`;
  }

  private mealsCacheKey(userId: string): string {
    return `library:meals:${userId}`;
  }

  private libraryCacheKey(userId: string): string {
    return `library:${userId}`;
  }
}
