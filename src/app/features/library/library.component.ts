import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, MealItem } from '../../core/types';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';

@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BottomSheetComponent],
  template: `
    <main class="page library-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Bibliothek</p>
        <h1>Zutaten & Mahlzeiten</h1>
        <p class="lead">Baue deine Komponenten einmal und logge täglich schneller.</p>
      </header>

      <section class="panel">
        <div class="segmented" role="tablist" aria-label="Bibliothek-Tabs">
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'ingredients'" [class.active]="activeTab() === 'ingredients'" (click)="activeTab.set('ingredients')">Zutaten</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'meals'" [class.active]="activeTab() === 'meals'" (click)="activeTab.set('meals')">Mahlzeiten</button>
          <span aria-hidden="true"></span>
        </div>

        @if (activeTab() === 'ingredients') {
          <div class="toolbar">
            <input type="search" [(ngModel)]="ingredientSearch" placeholder="Zutat suchen" aria-label="Zutaten suchen">
            <select [(ngModel)]="marketFilter" aria-label="Nach Markt filtern">
              <option value="">Alle Märkte</option>
              @for (market of marketSuggestions(); track market) {
                <option [value]="market">{{ market }}</option>
              }
            </select>
          </div>

          @if (loading()) {
            <div class="skeleton card"></div>
            <div class="skeleton card"></div>
          } @else {
            <div class="items-list">
              @for (item of filteredIngredients(); track item.id) {
                <article class="list-card ingredient-card">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <div class="sub">Quelle: {{ getSourceTypeLabel(item.source_type) }}</div>
                    @if (item.source_type === 'custom_product' && item.base_ingredient_id) {
                      <div class="sub">BLV-Basis: {{ getIngredientName(item.base_ingredient_id) }}</div>
                    }
                    <div class="sub">{{ item.kcal_per_100 }} kcal / 100g</div>
                    @if (item.cost_per_100 !== null && item.cost_per_100 !== undefined) {
                      <div class="sub">Kosten: {{ item.cost_per_100 }} / 100g</div>
                    }
                    @if (item.market_name) {
                      <div class="sub">Markt: {{ item.market_name }}</div>
                    }
                  </div>
                  <div class="actions">
                    <button type="button" class="action-btn ghost mini" (click)="openIngredientActions(item)">Mehr</button>
                  </div>
                </article>
              }
              @if (filteredIngredients().length === 0) {
                <p class="empty-state">Keine Zutaten passen zu deinen Filtern.</p>
              }
            </div>
          }
        }

        @if (activeTab() === 'meals') {
          @if (loading()) {
            <div class="skeleton card"></div>
            <div class="skeleton card"></div>
          } @else {
            <div class="items-list">
              @for (item of meals(); track item.id) {
                <article class="list-card meal-card">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <div class="sub">Geschätzte Kosten: {{ getMealCostLabel(item.id) }}</div>
                  </div>
                  <div class="actions">
                    <button type="button" class="action-btn ghost mini" (click)="openMealActions(item)">Mehr</button>
                  </div>
                </article>
              }
              @if (meals().length === 0) {
                <p class="empty-state">Noch keine Mahlzeiten. Erstelle eine aus Zutaten.</p>
              }
            </div>
          }
        }
      </section>

      <button
        class="app-fab"
        type="button"
        [attr.aria-label]="activeTab() === 'ingredients' ? 'Zutat hinzufügen' : 'Mahlzeit hinzufügen'"
        (click)="openCreateModal()"
      >
        +
      </button>
    </main>

    <app-bottom-sheet [open]="actionSheetOpen()" title="Aktionen" (closed)="closeActionSheet()">
      @if (actionSheetItemLabel()) {
        <article class="sheet-preview">
          <strong>{{ actionSheetItemLabel() }}</strong>
          <p class="sub">{{ actionSheetItemSubLabel() }}</p>
        </article>
      }
      <div class="action-sheet-list">
        <button type="button" class="action-btn ghost" (click)="editSelectedItem()">Bearbeiten</button>
        <button type="button" class="action-btn ghost mini danger" (click)="deleteSelectedItem()">Löschen</button>
      </div>
    </app-bottom-sheet>

    @if (showIngredientModal()) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Zutateneditor">
        <div class="modal-card">
          <h2 class="title-font">{{ editingIngredient() ? 'Zutat bearbeiten' : 'Zutat hinzufügen' }}</h2>
          <form (ngSubmit)="saveIngredient()" #ingForm="ngForm" class="stack-form">
            <label for="ing-source">Quelle</label>
            <select
              id="ing-source"
              [(ngModel)]="ingredientForm.source_type"
              name="source_type"
              (ngModelChange)="onIngredientSourceTypeChange()"
              required
            >
              <option value="manual">Manuell</option>
              <option value="custom_product">Konkretes Produkt</option>
              <option value="blv_generic">BLV generisch</option>
            </select>

            @if (ingredientForm.source_type === 'custom_product') {
              <label for="ing-base">BLV-Basiszutat</label>
              <select
                id="ing-base"
                [(ngModel)]="ingredientForm.base_ingredient_id"
                name="base_ingredient_id"
                [required]="ingredientForm.source_type === 'custom_product'"
              >
                <option [ngValue]="null">Bitte wählen</option>
                @for (item of baseIngredientOptions(); track item.id) {
                  <option [ngValue]="item.id">{{ item.name }}</option>
                }
              </select>
              <button type="button" class="action-btn ghost mini" (click)="copyNutritionFromBaseIngredient()">
                BLV-Werte übernehmen
              </button>
            }

            <label for="ing-name">Name</label>
            <input id="ing-name" type="text" [(ngModel)]="ingredientForm.name" name="name" required>

            <label for="ing-kcal">Kcal / 100g</label>
            <input id="ing-kcal" type="number" [(ngModel)]="ingredientForm.kcal_per_100" name="kcal" required>

            <label for="ing-cost">Kosten / 100g (optional)</label>
            <input id="ing-cost" type="number" [(ngModel)]="ingredientForm.cost_per_100" name="cost" min="0" step="0.01">

            <label for="ing-market">Markt (optional)</label>
            <input id="ing-market" type="text" [(ngModel)]="ingredientForm.market_name" name="market" list="market-suggestions">
            <datalist id="market-suggestions">
              @for (market of marketSuggestions(); track market) {
                <option [value]="market"></option>
              }
            </datalist>

            <label for="ing-protein">Protein / 100g</label>
            <input id="ing-protein" type="number" [(ngModel)]="ingredientForm.protein_per_100" name="protein" required>

            <label for="ing-carbs">Kohlenhydrate / 100g</label>
            <input id="ing-carbs" type="number" [(ngModel)]="ingredientForm.carbs_per_100" name="carbs" required>

            <label for="ing-fat">Fett / 100g</label>
            <input id="ing-fat" type="number" [(ngModel)]="ingredientForm.fat_per_100" name="fat" required>

            <label for="ing-brand">Marke (optional)</label>
            <input id="ing-brand" type="text" [(ngModel)]="ingredientForm.brand" name="brand">

            <div class="modal-actions">
              <button type="submit" class="action-btn" [disabled]="!ingForm.valid">Speichern</button>
              <button type="button" class="action-btn ghost" (click)="showIngredientModal.set(false)">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showMealModal()) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Mahlzeiteneditor">
        <div class="modal-card">
          <h2 class="title-font">{{ editingMeal() ? 'Mahlzeit bearbeiten' : 'Mahlzeit hinzufügen' }}</h2>
          <form (ngSubmit)="saveMeal()" #mealFormRef="ngForm" class="stack-form">
            <label for="meal-name">Mahlzeitenname</label>
            <input id="meal-name" type="text" [(ngModel)]="mealForm.name" name="name" required>

            <div class="meal-items">
              @for (item of mealItems; track $index) {
                <div class="meal-item">
                  <select [(ngModel)]="item.ingredient_id" [name]="'ing' + $index">
                    @for (ing of ingredients(); track ing.id) {
                      <option [value]="ing.id">{{ ing.name }}</option>
                    }
                  </select>
                  <input type="number" [(ngModel)]="item.grams" [name]="'grams' + $index" placeholder="Gramm">
                  <button type="button" class="action-btn ghost mini danger" (click)="removeMealItem($index)">Entfernen</button>
                </div>
              }
            </div>

            <p class="cost-preview">Geschätzte Mahlzeitenkosten: {{ draftMealCostLabel() }}</p>
            <button type="button" class="action-btn ghost" (click)="addMealItem()">+ Zutat hinzufügen</button>

            <div class="modal-actions">
              <button type="submit" class="action-btn" [disabled]="!mealFormRef.valid">Speichern</button>
              <button type="button" class="action-btn ghost" (click)="showMealModal.set(false)">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .library-page {
      gap: 0.75rem;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.7rem;
    }

    .lead {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .toolbar {
      margin-top: 0.7rem;
      display: grid;
      gap: 0.45rem;
      grid-template-columns: 1fr 132px;
    }

    .items-list {
      margin-top: 0.7rem;
      display: grid;
      gap: 0.5rem;
    }

    .sub {
      margin-top: 0.2rem;
      color: var(--ink-500);
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .ingredient-card,
    .meal-card {
      align-items: flex-start;
      gap: 0.6rem;
    }

    .actions {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }

    .mini {
      min-height: 40px;
      padding: 0.35rem 0.6rem;
      font-size: var(--text-xs);
    }

    .danger {
      border-color: var(--danger-500);
      color: #f0b1bf;
      background: #2a1720;
    }

    .stack-form {
      display: grid;
      gap: 0.55rem;
      margin-top: 0.7rem;
    }

    .stack-form label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }

    .meal-items {
      display: grid;
      gap: 0.5rem;
    }

    .cost-preview {
      margin: 0.1rem 0 0;
      font-weight: 800;
      color: var(--ink-700);
    }

    .meal-item {
      display: grid;
      grid-template-columns: 1fr 92px auto;
      gap: 0.45rem;
      align-items: center;
    }

    .modal-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.3rem;
    }

    .modal-actions button {
      flex: 1;
    }

    .sheet-preview {
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      background: #0f1115;
      padding: 0.7rem 0.75rem;
      display: grid;
      gap: 0.3rem;
    }

    .sheet-preview strong {
      font-size: 1rem;
      color: var(--ink-900);
    }

    .action-sheet-list {
      margin-top: 0.6rem;
      display: grid;
      gap: 0.5rem;
    }

    .action-sheet-list .action-btn {
      width: 100%;
      justify-content: center;
    }
  `]
})
export class LibraryComponent implements OnInit {
  activeTab = signal<'ingredients' | 'meals'>('ingredients');
  ingredients = signal<Ingredient[]>([]);
  meals = signal<Meal[]>([]);
  showIngredientModal = signal(false);
  showMealModal = signal(false);
  editingIngredient = signal<Ingredient | null>(null);
  editingMeal = signal<Meal | null>(null);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  selectedIngredientForActions = signal<Ingredient | null>(null);
  selectedMealForActions = signal<Meal | null>(null);
  actionSheetOpen = signal(false);

