import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal } from '../../core/types';

@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
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
                    <div class="sub">{{ item.kcal_per_100 }} kcal / 100g</div>
                    @if (item.cost_per_100 !== null && item.cost_per_100 !== undefined) {
                      <div class="sub">Kosten: {{ item.cost_per_100 }} / 100g</div>
                    }
                    @if (item.market_name) {
                      <div class="sub">Markt: {{ item.market_name }}</div>
                    }
                  </div>
                  <div class="actions">
                    <button type="button" class="action-btn ghost mini" (click)="editIngredient(item)">Bearbeiten</button>
                    <button type="button" class="action-btn ghost mini danger" (click)="deleteIngredient(item)">Löschen</button>
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
                    <button type="button" class="action-btn ghost mini" (click)="editMeal(item)">Bearbeiten</button>
                    <button type="button" class="action-btn ghost mini danger" (click)="deleteMeal(item)">Löschen</button>
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

    @if (showIngredientModal()) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Zutateneditor">
        <div class="modal-card">
          <h2 class="title-font">{{ editingIngredient() ? 'Zutat bearbeiten' : 'Zutat hinzufügen' }}</h2>
          <form (ngSubmit)="saveIngredient()" #ingForm="ngForm" class="stack-form">
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

  ingredientSearch = '';
  marketFilter = '';

  ingredientForm = {
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

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

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

  ngOnInit() {
    void this.loadData();
  }

  async loadData() {
    const user = this.authService.user();
    if (!user) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { data: ingredientsData, error: ingredientError } = await this.supabaseService.client
      .from('ingredients')
      .select('*')
      .eq('owner_id', user.id);

    if (ingredientError) {
      this.errorMessage.set(ingredientError.message);
      this.loading.set(false);
      return;
    }

    this.ingredients.set((ingredientsData || []) as Ingredient[]);

    const { data: mealsData, error: mealsError } = await this.supabaseService.client
      .from('meals')
      .select('*')
      .eq('owner_id', user.id);

    if (mealsError) {
      this.errorMessage.set(mealsError.message);
      this.loading.set(false);
      return;
    }

    this.meals.set((mealsData || []) as Meal[]);

    const mealIds = (mealsData || []).map(meal => meal.id);
    if (mealIds.length === 0) {
      this.mealCosts.set({});
      this.loading.set(false);
      return;
    }

    const { data: mealItemsData } = await this.supabaseService.client
      .from('meal_items')
      .select('*')
      .in('meal_id', mealIds);

    const ingredientCostMap = new Map(
      this.ingredients().map(ingredient => [ingredient.id, Number(ingredient.cost_per_100 || 0)])
    );
    const costs: Record<string, number> = {};

    for (const meal of mealsData || []) {
      costs[meal.id] = 0;
    }

    for (const item of mealItemsData || []) {
      const unitCost = ingredientCostMap.get(item.ingredient_id) || 0;
      costs[item.meal_id] = (costs[item.meal_id] || 0) + (Number(item.grams) / 100) * unitCost;
    }

    for (const mealId of Object.keys(costs)) {
      costs[mealId] = Number(costs[mealId].toFixed(2));
    }

    this.mealCosts.set(costs);
    this.loading.set(false);
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
    const payload = {
      ...this.ingredientForm,
      cost_per_100: Number.isFinite(normalizedCost) ? normalizedCost : null,
      market_name: marketName || null
    };

    if (this.editingIngredient()) {
      await this.supabaseService.client
        .from('ingredients')
        .update(payload)
        .eq('id', this.editingIngredient()!.id);
    } else {
      await this.supabaseService.client
        .from('ingredients')
        .insert({ ...payload, owner_id: user.id });
    }

    this.showIngredientModal.set(false);
    this.editingIngredient.set(null);
    this.ingredientForm = {
      name: '',
      kcal_per_100: 0,
      cost_per_100: null,
      market_name: '',
      protein_per_100: 0,
      carbs_per_100: 0,
      fat_per_100: 0,
      brand: ''
    };

    await this.loadData();
  }

  async deleteIngredient(ingredient: Ingredient) {
    await this.supabaseService.client
      .from('ingredients')
      .delete()
      .eq('id', ingredient.id);

    await this.loadData();
  }

  editMeal(meal: Meal) {
    this.editingMeal.set(meal);
    this.mealForm.name = meal.name;
    void this.loadMealItems(meal.id);
    this.showMealModal.set(true);
  }

  async loadMealItems(mealId: string) {
    const { data } = await this.supabaseService.client
      .from('meal_items')
      .select('*')
      .eq('meal_id', mealId);

    this.mealItems = data || [];
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

    let mealId: string;
    if (this.editingMeal()) {
      await this.supabaseService.client
        .from('meals')
        .update(this.mealForm)
        .eq('id', this.editingMeal()!.id);
      mealId = this.editingMeal()!.id;
    } else {
      const { data } = await this.supabaseService.client
        .from('meals')
        .insert({ ...this.mealForm, owner_id: user.id })
        .select()
        .single();
      mealId = data.id;
    }

    await this.supabaseService.client
      .from('meal_items')
      .delete()
      .eq('meal_id', mealId);

    for (const item of this.mealItems) {
      await this.supabaseService.client
        .from('meal_items')
        .insert({ ...item, meal_id: mealId });
    }

    this.showMealModal.set(false);
    this.editingMeal.set(null);
    this.mealForm = { name: '' };
    this.mealItems = [];

    await this.loadData();
  }

  async deleteMeal(meal: Meal) {
    await this.supabaseService.client
      .from('meals')
      .delete()
      .eq('id', meal.id);

    await this.loadData();
  }

  getMealCostLabel(mealId: string) {
    return this.formatCurrency(this.mealCosts()[mealId] || 0);
  }

  private formatCurrency(value: number) {
    return `${value.toFixed(2)} €`;
  }
}
