import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LibraryDataService } from './library-data.service';
import { QueryCacheService } from './query-cache.service';
import { SupabaseService } from './supabase.service';
import { Ingredient, Meal, MealItem } from './types';

class QueryCacheStub {
  private readonly store = new Map<string, unknown>();

  readonly getOrLoad = vi.fn(
    async <T>(options: { key: string; loader: () => Promise<T>; forceRefresh?: boolean }) => {
      if (!options.forceRefresh && this.store.has(options.key)) {
        return { value: this.store.get(options.key) as T, source: 'cache' as const };
      }

      const value = await options.loader();
      this.store.set(options.key, value);
      return { value, source: 'network' as const };
    },
  );

  readonly set = vi.fn((key: string, value: unknown) => {
    this.store.set(key, value);
  });

  readonly invalidate = vi.fn((key: string) => {
    this.store.delete(key);
  });

  readonly getFresh = vi.fn((key: string) => this.store.get(key) ?? null);
  readonly getStale = vi.fn((key: string) => this.store.get(key) ?? null);
}

function createSupabaseClientMock(params: {
  ingredients: Ingredient[];
  meals: Meal[];
  mealItems: MealItem[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'ingredients') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: params.ingredients, error: null })),
          })),
        };
      }

      if (table === 'meals') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: params.meals, error: null })),
          })),
        };
      }

      if (table === 'meal_items') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: params.mealItems, error: null })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('LibraryDataService', () => {
  const ingredients: Ingredient[] = [
    {
      id: 'ingredient-1',
      owner_id: 'user-1',
      name: 'Skyr',
      source_type: 'manual',
      kcal_per_100: 60,
      protein_per_100: 11,
      carbs_per_100: 4,
      fat_per_100: 0,
      created_at: '2026-03-19T00:00:00Z',
    },
  ];
  const meals: Meal[] = [
    {
      id: 'meal-1',
      owner_id: 'user-1',
      name: 'Skyr Bowl',
      created_at: '2026-03-19T00:00:00Z',
    },
  ];
  const mealItems: MealItem[] = [
    {
      meal_id: 'meal-1',
      ingredient_id: 'ingredient-1',
      grams: 200,
    },
  ];

  let service: LibraryDataService;
  let queryCache: QueryCacheStub;

  beforeEach(() => {
    queryCache = new QueryCacheStub();

    TestBed.configureTestingModule({
      providers: [
        LibraryDataService,
        { provide: QueryCacheService, useValue: queryCache as unknown as QueryCacheService },
        {
          provide: SupabaseService,
          useValue: { client: createSupabaseClientMock({ ingredients, meals, mealItems }) },
        },
      ],
    });

    service = TestBed.inject(LibraryDataService);
  });

  it('uses separate cache keys for ingredients and meals', async () => {
    await service.loadIngredients('user-1');
    await service.loadMeals('user-1');

    expect(queryCache.getOrLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'library:ingredients:user-1',
      }),
    );
    expect(queryCache.getOrLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'library:meals:user-1',
      }),
    );
  });

  it('composes both slices for loadLibrary and stores the combined snapshot', async () => {
    const snapshot = await service.loadLibrary('user-1');

    expect(snapshot.ingredients).toEqual(ingredients);
    expect(snapshot.meals).toEqual(meals);
    expect(snapshot.mealItems).toEqual(mealItems);
    expect(queryCache.set).toHaveBeenCalledWith(
      'library:user-1',
      expect.objectContaining({
        ingredients,
        meals,
        mealItems,
      }),
      expect.any(Number),
    );
  });

  it('keeps the combined cache coherent when slice snapshots are patched', () => {
    service.setIngredientsSnapshot('user-1', {
      ingredients,
      fetchedAt: '2026-03-19T00:00:00Z',
    });

    service.setMealsSnapshot('user-1', {
      meals,
      mealItems,
      mealMacros: {
        'meal-1': { kcal: 120, protein: 22, carbs: 8, fat: 0 },
      },
      fetchedAt: '2026-03-19T00:00:00Z',
    });

    const combined = queryCache.getFresh('library:user-1') as {
      ingredients: Ingredient[];
      meals: Meal[];
      mealItems: MealItem[];
    };

    expect(combined.ingredients).toEqual(ingredients);
    expect(combined.meals).toEqual(meals);
    expect(combined.mealItems).toEqual(mealItems);
  });
});