  ingredientSearch = '';
  marketFilter = '';

  ingredientForm = {
    source_type: 'manual' as 'manual' | 'blv_generic' | 'custom_product',
    base_ingredient_id: null as string | null,
    name: '',
    kcal_per_100: 0,
    cost_per_100: null as number | null,
    market_name: '',
    protein_per_100: 0,
    carbs_per_100: 0,
    fat_per_100: 0,
    brand: ''
  };

  mealForm = { name: '' };
  mealItems: { ingredient_id: string; grams: number }[] = [];
  mealCosts = signal<Record<string, number>>({});
  private readonly allMealItems = signal<MealItem[]>([]);

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly libraryDataService = inject(LibraryDataService);

  marketSuggestions = computed(() => {
    const markets = this.ingredients()
      .map(ingredient => ingredient.market_name?.trim() || '')
      .filter(market => market.length > 0);

    return Array.from(new Set(markets)).sort((a, b) => a.localeCompare(b));
  });

  filteredIngredients = computed(() => {
    const query = this.ingredientSearch.trim().toLowerCase();
    const market = this.marketFilter.trim().toLowerCase();

    return this.ingredients().filter(item => {
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      const matchesMarket = !market || (item.market_name || '').toLowerCase() === market;
      return matchesQuery && matchesMarket;
    });
  });

