import { computed, inject, Injectable, signal } from '@angular/core';
import { FormArray, FormBuilder } from '@angular/forms';
import { LibraryDataService } from '../../core/library-data.service';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { formatAppError } from '../../core/error-format';
import { Ingredient, Meal, MealItem } from '../../core/types';
import {
  formatCurrency,
  LibraryMealListRow,
  roundKcal,
  sourceTypeLabel
} from './library-view-utils';
import { deriveLibraryMetrics, syncLibraryCaches as syncLibraryCachesToStore } from './library-cache-sync';
import {
  createIngredientForm,
  createMealForm,
  createMealItemGroup,
  IngredientFormGroup,
  MealFormGroup,
  MealItemFormGroup,
  replaceMealItems,
  resetIngredientFormForCreate,
  resetIngredientFormForEdit,
  resetMealFormForCreate,
  resetMealFormForEdit
} from './library-editor-form-factory';
import { parseMacroInput, roundOneDecimal } from './library-macro-parser';
import {
  buildIngredientMutationDraft,
  buildMealMutationDraft,
  createRollbackState,
  finalizeMealItems,
  LibraryRollbackState,
  remapMealItems
} from './library-optimistic-updates';

@Injectable()
export class LibraryFacadeService {
  readonly ingredients = signal<Ingredient[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly mealCosts = signal<Record<string, number>>({});
  readonly mealMacros = signal<Record<string, { kcal: number; protein: number; carbs: number; fat: number }>>({});
  readonly loadingIngredients = signal(false);
  readonly loadingMeals = signal(false);
  readonly ingredientsLoaded = signal(false);
  readonly mealsLoaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly ingredientSearch = signal('');
  readonly marketFilter = signal('');
  readonly macroPasteText = signal('');
  readonly macroPasteMessage = signal<string | null>(null);
  readonly ingredientDetailsExpanded = signal(false);
  readonly editingIngredient = signal<Ingredient | null>(null);
  readonly editingMeal = signal<Meal | null>(null);
  readonly selectedIngredientForActions = signal<Ingredient | null>(null);
  readonly selectedMealForActions = signal<Meal | null>(null);

  readonly ingredientForm: IngredientFormGroup;
  readonly mealForm: MealFormGroup;

  readonly marketSuggestions = computed(() => {
    const markets = this.ingredients()
      .map(ingredient => ingredient.market_name?.trim() || '')
      .filter(market => market.length > 0);

    return Array.from(new Set(markets)).sort((a, b) => a.localeCompare(b));
  });

  readonly filteredIngredients = computed(() => {
    const query = this.ingredientSearch().trim().toLowerCase();
    const market = this.marketFilter().trim().toLowerCase();

    return this.ingredients().filter(item => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      const matchesMarket = !market || (item.market_name || '').toLowerCase() === market;
      return matchesQuery && matchesMarket;
    });
  });

  readonly baseIngredientOptions = computed(() =>
    this.ingredients()
      .filter(ingredient => ingredient.source_type === 'blv_generic')
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  readonly mealListRows = computed<LibraryMealListRow[]>(() =>
    this.meals().map(meal => ({
      id: meal.id,
      name: meal.name,
      costLabel: formatCurrency(this.mealCosts()[meal.id] || 0),
      macros: this.mealMacros()[meal.id] || null
    }))
  );

  readonly draftMealCostLabel = computed(() => {
    const cost = this.mealItemsArray.controls.reduce((total, itemGroup) => {
      const ingredientId = itemGroup.controls.ingredient_id.value;
      const grams = Number(itemGroup.controls.grams.value || 0);
      const ingredient = this.ingredients().find(entry => entry.id === ingredientId);
      const costPer100 = Number(ingredient?.cost_per_100 || 0);
      return total + (grams / 100) * costPer100;
    }, 0);

    return formatCurrency(cost);
  });

  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly libraryDataService = inject(LibraryDataService);
  private readonly allMealItems = signal<MealItem[]>([]);
  private ingredientsRequestId = 0;
  private mealsRequestId = 0;

  constructor() {
    this.ingredientForm = createIngredientForm(this.formBuilder);
    this.mealForm = createMealForm(this.formBuilder);
  }

  init(): void {
    void this.ensureIngredientsLoaded();
  }

  get mealItemsArray(): FormArray<MealItemFormGroup> {
    return this.mealForm.controls.items;
  }

  async ensureIngredientsLoaded(forceRefresh = false): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }
    if (this.ingredientsLoaded() && !forceRefresh) {
      return;
    }

