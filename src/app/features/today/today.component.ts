import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, LogEntry, DailySummary } from '../../core/types';

@Component({
  selector: 'app-today',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page today-page">
      <header class="panel header-panel">
        <p class="title-font">Mission Log</p>
        <h1>Today</h1>
        <div class="orbs" role="list" aria-label="Macro summary">
          <div class="orb" role="listitem">
            <span class="label">Kcal</span>
            <strong>{{ summary()?.kcal || 0 }}</strong>
          </div>
          <div class="orb" role="listitem">
            <span class="label">Protein</span>
            <strong>{{ summary()?.protein || 0 }}g</strong>
          </div>
          <div class="orb" role="listitem">
            <span class="label">Carbs</span>
            <strong>{{ summary()?.carbs || 0 }}g</strong>
          </div>
          <div class="orb" role="listitem">
            <span class="label">Fat</span>
            <strong>{{ summary()?.fat || 0 }}g</strong>
          </div>
        </div>
      </header>

      <section class="panel">
        <button class="action-btn add-trigger" (click)="showAddModal = true" type="button">
          + Add New Entry
        </button>
      </section>

      <section class="panel">
        <div class="segmented" role="tablist" aria-label="Library filter">
          <button type="button" role="tab" [attr.aria-selected]="activeTab === 'favorites'" [class.active]="activeTab === 'favorites'" (click)="activeTab = 'favorites'">Favorites</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab === 'recent'" [class.active]="activeTab === 'recent'" (click)="activeTab = 'recent'">Recent</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab === 'search'" [class.active]="activeTab === 'search'" (click)="activeTab = 'search'">Search</button>
        </div>

        <div class="items-list">
          @for (item of displayedItems(); track item.id || item.name) {
            <button type="button" class="list-card quick-card" (click)="addItem(item)">
              <span>{{ item.name }}</span>
              <span class="mono-badge">Quick Add</span>
            </button>
          }
        </div>
      </section>

      <section class="panel">
        <div class="scroll-header title-font">Today's Entries</div>
        <div class="entries-list">
          @for (entry of entries(); track entry.id) {
            <article class="list-card entry-card">
              <div class="entry-main">
                <strong>{{ entry.entry_type === 'ingredient' ? getIngredientName(entry.ref_id) : getMealName(entry.ref_id) }}</strong>
                <span class="entry-sub">{{ entry.quantity }}{{ entry.entry_type === 'ingredient' ? 'g' : ' servings' }}</span>
              </div>
              <div class="entry-actions">
                <button type="button" class="mini-btn" (click)="editEntry(entry)">Edit</button>
                <button type="button" class="mini-btn danger" (click)="deleteEntry(entry)">Delete</button>
              </div>
            </article>
          }
          @if (entries().length === 0) {
            <p class="empty">No entries yet. Add your first meal.</p>
          }
        </div>
      </section>

      <button class="action-btn alt" type="button" (click)="repeatLast()">Repeat Last</button>
    </main>

    @if (showAddModal) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Add entry">
        <div class="modal-card">
          <h2 class="title-font">Add Entry</h2>
          <div class="segmented add-type" role="tablist" aria-label="Entry type">
            <button type="button" role="tab" [attr.aria-selected]="addTab === 'ingredient'" [class.active]="addTab === 'ingredient'" (click)="addTab = 'ingredient'">Ingredient</button>
            <button type="button" role="tab" [attr.aria-selected]="addTab === 'meal'" [class.active]="addTab === 'meal'" (click)="addTab = 'meal'">Meal</button>
            <span class="spacer" aria-hidden="true"></span>
          </div>

          @if (addTab === 'ingredient') {
            <label for="ingredient-select">Ingredient</label>
            <select id="ingredient-select" [(ngModel)]="selectedIngredientId">
              @for (ing of ingredients(); track ing.id) {
                <option [value]="ing.id">{{ ing.name }}</option>
              }
            </select>
            <label for="grams-input">Grams</label>
            <input id="grams-input" type="number" [(ngModel)]="grams" placeholder="Grams">
            <div class="presets" role="group" aria-label="Common gram values">
              @for (preset of [50, 100, 200]; track preset) {
                <button type="button" class="mini-btn" (click)="grams = preset">{{ preset }}g</button>
              }
            </div>
          }

          @if (addTab === 'meal') {
            <label for="meal-select">Meal</label>
            <select id="meal-select" [(ngModel)]="selectedMealId">
              @for (meal of meals(); track meal.id) {
                <option [value]="meal.id">{{ meal.name }}</option>
              }
            </select>
            <div class="servings" role="group" aria-label="Servings">
              <button type="button" class="mini-btn" (click)="decreaseServings()">-</button>
              <span>{{ servings }}</span>
              <button type="button" class="mini-btn" (click)="increaseServings()">+</button>
            </div>
          }

          <div class="modal-actions">
            <button type="button" class="action-btn" (click)="confirmAdd()">Add</button>
            <button type="button" class="action-btn ghost" (click)="showAddModal = false">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .today-page {
      display: grid;
      gap: 0.75rem;
    }

    .header-panel h1 {
      font-size: 2rem;
      margin-top: 0.2rem;
    }

    .orbs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      margin-top: 0.65rem;
    }

    .orb {
      border: 2px solid #2f1f15;
      border-radius: 999px;
      padding: 0.5rem;
      background: radial-gradient(circle at 30% 20%, #ffe9bf 0%, #f9bb54 100%);
      text-align: center;
      box-shadow: 0 3px 0 #2f1f15;
    }

    .label {
      display: block;
      font-size: 0.72rem;
      font-weight: 800;
      color: #4a2f1d;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .orb strong {
      display: block;
      margin-top: 0.15rem;
      font-size: 1rem;
    }

    .add-trigger {
      width: 100%;
      font-size: 1rem;
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
      background: linear-gradient(180deg, #fffaf0 0%, #f7e2b8 100%);
    }

    .entry-card {
      align-items: flex-start;
    }

    .entry-main {
      display: grid;
      gap: 0.25rem;
    }

    .entry-sub {
      font-size: 0.85rem;
      color: #5a4638;
      font-weight: 700;
    }

    .entry-actions {
      display: flex;
      gap: 0.4rem;
    }

    .mini-btn {
      border: 2px solid #2f1f15;
      border-radius: 999px;
      background: #ffe4b1;
      padding: 0.3rem 0.6rem;
      font-weight: 800;
      color: #321d11;
    }

    .mini-btn.danger {
      background: #f6c4b9;
      color: #6b1818;
    }

    .empty {
      margin: 0;
      text-align: center;
      color: #5c4433;
      font-weight: 700;
    }

    .add-type {
      margin: 0.7rem 0;
      grid-template-columns: repeat(2, 1fr) auto;
    }

    .spacer {
      width: 0;
    }

    label {
      margin-top: 0.35rem;
      display: block;
      font-weight: 800;
      color: #3f2b1d;
    }

    .presets {
      margin-top: 0.55rem;
      display: flex;
      gap: 0.45rem;
    }

    .servings {
      margin-top: 0.65rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      font-weight: 800;
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
  activeTab = 'favorites';
  showAddModal = false;
  addTab = 'ingredient';
  selectedIngredientId = '';
  selectedMealId = '';
  grams = 100;
  servings = 1;
  lastEntry: LogEntry | null = null;

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const user = this.authService.user();
    if (!user) return;

    const group = this.getActiveGroup();
    if (!group) return;

    const today = new Date().toISOString().split('T')[0];

    const { data: entriesData } = await this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today);

    this.entries.set(entriesData || []);

    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today)
      .single();

    this.summary.set(summaryData);

    const { data: ingredientsData } = await this.supabaseService.client
      .from('ingredients')
      .select('*')
      .eq('owner_id', user.id);

    this.ingredients.set(ingredientsData || []);

    const { data: mealsData } = await this.supabaseService.client
      .from('meals')
      .select('*')
      .eq('owner_id', user.id);

    this.meals.set(mealsData || []);
  }

  get displayedItems() {
    if (this.activeTab === 'favorites') {
      return signal([...this.ingredients(), ...this.meals()]);
    }
    return signal([]);
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
      const quantity = 1;
      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'meal',
          ref_id: item.id,
          quantity,
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        });
    }

    this.loadData();
  }

  async confirmAdd() {
    this.showAddModal = false;
    this.loadData();
  }

  async editEntry(entry: LogEntry) {
    console.log('Edit entry', entry.id);
  }

  async deleteEntry(entry: LogEntry) {
    await this.supabaseService.client
      .from('log_entries')
      .delete()
      .eq('id', entry.id);

    this.loadData();
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

    this.loadData();
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