  baseIngredientOptions = computed(() =>
    this.ingredients()
      .filter(ingredient => ingredient.source_type === 'blv_generic')
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  ngOnInit() {
    void this.loadData();
  }

  async loadData(forceRefresh = false) {
    const user = this.authService.user();
    if (!user) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const snapshot = await this.libraryDataService.loadLibrary(user.id, {
        forceRefresh,
        allowStaleOnError: true
      });

      this.ingredients.set(snapshot.ingredients);
      this.meals.set(snapshot.meals);
      this.allMealItems.set(snapshot.mealItems);
      this.mealCosts.set(this.buildMealCosts(snapshot.meals, snapshot.mealItems, snapshot.ingredients));
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Bibliothek konnte nicht geladen werden'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateModal() {
    if (this.activeTab() === 'ingredients') {
      this.showIngredientModal.set(true);
      return;
    }

    this.showMealModal.set(true);
  }

  editIngredient(ingredient: Ingredient) {
    this.editingIngredient.set(ingredient);
    this.ingredientForm = {
      source_type: ingredient.source_type || 'manual',
      base_ingredient_id: ingredient.base_ingredient_id ?? null,
      name: ingredient.name,
      kcal_per_100: ingredient.kcal_per_100,
      cost_per_100: ingredient.cost_per_100 ?? null,
      market_name: ingredient.market_name || '',
      protein_per_100: ingredient.protein_per_100,
      carbs_per_100: ingredient.carbs_per_100,
      fat_per_100: ingredient.fat_per_100,
      brand: ingredient.brand || ''
    };
    this.showIngredientModal.set(true);
  }

  async saveIngredient() {
    const user = this.authService.user();
    if (!user) return;

    const marketName = this.ingredientForm.market_name.trim();
    const normalizedCost =
      this.ingredientForm.cost_per_100 === null || this.ingredientForm.cost_per_100 === undefined
        ? null
        : Number(this.ingredientForm.cost_per_100);
    const normalizedBaseIngredientId =
      this.ingredientForm.source_type === 'custom_product' ? this.ingredientForm.base_ingredient_id : null;

    const payload = {
      ...this.ingredientForm,
      cost_per_100: Number.isFinite(normalizedCost) ? normalizedCost : null,
      market_name: marketName || null,
      base_ingredient_id: normalizedBaseIngredientId
    };

    try {
      if (this.editingIngredient()) {
        const { error } = await this.supabaseService.client
          .from('ingredients')
          .update(payload)
          .eq('id', this.editingIngredient()!.id);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await this.supabaseService.client
          .from('ingredients')
          .insert({ ...payload, owner_id: user.id });
        if (error) {
          throw error;
        }
      }

      this.showIngredientModal.set(false);
      this.editingIngredient.set(null);
      this.ingredientForm = {
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
      };

      this.libraryDataService.invalidate(user.id);
      await this.loadData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Zutat konnte nicht gespeichert werden'));
    }
  }

  async deleteIngredient(ingredient: Ingredient) {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { error } = await this.supabaseService.client
      .from('ingredients')
      .delete()
      .eq('id', ingredient.id)
      .eq('owner_id', user.id);

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Zutat konnte nicht gelöscht werden'));
      return;
    }

    this.libraryDataService.invalidate(user.id);
    await this.loadData(true);
  }