    const requestId = ++this.ingredientsRequestId;
    this.loadingIngredients.set(true);
    this.errorMessage.set(null);

    try {
      const snapshot = await this.libraryDataService.loadIngredients(user.id, {
        forceRefresh,
        allowStaleOnError: true
      });

      if (requestId !== this.ingredientsRequestId) {
        return;
      }

      this.ingredients.set(snapshot.ingredients);
      this.ingredientsLoaded.set(true);
      this.syncDerivedMealState();
    } catch (error: unknown) {
      if (requestId !== this.ingredientsRequestId) {
        return;
      }
      this.errorMessage.set(formatAppError(error, 'Zutaten konnten nicht geladen werden'));
    } finally {
      if (requestId === this.ingredientsRequestId) {
        this.loadingIngredients.set(false);
      }
    }
  }

  async ensureMealsLoaded(forceRefresh = false): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }
    if (this.mealsLoaded() && !forceRefresh) {
      return;
    }

    await this.ensureIngredientsLoaded(forceRefresh);
    const requestId = ++this.mealsRequestId;
    this.loadingMeals.set(true);
    this.errorMessage.set(null);

    try {
      const snapshot = await this.libraryDataService.loadMeals(user.id, {
        forceRefresh,
        allowStaleOnError: true
      });

      if (requestId !== this.mealsRequestId) {
        return;
      }

      this.applyMealsSnapshot(snapshot.meals, snapshot.mealItems);
      this.mealsLoaded.set(true);
    } catch (error: unknown) {
      if (requestId !== this.mealsRequestId) {
        return;
      }
      this.errorMessage.set(formatAppError(error, 'Mahlzeiten konnten nicht geladen werden'));
    } finally {
      if (requestId === this.mealsRequestId) {
        this.loadingMeals.set(false);
      }
    }
  }

  async activateTab(tab: 'ingredients' | 'meals'): Promise<void> {
    if (tab === 'meals') {
      await this.ensureMealsLoaded();
    } else {
      await this.ensureIngredientsLoaded();
    }
  }

  setIngredientSearch(value: string): void {
    this.ingredientSearch.set(value);
  }

  setMarketFilter(value: string): void {
    this.marketFilter.set(value);
  }

  resetFilters(): void {
    this.ingredientSearch.set('');
    this.marketFilter.set('');
  }

  openCreateIngredient(): void {
    this.editingIngredient.set(null);
    this.ingredientDetailsExpanded.set(false);
    this.macroPasteText.set('');
    this.macroPasteMessage.set(null);
    resetIngredientFormForCreate(this.ingredientForm);
  }

  openEditIngredient(ingredient: Ingredient): void {
    this.editingIngredient.set(ingredient);
    this.ingredientDetailsExpanded.set(Boolean(ingredient.cost_per_100 || ingredient.market_name || ingredient.brand));
    this.macroPasteText.set('');
    this.macroPasteMessage.set(null);
    resetIngredientFormForEdit(this.ingredientForm, ingredient);
  }

  async openCreateMeal(): Promise<void> {
    await this.ensureIngredientsLoaded();
    await this.ensureMealsLoaded();
    this.editingMeal.set(null);
    resetMealFormForCreate(this.formBuilder, this.mealForm);
  }

  async openEditMeal(meal: Meal): Promise<void> {
    await this.ensureIngredientsLoaded();
    await this.ensureMealsLoaded();
    this.editingMeal.set(meal);
    const existingItems = this.allMealItems()
      .filter(item => item.meal_id === meal.id)
      .map(item => ({ meal_id: item.meal_id, ingredient_id: item.ingredient_id, grams: Number(item.grams) }));
    resetMealFormForEdit(this.formBuilder, this.mealForm, meal.name, existingItems);
  }

  addMealItem(): void {
    this.mealItemsArray.push(createMealItemGroup(this.formBuilder, { ingredient_id: '', grams: 0 }));
  }

  removeMealItem(index: number): void {
    this.mealItemsArray.removeAt(index);
    if (this.mealItemsArray.length === 0) {
      this.addMealItem();
    }
  }

  toggleIngredientDetails(): void {
    this.ingredientDetailsExpanded.update(value => !value);
  }

  onIngredientSourceTypeChange(): void {
    if (this.ingredientForm.controls.source_type.value !== 'custom_product') {
      this.ingredientForm.controls.base_ingredient_id.setValue(null);
    }
  }

  copyNutritionFromBaseIngredient(): void {
    const baseIngredientId = this.ingredientForm.controls.base_ingredient_id.value;
    if (!baseIngredientId) {
      return;
    }

    const baseIngredient = this.ingredients().find(ingredient => ingredient.id === baseIngredientId);
    if (!baseIngredient) {
      return;
    }

    this.ingredientForm.patchValue({
      kcal_per_100: Number(baseIngredient.kcal_per_100),
      protein_per_100: Number(baseIngredient.protein_per_100),
      carbs_per_100: Number(baseIngredient.carbs_per_100),
      fat_per_100: Number(baseIngredient.fat_per_100)
    });
  }

  setMacroPasteText(value: string): void {
    this.macroPasteText.set(value);
  }

  applyMacroPaste(): void {
    const parsed = parseMacroInput(this.macroPasteText());
    if (!parsed) {
      this.macroPasteMessage.set('Keine Makros erkannt. Bitte Format wie "protein: 10.5" nutzen.');
      return;
    }

    if (parsed.protein !== undefined) {
      this.ingredientForm.controls.protein_per_100.setValue(roundOneDecimal(parsed.protein));
    }
    if (parsed.carbs !== undefined) {
      this.ingredientForm.controls.carbs_per_100.setValue(roundOneDecimal(parsed.carbs));
    }
    if (parsed.fat !== undefined) {
      this.ingredientForm.controls.fat_per_100.setValue(roundOneDecimal(parsed.fat));
    }

    if (parsed.kcal !== undefined) {
      this.ingredientForm.controls.kcal_per_100.setValue(roundKcal(parsed.kcal));
    } else {
      const protein = Number(this.ingredientForm.controls.protein_per_100.value || 0);
      const carbs = Number(this.ingredientForm.controls.carbs_per_100.value || 0);
      const fat = Number(this.ingredientForm.controls.fat_per_100.value || 0);
      this.ingredientForm.controls.kcal_per_100.setValue(roundKcal(protein * 4 + carbs * 4 + fat * 9));
    }

    this.macroPasteMessage.set(
      `Übernommen: ${this.ingredientForm.controls.kcal_per_100.value} kcal · P ${this.ingredientForm.controls.protein_per_100.value.toFixed(1)} · KH ${this.ingredientForm.controls.carbs_per_100.value.toFixed(1)} · F ${this.ingredientForm.controls.fat_per_100.value.toFixed(1)}`
    );
  }

  openIngredientActions(ingredient: Ingredient): void {
    this.selectedIngredientForActions.set(ingredient);
    this.selectedMealForActions.set(null);
  }

  openMealActions(meal: Meal): void {
    this.selectedMealForActions.set(meal);
    this.selectedIngredientForActions.set(null);
  }

  clearActionSelection(): void {
    this.selectedIngredientForActions.set(null);
    this.selectedMealForActions.set(null);
  }

  actionSheetItemLabel(): string {
    if (this.selectedIngredientForActions()) {
      return this.selectedIngredientForActions()!.name;
    }
    if (this.selectedMealForActions()) {
      return this.selectedMealForActions()!.name;
    }
    return '';
  }

  actionSheetItemSubLabel(): string {
    if (this.selectedIngredientForActions()) {
      return `${this.selectedIngredientForActions()!.kcal_per_100} kcal · ${sourceTypeLabel(this.selectedIngredientForActions()!.source_type)}`;
    }
    if (this.selectedMealForActions()) {
      return `Geschätzte Kosten: ${formatCurrency(this.mealCosts()[this.selectedMealForActions()!.id] || 0)}`;
    }
    return '';
  }

  editSelectedItem(): 'ingredient' | 'meal' | null {
    if (this.selectedIngredientForActions()) {
      this.openEditIngredient(this.selectedIngredientForActions()!);
      return 'ingredient';
    }

    if (this.selectedMealForActions()) {
      void this.openEditMeal(this.selectedMealForActions()!);
      return 'meal';
    }

    return null;
  }

  async deleteSelectedItem(): Promise<void> {
    if (this.selectedIngredientForActions()) {
      await this.deleteIngredient(this.selectedIngredientForActions()!);
      return;
    }

    if (this.selectedMealForActions()) {
      await this.deleteMeal(this.selectedMealForActions()!);
    }
  }

  async saveIngredient(): Promise<boolean> {
    const user = this.authService.user();
    if (!user || this.ingredientForm.invalid) {
      return false;
    }

    const previousState = this.createRollbackState();
    const editingIngredient = this.editingIngredient();
    const { payload, optimisticIngredient, nextIngredients } = buildIngredientMutationDraft(
      user.id,
      editingIngredient,
      this.ingredientForm,
      this.ingredients()
    );

    this.applyLocalLibraryState(nextIngredients, this.meals(), this.allMealItems());

    try {
      if (editingIngredient) {
        const { data, error } = await this.supabaseService.client
          .from('ingredients')
          .update(payload)
          .eq('id', editingIngredient.id)
          .eq('owner_id', user.id)
          .select('id,owner_id,name,source_type,blv_food_id,swissfir_id,category,reference_unit,source_dataset,base_ingredient_id,kcal_per_100,cost_per_100,market_name,protein_per_100,carbs_per_100,fat_per_100,brand,created_at')
          .single();

        if (error || !data) {
          throw error || new Error('Zutat konnte nicht gespeichert werden');
        }

        const confirmedIngredients = this.ingredients().map(item => (item.id === editingIngredient.id ? data as Ingredient : item));
        this.applyLocalLibraryState(confirmedIngredients, this.meals(), this.allMealItems());
      } else {
        const { data, error } = await this.supabaseService.client
          .from('ingredients')
          .insert({ ...payload, owner_id: user.id })
          .select('id,owner_id,name,source_type,blv_food_id,swissfir_id,category,reference_unit,source_dataset,base_ingredient_id,kcal_per_100,cost_per_100,market_name,protein_per_100,carbs_per_100,fat_per_100,brand,created_at')
          .single();

        if (error || !data) {
          throw error || new Error('Zutat konnte nicht erstellt werden');
        }

        const confirmedIngredients = this.ingredients().map(item =>
          item.id === optimisticIngredient.id ? data as Ingredient : item
        );
        this.applyLocalLibraryState(confirmedIngredients, this.meals(), this.allMealItems());
      }

      this.successMessage.set('Zutat gespeichert.');
      this.editingIngredient.set(null);
      return true;
    } catch (error: unknown) {
      this.restoreRollbackState(previousState);
      this.errorMessage.set(formatAppError(error, 'Zutat konnte nicht gespeichert werden'));
      return false;
    }
  }

  async deleteIngredient(ingredient: Ingredient): Promise<boolean> {
    const user = this.authService.user();
    if (!user) {
      return false;
    }

    const previousState = this.createRollbackState();
    const nextIngredients = this.ingredients().filter(item => item.id !== ingredient.id);
    this.applyLocalLibraryState(nextIngredients, this.meals(), this.allMealItems());

    try {
      const { error } = await this.supabaseService.client
        .from('ingredients')
        .delete()
        .eq('id', ingredient.id)
        .eq('owner_id', user.id);

      if (error) {
        throw error;
      }

      this.successMessage.set('Zutat gelöscht.');
      return true;
    } catch (error: unknown) {
      this.restoreRollbackState(previousState);
      this.errorMessage.set(formatAppError(error, 'Zutat konnte nicht gelöscht werden'));
      return false;
    }
  }

  async saveMeal(): Promise<boolean> {
    const user = this.authService.user();
    if (!user || this.mealForm.invalid) {
      return false;
    }

    await this.ensureMealsLoaded();
    const previousState = this.createRollbackState();
    const editingMeal = this.editingMeal();
    const { optimisticMealId, optimisticMeal, optimisticMeals, optimisticMealItems, filteredItems } = buildMealMutationDraft(
      user.id,
      editingMeal,
      this.mealForm,
      this.meals(),
      this.allMealItems()
    );

    this.applyLocalLibraryState(this.ingredients(), optimisticMeals, optimisticMealItems);

    try {
      let confirmedMealId = optimisticMealId;

      if (editingMeal) {
        const { error } = await this.supabaseService.client
          .from('meals')
          .update({ name: optimisticMeal.name })
          .eq('id', editingMeal.id)
          .eq('owner_id', user.id);

        if (error) {
          throw error;
        }
      } else {
        const { data, error } = await this.supabaseService.client
          .from('meals')
          .insert({ name: optimisticMeal.name, owner_id: user.id })
          .select('id,owner_id,name,created_at')
          .single();

        if (error || !data) {
          throw error || new Error('Mahlzeit konnte nicht erstellt werden');
        }

        confirmedMealId = data.id;
        const confirmedMeals = this.meals().map(item => (item.id === optimisticMealId ? data as Meal : item));
        const remappedItems = remapMealItems(this.allMealItems(), optimisticMealId, confirmedMealId);
        this.applyLocalLibraryState(this.ingredients(), confirmedMeals, remappedItems);
      }

      const { error: deleteMealItemsError } = await this.supabaseService.client
        .from('meal_items')
        .delete()
        .eq('meal_id', confirmedMealId);

      if (deleteMealItemsError) {
        throw deleteMealItemsError;
      }

      if (filteredItems.length > 0) {
        const { error: insertMealItemsError } = await this.supabaseService.client
          .from('meal_items')
          .insert(filteredItems.map(item => ({ meal_id: confirmedMealId, ingredient_id: item.ingredient_id, grams: item.grams })));

        if (insertMealItemsError) {
          throw insertMealItemsError;
        }
      }

      const finalItems = finalizeMealItems(this.allMealItems(), confirmedMealId, filteredItems);
      this.applyLocalLibraryState(this.ingredients(), this.meals(), finalItems);
      this.successMessage.set('Mahlzeit gespeichert.');
      this.editingMeal.set(null);
      return true;
    } catch (error: unknown) {
      this.restoreRollbackState(previousState);
      await this.ensureMealsLoaded(true);
      this.errorMessage.set(formatAppError(error, 'Mahlzeit konnte nicht gespeichert werden'));
      return false;
    }
  }

  async deleteMeal(meal: Meal): Promise<boolean> {
    const user = this.authService.user();
    if (!user) {
      return false;
    }

    const previousState = this.createRollbackState();
    const nextMeals = this.meals().filter(item => item.id !== meal.id);
    const nextMealItems = this.allMealItems().filter(item => item.meal_id !== meal.id);
    this.applyLocalLibraryState(this.ingredients(), nextMeals, nextMealItems);

    try {
      const { error } = await this.supabaseService.client
        .from('meals')
        .delete()
        .eq('id', meal.id)
        .eq('owner_id', user.id);

      if (error) {
        throw error;
      }

      this.successMessage.set('Mahlzeit gelöscht.');
      return true;
    } catch (error: unknown) {
      this.restoreRollbackState(previousState);
      this.errorMessage.set(formatAppError(error, 'Mahlzeit konnte nicht gelöscht werden'));
      return false;
    }
  }

  clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  formatMacroValue(value: number): string {
    return Number(value).toFixed(1);
  }

  sourceTypeLabel(sourceType?: Ingredient['source_type']): string {
    return sourceTypeLabel(sourceType);
  }

  clearEditingIngredient(): void {
    this.editingIngredient.set(null);
    this.macroPasteText.set('');
    this.macroPasteMessage.set(null);
  }

  clearEditingMeal(): void {
    this.editingMeal.set(null);
  }

  private applyLocalLibraryState(ingredients: Ingredient[], meals: Meal[], mealItems: MealItem[]): void {
    this.ingredients.set(ingredients);
    this.meals.set(meals);
    this.allMealItems.set(mealItems);
    this.syncDerivedMealState();
    this.syncCaches();
  }

  private syncDerivedMealState(): void {
    const metrics = deriveLibraryMetrics(this.ingredients(), this.meals(), this.allMealItems());
    this.mealMacros.set(metrics.mealMacros);
    this.mealCosts.set(metrics.mealCosts);
  }

  private syncCaches(): void {
    syncLibraryCachesToStore({
      libraryDataService: this.libraryDataService,
      userId: this.authService.user()?.id ?? null,
      ingredientsLoaded: this.ingredientsLoaded(),
      mealsLoaded: this.mealsLoaded(),
      ingredients: this.ingredients(),
      meals: this.meals(),
      mealItems: this.allMealItems()
    });
  }

  private createRollbackState(): LibraryRollbackState {
    return createRollbackState({
      ingredients: this.ingredients(),
      meals: this.meals(),
      mealItems: this.allMealItems(),
      ingredientsLoaded: this.ingredientsLoaded(),
      mealsLoaded: this.mealsLoaded()
    });
  }

  private restoreRollbackState(state: LibraryRollbackState): void {
    this.ingredientsLoaded.set(state.ingredientsLoaded);
    this.mealsLoaded.set(state.mealsLoaded);
    this.applyLocalLibraryState(state.ingredients, state.meals, state.mealItems);
  }

  private applyMealsSnapshot(meals: Meal[], mealItems: MealItem[]): void {
    this.meals.set(meals);
    this.allMealItems.set(mealItems);
    this.syncDerivedMealState();
    this.syncCaches();
  }
}
