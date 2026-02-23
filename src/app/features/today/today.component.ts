import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, LogEntry, DailySummary } from '../../core/types';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="today-container">
      <div class="header">
        <h1>Today</h1>
        <div class="totals">
          <div class="macro">{{ summary()?.kcal || 0 }} kcal</div>
          <div class="macro">P: {{ summary()?.protein || 0 }}g</div>
          <div class="macro">C: {{ summary()?.carbs || 0 }}g</div>
          <div class="macro">F: {{ summary()?.fat || 0 }}g</div>
        </div>
      </div>

      <div class="add-section">
        <button class="big-add-btn" (click)="showAddModal = true">+ Add</button>
      </div>

      <div class="tabs">
        <button [class.active]="activeTab === 'favorites'" (click)="activeTab = 'favorites'">Favorites</button>
        <button [class.active]="activeTab === 'recent'" (click)="activeTab = 'recent'">Recent</button>
        <button [class.active]="activeTab === 'search'" (click)="activeTab = 'search'">Search</button>
      </div>

      <div class="items-list">
        @for (item of displayedItems(); track item.id || item.name) {
          <div class="item-card" (click)="addItem(item)">
            {{ item.name }}
          </div>
        }
      </div>

      <div class="entries-list">
        @for (entry of entries(); track entry.id) {
          <div class="entry-card">
            <span>{{ entry.entry_type === 'ingredient' ? getIngredientName(entry.ref_id) : getMealName(entry.ref_id) }}</span>
            <span>{{ entry.quantity }}{{ entry.entry_type === 'ingredient' ? 'g' : ' servings' }}</span>
            <button (click)="editEntry(entry)">Edit</button>
            <button (click)="deleteEntry(entry)">Delete</button>
          </div>
        }
      </div>

      <button class="repeat-btn" (click)="repeatLast()">Repeat Last</button>
    </div>

    <!-- Add Modal -->
    @if (showAddModal) {
      <div class="modal">
        <div class="modal-content">
          <h2>Add Entry</h2>
          <div class="add-tabs">
            <button [class.active]="addTab === 'ingredient'" (click)="addTab = 'ingredient'">Ingredient</button>
            <button [class.active]="addTab === 'meal'" (click)="addTab = 'meal'">Meal</button>
          </div>
          @if (addTab === 'ingredient') {
            <select [(ngModel)]="selectedIngredientId">
              @for (ing of ingredients(); track ing.id) {
                <option [value]="ing.id">{{ ing.name }}</option>
              }
            </select>
            <input type="number" [(ngModel)]="grams" placeholder="Grams">
            <div class="presets">
              @for (preset of [50, 100, 200]; track preset) {
                <button (click)="grams = preset">{{ preset }}g</button>
              }
            </div>
          }
          @if (addTab === 'meal') {
            <select [(ngModel)]="selectedMealId">
              @for (meal of meals(); track meal.id) {
                <option [value]="meal.id">{{ meal.name }}</option>
              }
            </select>
            <div class="servings">
              <button (click)="decreaseServings()">-</button>
              <span>{{ servings }}</span>
              <button (click)="increaseServings()">+</button>
            </div>
          }
          <button (click)="confirmAdd()">Add</button>
          <button (click)="showAddModal = false">Cancel</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .today-container {
      padding: 1rem;
      max-width: 480px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .totals {
      display: flex;
      justify-content: space-around;
      margin-top: 1rem;
    }
    .macro {
      font-weight: bold;
    }
    .big-add-btn {
      width: 100%;
      padding: 2rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 20px;
      font-size: 2rem;
      cursor: pointer;
    }
    .tabs {
      display: flex;
      margin-bottom: 1rem;
    }
    .tabs button {
      flex: 1;
      padding: 1rem;
      border: none;
      background: #f0f0f0;
      cursor: pointer;
    }
    .tabs button.active {
      background: #667eea;
      color: white;
    }
    .items-list {
      margin-bottom: 2rem;
    }
    .item-card {
      background: #f9f9f9;
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 0.5rem;
      cursor: pointer;
    }
    .entries-list {
      margin-bottom: 2rem;
    }
    .entry-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 0.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .repeat-btn {
      width: 100%;
      padding: 1rem;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    }
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .modal-content {
      background: white;
      padding: 2rem;
      border-radius: 20px;
      width: 90%;
      max-width: 400px;
    }
    .add-tabs {
      display: flex;
      margin-bottom: 1rem;
    }
    .add-tabs button {
      flex: 1;
      padding: 0.5rem;
      border: none;
      background: #f0f0f0;
      cursor: pointer;
    }
    .add-tabs button.active {
      background: #667eea;
      color: white;
    }
    select, input {
      width: 100%;
      padding: 0.5rem;
      margin-bottom: 1rem;
      border: 1px solid #ccc;
      border-radius: 5px;
    }
    .presets {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .presets button {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      background: white;
      border-radius: 5px;
      cursor: pointer;
    }
    .servings {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .servings button {
      padding: 0.5rem 1rem;
      border: 1px solid #ccc;
      background: white;
      border-radius: 5px;
      cursor: pointer;
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

    // Load entries
    const { data: entriesData } = await this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today);

    this.entries.set(entriesData || []);

    // Load summary
    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('group_id', group.id)
      .eq('day', today)
      .single();

    this.summary.set(summaryData);

    // Load ingredients and meals
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
      // For MVP, show all ingredients and meals
      return signal([...this.ingredients(), ...this.meals()]);
    }
    // Implement recent and search later
    return signal([]);
  }

  getActiveGroup() {
    const groupStr = localStorage.getItem('activeGroup');
    return groupStr ? JSON.parse(groupStr) : null;
  }

  async addItem(item: Ingredient | Meal) {
    // Quick add with default values
    const user = this.authService.user();
    if (!user) return;

    const group = this.getActiveGroup();
    if (!group) return;

    const today = new Date().toISOString().split('T')[0];

    if ('kcal_per_100' in item) {
      // Ingredient
      const quantity = 100; // default grams
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
      // Meal - need to calculate totals
      // For MVP, assume 1 serving
      const quantity = 1;
      // Calculate meal macros (would need meal_items join)
      // Placeholder
      await this.supabaseService.client
        .from('log_entries')
        .insert({
          owner_id: user.id,
          group_id: group.id,
          day: today,
          entry_type: 'meal',
          ref_id: item.id,
          quantity,
          kcal: 0, // calculate
          protein: 0,
          carbs: 0,
          fat: 0
        });
    }

    this.loadData();
  }

  async confirmAdd() {
    // Similar to addItem but with modal values
    this.showAddModal = false;
    this.loadData();
  }

  async editEntry(entry: LogEntry) {
    // Implement edit modal
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
    // Copy last entry with new timestamp
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