  editMeal(meal: Meal) {
    this.editingMeal.set(meal);
    this.mealForm.name = meal.name;
    void this.loadMealItems(meal.id);
    this.showMealModal.set(true);
  }

  async loadMealItems(mealId: string) {
    this.mealItems = this.allMealItems()
      .filter(item => item.meal_id === mealId)
      .map(item => ({ ingredient_id: item.ingredient_id, grams: Number(item.grams) }));
  }

  addMealItem() {
    this.mealItems.push({ ingredient_id: '', grams: 0 });
  }

  removeMealItem(index: number) {
    this.mealItems.splice(index, 1);
  }

  draftMealCostLabel() {
    const cost = this.mealItems.reduce((total, item) => {
      const ingredient = this.ingredients().find(entry => entry.id === item.ingredient_id);
      const costPer100 = Number(ingredient?.cost_per_100 || 0);
      return total + (Number(item.grams) / 100) * costPer100;
    }, 0);

    return this.formatCurrency(cost);
  }

  async saveMeal() {
    const user = this.authService.user();
    if (!user) return;

    try {
      let mealId: string;
      if (this.editingMeal()) {
        const { error } = await this.supabaseService.client
          .from('meals')
          .update({ name: this.mealForm.name.trim() })
          .eq('id', this.editingMeal()!.id)
          .eq('owner_id', user.id);

        if (error) {
          throw error;
        }
        mealId = this.editingMeal()!.id;
      } else {
        const { data, error } = await this.supabaseService.client
          .from('meals')
          .insert({ name: this.mealForm.name.trim(), owner_id: user.id })
          .select('id')
          .single();

        if (error || !data) {
          throw error || new Error('Mahlzeit konnte nicht erstellt werden');
        }
        mealId = data.id;
      }

      const { error: deleteMealItemsError } = await this.supabaseService.client
        .from('meal_items')
        .delete()
        .eq('meal_id', mealId);

      if (deleteMealItemsError) {
        throw deleteMealItemsError;
      }

      const itemsToInsert = this.mealItems
        .filter(item => Boolean(item.ingredient_id) && Number(item.grams) > 0)
        .map(item => ({
          meal_id: mealId,
          ingredient_id: item.ingredient_id,
          grams: Number(item.grams)
        }));

      if (itemsToInsert.length > 0) {
        const { error: insertMealItemsError } = await this.supabaseService.client
          .from('meal_items')
          .insert(itemsToInsert);

        if (insertMealItemsError) {
          throw insertMealItemsError;
        }
      }

      this.showMealModal.set(false);
      this.editingMeal.set(null);
      this.mealForm = { name: '' };
      this.mealItems = [];

      this.libraryDataService.invalidate(user.id);
      await this.loadData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Mahlzeit konnte nicht gespeichert werden'));
    }
  }

