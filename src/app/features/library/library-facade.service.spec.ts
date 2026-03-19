import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { LibraryDataService } from '../../core/library-data.service';
import { SupabaseService } from '../../core/supabase.service';
import { Ingredient, Meal, MealItem } from '../../core/types';
import { LibraryFacadeService } from './library-facade.service';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function createSupabaseClientStub() {
  const ingredientsInsertSingle = vi.fn();
  const ingredientsUpdateSingle = vi.fn();
  const ingredientsDeleteEq = vi.fn();
  const mealsInsertSingle = vi.fn();
  const mealsUpdateEq = vi.fn();
  const mealsDeleteEq = vi.fn();
  const mealItemsDeleteEq = vi.fn();
  const mealItemsInsert = vi.fn();

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'ingredients') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: ingredientsInsertSingle
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: ingredientsUpdateSingle
                }))
              }))
            }))
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: ingredientsDeleteEq
            }))
          }))
        };
      }

      if (table === 'meals') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mealsInsertSingle
            }))
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mealsUpdateEq
            }))
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: mealsDeleteEq
            }))
          }))
        };
      }

      if (table === 'meal_items') {
        return {
          delete: vi.fn(() => ({
            eq: mealItemsDeleteEq
          })),
          insert: mealItemsInsert
        };
      }

      throw new Error(`Unexpected table ${table}`);
    })
  };

  return {
    client,
    ingredientsInsertSingle,
    ingredientsUpdateSingle,
    ingredientsDeleteEq,
    mealsInsertSingle,
    mealsUpdateEq,
    mealsDeleteEq,
    mealItemsDeleteEq,
    mealItemsInsert
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('LibraryFacadeService', () => {
  const ingredient: Ingredient = {
    id: 'ingredient-1',
    owner_id: 'user-1',
    name: 'Skyr',
    source_type: 'manual',
    kcal_per_100: 60,
    protein_per_100: 11,
    carbs_per_100: 4,
    fat_per_100: 0,
    created_at: '2026-03-19T00:00:00Z'
  };
  const ingredientTwo: Ingredient = {
    ...ingredient,
    id: 'ingredient-2',
    name: 'Banane',
    kcal_per_100: 89,
    protein_per_100: 1.1,
    carbs_per_100: 23,
    fat_per_100: 0.3
  };
  const meal: Meal = {
    id: 'meal-1',
    owner_id: 'user-1',
    name: 'Skyr Bowl',
    created_at: '2026-03-19T00:00:00Z'
  };
  const mealItems: MealItem[] = [{
    meal_id: 'meal-1',
    ingredient_id: 'ingredient-1',
    grams: 200
  }];

  let facade: LibraryFacadeService;
  let authUser: ReturnType<typeof signal<{ id: string } | null>>;
  let libraryData: {
    loadIngredients: ReturnType<typeof vi.fn>;
    loadMeals: ReturnType<typeof vi.fn>;
    setIngredientsSnapshot: ReturnType<typeof vi.fn>;
    setMealsSnapshot: ReturnType<typeof vi.fn>;
  };
  let supabase: ReturnType<typeof createSupabaseClientStub>;

  beforeEach(() => {
    authUser = signal<{ id: string } | null>({ id: 'user-1' });

    libraryData = {
      loadIngredients: vi.fn(),
      loadMeals: vi.fn(),
      setIngredientsSnapshot: vi.fn(),
      setMealsSnapshot: vi.fn()
    };

    supabase = createSupabaseClientStub();

    libraryData.loadIngredients.mockResolvedValue({
      ingredients: [ingredient, ingredientTwo],
      fetchedAt: '2026-03-19T00:00:00Z'
    });
    libraryData.loadMeals.mockResolvedValue({
      meals: [meal],
      mealItems,
      mealMacros: {
        'meal-1': { kcal: 120, protein: 22, carbs: 8, fat: 0 }
      },
      fetchedAt: '2026-03-19T00:00:00Z'
    });

    supabase.ingredientsInsertSingle.mockResolvedValue({
      data: { ...ingredient, id: 'ingredient-confirmed' },
      error: null
    });
    supabase.ingredientsDeleteEq.mockResolvedValue({ error: null });
    supabase.mealsInsertSingle.mockResolvedValue({
      data: { ...meal, id: 'meal-confirmed' },
      error: null
    });
    supabase.mealsDeleteEq.mockResolvedValue({ error: null });
    supabase.mealItemsDeleteEq.mockResolvedValue({ error: null });
    supabase.mealItemsInsert.mockResolvedValue({ error: null });

    TestBed.configureTestingModule({
      providers: [
        LibraryFacadeService,
        { provide: AuthService, useValue: { user: authUser } },
        { provide: LibraryDataService, useValue: libraryData as unknown as LibraryDataService },
        { provide: SupabaseService, useValue: { client: supabase.client } }
      ]
    });

    facade = TestBed.inject(LibraryFacadeService);
  });

  it('hydrates ingredients on init without loading meals', async () => {
    facade.init();
    await flushPromises();

    expect(libraryData.loadIngredients).toHaveBeenCalledTimes(1);
    expect(libraryData.loadMeals).not.toHaveBeenCalled();
    expect(facade.ingredientsLoaded()).toBe(true);
    expect(facade.mealsLoaded()).toBe(false);
  });

  it('loads meals lazily and reuses the hydrated state on later tab activations', async () => {
    await facade.activateTab('meals');
    await facade.activateTab('meals');

    expect(libraryData.loadMeals).toHaveBeenCalledTimes(1);
    expect(facade.mealsLoaded()).toBe(true);
  });

  it('preserves hydrated state across activate calls and resets when the user changes', async () => {
    await facade.activateTab('meals');
    libraryData.loadIngredients.mockClear();
    libraryData.loadMeals.mockClear();

    await facade.activate();

    expect(libraryData.loadIngredients).not.toHaveBeenCalled();
    expect(libraryData.loadMeals).not.toHaveBeenCalled();
    expect(facade.activeTab()).toBe('meals');

    authUser.set({ id: 'user-2' });
    facade.resetForUserChange();

    expect(facade.ingredientsLoaded()).toBe(false);
    expect(facade.mealsLoaded()).toBe(false);
    expect(facade.ingredients()).toEqual([]);
    expect(facade.meals()).toEqual([]);
    expect(facade.activeTab()).toBe('ingredients');
  });

  it('ignores stale meal requests when a newer reload finishes first', async () => {
    const first = deferred<{
      meals: Meal[];
      mealItems: MealItem[];
      mealMacros: Record<string, { kcal: number; protein: number; carbs: number; fat: number }>;
      fetchedAt: string;
    }>();
    const second = deferred<{
      meals: Meal[];
      mealItems: MealItem[];
      mealMacros: Record<string, { kcal: number; protein: number; carbs: number; fat: number }>;
      fetchedAt: string;
    }>();

    libraryData.loadMeals
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const loadOne = facade.ensureMealsLoaded(true);
    const loadTwo = facade.ensureMealsLoaded(true);

    second.resolve({
      meals: [{ ...meal, id: 'meal-new', name: 'Newest' }],
      mealItems: [],
      mealMacros: { 'meal-new': { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
      fetchedAt: '2026-03-19T01:00:00Z'
    });
    first.resolve({
      meals: [{ ...meal, id: 'meal-old', name: 'Older' }],
      mealItems: [],
      mealMacros: { 'meal-old': { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
      fetchedAt: '2026-03-19T00:00:00Z'
    });

    await Promise.all([loadOne, loadTwo]);

    expect(facade.meals()).toEqual([{ ...meal, id: 'meal-new', name: 'Newest' }]);
  });

  it('patches ingredient state optimistically without a full reload', async () => {
    facade.ingredients.set([ingredient]);
    facade.ingredientsLoaded.set(true);
    facade.openCreateIngredient();
    facade.ingredientForm.patchValue({
      name: 'Whey',
      kcal_per_100: 400,
      protein_per_100: 80,
      carbs_per_100: 8,
      fat_per_100: 6
    });

    const save = facade.saveIngredient();

    expect(facade.ingredients()[0].id).toContain('temp-ingredient-');
    await save;

    expect(facade.ingredients()[0].id).toBe('ingredient-confirmed');
    expect(libraryData.loadIngredients).not.toHaveBeenCalled();
    expect(libraryData.loadMeals).not.toHaveBeenCalled();
  });

  it('patches meal state optimistically without a full reload', async () => {
    facade.ingredients.set([ingredient]);
    facade.ingredientsLoaded.set(true);
    facade.meals.set([meal]);
    facade.mealsLoaded.set(true);
    (facade as unknown as { allMealItems: { set: (items: MealItem[]) => void } }).allMealItems.set(mealItems);

    facade.editingMeal.set(null);
    facade.mealForm.controls.name.setValue('Protein Bowl');
    facade.mealItemsArray.at(0).patchValue({ ingredient_id: 'ingredient-1', grams: 250 });

    const save = facade.saveMeal();
    await Promise.resolve();

    expect(facade.meals()[0].id).toContain('temp-meal-');
    await save;

    expect(facade.meals()[0].id).toBe('meal-confirmed');
    expect(libraryData.loadMeals).not.toHaveBeenCalled();
  });

  it('restores the previous state when an ingredient save fails', async () => {
    facade.ingredients.set([ingredient]);
    facade.ingredientsLoaded.set(true);
    facade.openCreateIngredient();
    facade.ingredientForm.patchValue({
      name: 'Whey',
      kcal_per_100: 400,
      protein_per_100: 80,
      carbs_per_100: 8,
      fat_per_100: 6
    });
    supabase.ingredientsInsertSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('write failed')
    });

    const saved = await facade.saveIngredient();

    expect(saved).toBe(false);
    expect(facade.ingredients()).toEqual([ingredient]);
    expect(facade.errorMessage()).toContain('Zutat konnte nicht gespeichert werden');
  });
});
