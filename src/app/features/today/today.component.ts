import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, LogEntry, DailySummary } from '../../core/types';

type QuickItem = Ingredient | Meal;

@Component({
  selector: 'app-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page today-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      <header class="panel halftone header-panel">
        <div class="head-row">
          <div>
            <p class="title-font">Today Log</p>
            <h1>Protein Mission</h1>
          </div>
          <div class="mascot" aria-hidden="true">◉</div>
        </div>

        <div class="manga-bubble mascot-bubble">{{ mascotMessage() }}</div>

        <div class="macro-grid" role="list" aria-label="Macro summary">
          <article class="macro-card" role="listitem">
            <span>Kcal</span>
            <strong>{{ summary()?.kcal || 0 }}</strong>
          </article>
          <article class="macro-card protein" role="listitem">
            <span>Protein</span>
            <strong>{{ summary()?.protein || 0 }}g</strong>
          </article>
          <article class="macro-card" role="listitem">
            <span>Carbs</span>
            <strong>{{ summary()?.carbs || 0 }}g</strong>
          </article>
          <article class="macro-card" role="listitem">
            <span>Fat</span>
            <strong>{{ summary()?.fat || 0 }}g</strong>
          </article>
        </div>
      </header>

      <section class="panel">
        <div class="segmented" role="tablist" aria-label="Quick list filter">
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'favorites'" [class.active]="activeTab() === 'favorites'" (click)="activeTab.set('favorites')">Favorites</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'recent'" [class.active]="activeTab() === 'recent'" (click)="activeTab.set('recent')">Recent</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'search'" [class.active]="activeTab() === 'search'" (click)="activeTab.set('search')">Search</button>
        </div>

        <input type="search" [(ngModel)]="quickSearch" placeholder="Search ingredients and meals" aria-label="Search entries">

        @if (loading()) {
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        } @else {
          <div class="items-list">
            @for (item of displayedItems(); track item.id) {
              <button type="button" class="list-card quick-card" (click)="addItem(item)">
                <span>{{ item.name }}</span>
                <span class="mono-badge">Quick Add</span>
              </button>
            }
            @if (displayedItems().length === 0) {
              <p class="empty-state">No quick items found.</p>
            }
          </div>
        }
      </section>

      <section class="panel">
        <div class="section-head">
          <div class="scroll-header">Today's Entries</div>
          <button type="button" class="action-btn ghost small" (click)="repeatLast()">Repeat Last</button>
        </div>

        @if (loading()) {
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        } @else {
          <div class="entries-list">
            @for (entry of entries(); track entry.id) {
              <article class="list-card entry-card">
                <div class="entry-main">
                  <strong>{{ entry.entry_type === 'ingredient' ? getIngredientName(entry.ref_id) : getMealName(entry.ref_id) }}</strong>
                  <span class="entry-sub">{{ entry.quantity }}{{ entry.entry_type === 'ingredient' ? 'g' : ' servings' }}</span>
                </div>
                <button type="button" class="delete-btn" (click)="deleteEntry(entry)" aria-label="Delete entry">Delete</button>
              </article>
            }
            @if (entries().length === 0) {
              <p class="empty-state">No entries yet. Tap + to add your first one.</p>
            }
          </div>
        }
      </section>

      <button class="app-fab" type="button" (click)="showAddModal.set(true)" aria-label="Add entry">+</button>
    </main>

    @if (showAddModal()) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Add entry">
        <div class="modal-card">
          <h2 class="title-font">Quick Add</h2>
          <div class="segmented add-type" role="tablist" aria-label="Entry type">
            <button type="button" role="tab" [attr.aria-selected]="addTab() === 'ingredient'" [class.active]="addTab() === 'ingredient'" (click)="addTab.set('ingredient')">Ingredient</button>
            <button type="button" role="tab" [attr.aria-selected]="addTab() === 'meal'" [class.active]="addTab() === 'meal'" (click)="addTab.set('meal')">Meal</button>
            <span aria-hidden="true"></span>
          </div>

          @if (addTab() === 'ingredient') {
            <label for="ingredient-select">Ingredient</label>
            <select id="ingredient-select" [(ngModel)]="selectedIngredientId" [disabled]="ingredients().length === 0">
              @if (ingredients().length === 0) {
                <option value="">No ingredients yet</option>
              } @else {
                @for (ing of ingredients(); track ing.id) {
                  <option [value]="ing.id">{{ ing.name }}</option>
                }
              }
            </select>

            <label for="grams-input">Grams</label>
            <input id="grams-input" type="number" [(ngModel)]="grams" placeholder="Grams">
            <div class="presets" role="group" aria-label="Common gram values">
              @for (preset of [50, 100, 150, 200]; track preset) {
                <button type="button" class="action-btn ghost preset-btn" (click)="grams = preset">{{ preset }}g</button>
              }
            </div>
          }

          @if (addTab() === 'meal') {
            <label for="meal-select">Meal</label>
            <select id="meal-select" [(ngModel)]="selectedMealId" [disabled]="meals().length === 0">
              @if (meals().length === 0) {
                <option value="">No meals yet</option>
              } @else {
                @for (meal of meals(); track meal.id) {
                  <option [value]="meal.id">{{ meal.name }}</option>
                }
              }
            </select>

            <div class="servings" role="group" aria-label="Servings">
              <button type="button" class="action-btn ghost" (click)="decreaseServings()">-</button>
              <span>{{ servings }}</span>
              <button type="button" class="action-btn ghost" (click)="increaseServings()">+</button>
            </div>
          }

          <div class="modal-actions">
            <button type="button" class="action-btn" (click)="confirmAdd()">Save Entry</button>
            <button type="button" class="action-btn ghost" (click)="showAddModal.set(false)">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .today-page {
      gap: 0.75rem;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.7rem;
    }

    .head-row {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.7rem;
    }

    .mascot-bubble {
      margin-top: 0.55rem;
    }

    .macro-grid {
      margin-top: 0.7rem;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }

    .macro-card {
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      background: var(--bg-surface-2);
      padding: 0.55rem;
      display: grid;
      gap: 0.15rem;
    }

    .macro-card span {
      font-size: var(--text-xs);
      color: var(--ink-500);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .macro-card strong {
      font-size: 1.15rem;
    }

    .macro-card.protein {
      background: var(--accent-soft);
      border-color: var(--accent-500);
    }

    .items-list,
    .entries-list {
      display: grid;
      gap: 0.5rem;
      margin-top: 0.7rem;
    }

    .quick-card {
      width: 100%;
      text-align: left;
      min-height: 52px;
    }

    .entry-card {
      align-items: flex-start;
      gap: 0.65rem;
    }

    .entry-main {
      display: grid;
      gap: 0.25rem;
    }

    .entry-sub {
      font-size: var(--text-sm);
      color: var(--ink-500);
      font-weight: 700;
    }

    .delete-btn {
      min-height: 44px;
      border: 1px solid var(--danger-500);
      border-radius: 999px;
      padding: 0 0.75rem;
      background: #2a1720;
      color: #f0b1bf;
      font-weight: 800;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .small {
      min-height: 40px;
      padding: 0.45rem 0.75rem;
      font-size: var(--text-xs);
    }

    label {
      margin-top: 0.35rem;
      display: block;
      font-weight: 700;
      color: var(--ink-700);
      font-size: var(--text-sm);
    }

    .presets {
      margin-top: 0.55rem;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.45rem;
    }

    .preset-btn {
      min-height: 40px;
      font-size: var(--text-xs);
      padding: 0.35rem;
    }

    .servings {
      margin-top: 0.65rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      font-weight: 800;
    }

    .servings button {
      min-width: 44px;
    }

    .modal-actions {
      margin-top: 0.95rem;
      display: flex;
      gap: 0.5rem;
    }

    .modal-actions button {
      flex: 1;
    }
  `]
})
export class TodayComponent implements OnInit {
  entries = signal<LogEntry[]>([]);
  summary = signal<DailySummary | null>(null);
  ingredients = signal<Ingredient[]>([]);
  meals = signal<Meal[]>([]);
  activeTab = signal<'favorites' | 'recent' | 'search'>('favorites');
  showAddModal = signal(false);
  addTab = signal<'ingredient' | 'meal'>('ingredient');
  quickSearch = '';
  selectedIngredientId = '';
  selectedMealId = '';
  grams = 100;
  servings = 1;
  lastEntry: LogEntry | null = null;
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  displayedItems = computed(() => {
    const query = this.quickSearch.trim().toLowerCase();
    let base: QuickItem[] = [];

    if (this.activeTab() === 'favorites') {
      base = [...this.ingredients(), ...this.meals()];
    } else if (this.activeTab() === 'recent') {
      const itemIds = this.entries().map(entry => entry.ref_id);
      const ingredients = this.ingredients().filter(ingredient => itemIds.includes(ingredient.id));
      const meals = this.meals().filter(meal => itemIds.includes(meal.id));
      base = [...ingredients, ...meals];
    } else {
      base = [...this.ingredients(), ...this.meals()];
    }

    if (!query) {
      return base.slice(0, 20);
    }

    return base.filter(item => item.name.toLowerCase().includes(query)).slice(0, 20);
  });

  mascotMessage = computed(() => {
    const protein = Number(this.summary()?.protein || 0);
    if (protein >= 120) {
      return 'Power mode: protein goal crushed.';
    }
    if (protein >= 80) {
      return 'Solid pace. One more high-protein meal.';
    }
    return 'Start strong: add your first protein source.';
  });

  ngOnInit() {
    void this.loadData();
  }

  async loadData() {
    const user = this.authService.user();
    if (!user) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { data: ingredientsData, error: ingredientsError } = await this.supabaseService.client
      .from('ingredients')
      .select('*')
      .eq('owner_id', user.id);

    if (ingredientsError) {
      this.errorMessage.set(ingredientsError.message);
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

    if (!this.selectedIngredientId || !this.ingredients().some(ingredient => ingredient.id === this.selectedIngredientId)) {
      this.selectedIngredientId = this.ingredients()[0]?.id || '';
    }

    if (!this.selectedMealId || !this.meals().some(meal => meal.id === this.selectedMealId)) {
      this.selectedMealId = this.meals()[0]?.id || '';
    }

    const group = this.getActiveGroup();
    if (!group) {
      this.entries.set([]);
      this.summary.set(null);
      this.loading.set(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: entriesData, error: entriesError } = await this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today);

    if (entriesError) {
      this.errorMessage.set(entriesError.message);
      this.loading.set(false);
      return;
    }

    const resolvedEntries = (entriesData || []) as LogEntry[];
    this.entries.set(resolvedEntries);
    this.lastEntry = resolvedEntries[0] || null;

    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today)
      .single();

    this.summary.set(summaryData);
    this.loading.set(false);
  }

  getActiveGroup() {
    const groupStr = localStorage.getItem('activeGroup');
    return groupStr ? JSON.parse(groupStr) : null;
  }

  async addItem(item: Ingredient | Meal) {
    const user = this.authService.user();
    if (!user) return;

    const group = this.getActiveGroup();
    if (!group) return;

    const today = new Date().toISOString().split('T')[0];

    if ('kcal_per_100' in item) {
      const quantity = 100;
      const factor = quantity / 100;
      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'ingredient',
          ref_id: item.id,
          quantity,
          kcal: item.kcal_per_100 * factor,
          protein: item.protein_per_100 * factor,
          carbs: item.carbs_per_100 * factor,
          fat: item.fat_per_100 * factor
        });
    } else {
      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'meal',
          ref_id: item.id,
          quantity: 1,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        });
    }

    await this.loadData();
  }

  async confirmAdd() {
    const user = this.authService.user();
    if (!user) {
      this.showAddModal.set(false);
      return;
    }

    const group = this.getActiveGroup();
    if (!group) {
      this.showAddModal.set(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (this.addTab() === 'ingredient') {
      const ingredient = this.ingredients().find(item => item.id === this.selectedIngredientId);
      if (!ingredient || this.grams <= 0) {
        this.showAddModal.set(false);
        return;
      }

      const factor = this.grams / 100;
      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'ingredient',
          ref_id: ingredient.id,
          quantity: this.grams,
          kcal: ingredient.kcal_per_100 * factor,
          protein: ingredient.protein_per_100 * factor,
          carbs: ingredient.carbs_per_100 * factor,
          fat: ingredient.fat_per_100 * factor
        });
    } else {
      const meal = this.meals().find(item => item.id === this.selectedMealId);
      if (!meal || this.servings <= 0) {
        this.showAddModal.set(false);
        return;
      }

      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'meal',
          ref_id: meal.id,
          quantity: this.servings,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        });
    }

    this.showAddModal.set(false);
    await this.loadData();
  }

  async deleteEntry(entry: LogEntry) {
    await this.supabaseService.client
      .from('log_entries')
      .delete()
      .eq('id', entry.id);

    await this.loadData();
  }

  async repeatLast() {
    if (!this.lastEntry) return;

    const user = this.authService.user();
    if (!user) return;

    const group = this.getActiveGroup();
    if (!group) return;

    const today = new Date().toISOString().split('T')[0];

    await this.supabaseService.client
      .from('log_entries')
      .insert({
        ...this.lastEntry,
        id: undefined,
        created_at: undefined,
        day: today
      });

    await this.loadData();
  }

  getIngredientName(id: string) {
    return this.ingredients().find(i => i.id === id)?.name || 'Unknown';
  }

  getMealName(id: string) {
    return this.meals().find(m => m.id === id)?.name || 'Unknown';
  }

  decreaseServings() {
    this.servings = Math.max(0.5, this.servings - 0.5);
  }

  increaseServings() {
    this.servings += 0.5;
  }
}