  async deleteMeal(meal: Meal) {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { error } = await this.supabaseService.client
      .from('meals')
      .delete()
      .eq('id', meal.id)
      .eq('owner_id', user.id);

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Mahlzeit konnte nicht gelöscht werden'));
      return;
    }

    this.libraryDataService.invalidate(user.id);
    await this.loadData(true);
  }

  getMealCostLabel(mealId: string) {
    return this.formatCurrency(this.mealCosts()[mealId] || 0);
  }

  getIngredientName(ingredientId: string) {
    const ingredient = this.ingredients().find(entry => entry.id === ingredientId);
    return ingredient?.name || 'Unbekannt';
  }

  getSourceTypeLabel(sourceType?: Ingredient['source_type']) {
    if (sourceType === 'blv_generic') return 'BLV generisch';
    if (sourceType === 'custom_product') return 'Konkretes Produkt';
    return 'Manuell';
  }

  onIngredientSourceTypeChange() {
    if (this.ingredientForm.source_type !== 'custom_product') {
      this.ingredientForm.base_ingredient_id = null;
    }
  }

  copyNutritionFromBaseIngredient() {
    if (!this.ingredientForm.base_ingredient_id) return;
    const baseIngredient = this.ingredients().find(
      ingredient => ingredient.id === this.ingredientForm.base_ingredient_id
    );
    if (!baseIngredient) return;

    this.ingredientForm.kcal_per_100 = baseIngredient.kcal_per_100;
    this.ingredientForm.protein_per_100 = baseIngredient.protein_per_100;
    this.ingredientForm.carbs_per_100 = baseIngredient.carbs_per_100;
    this.ingredientForm.fat_per_100 = baseIngredient.fat_per_100;
  }

  private formatCurrency(value: number) {
    return `${value.toFixed(2)} €`;
  }

  openIngredientActions(ingredient: Ingredient): void {
    this.selectedIngredientForActions.set(ingredient);
    this.selectedMealForActions.set(null);
    this.actionSheetOpen.set(true);
  }

  openMealActions(meal: Meal): void {
    this.selectedMealForActions.set(meal);
    this.selectedIngredientForActions.set(null);
    this.actionSheetOpen.set(true);
  }

  closeActionSheet(): void {
    this.actionSheetOpen.set(false);
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
      return `${this.selectedIngredientForActions()!.kcal_per_100} kcal / 100g`;
    }
    if (this.selectedMealForActions()) {
      return `Geschätzte Kosten: ${this.getMealCostLabel(this.selectedMealForActions()!.id)}`;
    }
    return '';
  }

  editSelectedItem(): void {
    const ingredient = this.selectedIngredientForActions();
    if (ingredient) {
      this.closeActionSheet();
      this.editIngredient(ingredient);
      return;
    }

    const meal = this.selectedMealForActions();
    if (meal) {
      this.closeActionSheet();
      this.editMeal(meal);
    }
  }

  async deleteSelectedItem(): Promise<void> {
    const ingredient = this.selectedIngredientForActions();
    if (ingredient) {
      await this.deleteIngredient(ingredient);
      this.closeActionSheet();
      return;
    }

    const meal = this.selectedMealForActions();
    if (meal) {
      await this.deleteMeal(meal);
      this.closeActionSheet();
    }
  }

  private buildMealCosts(meals: Meal[], mealItems: MealItem[], ingredients: Ingredient[]): Record<string, number> {
    const ingredientCostMap = new Map(
      ingredients.map(ingredient => [ingredient.id, Number(ingredient.cost_per_100 || 0)])
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
}
