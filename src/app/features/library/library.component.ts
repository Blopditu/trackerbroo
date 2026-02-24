import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal } from '../../core/types';

@Component({
  selector: 'app-library',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page library-page">
      <header class="panel">
        <p class="title-font">Academy Archive</p>
        <h1>Library</h1>
      </header>

      <section class="panel">
        <div class="segmented" role="tablist" aria-label="Library tabs">
          <button type="button" role="tab" [attr.aria-selected]="activeTab === 'ingredients'" [class.active]="activeTab === 'ingredients'" (click)="activeTab = 'ingredients'">Ingredients</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab === 'meals'" [class.active]="activeTab === 'meals'" (click)="activeTab = 'meals'">Meals</button>
          <span class="tab-spacer" aria-hidden="true"></span>
        </div>

        @if (activeTab === 'ingredients') {
          <button class="action-btn add" (click)="showIngredientModal = true" type="button">+ Add Ingredient</button>
          <div class="items-list">
            @for (item of ingredients(); track item.id) {
              <article class="list-card">
                <div>
                  <strong>{{ item.name }}</strong>
                  <div class="sub">{{ item.kcal_per_100 }} kcal / 100g</div>
                </div>
                <div class="actions">
                  <button type="button" class="mini-btn" (click)="editIngredient(item)">Edit</button>
                  <button type="button" class="mini-btn danger" (click)="deleteIngredient(item)">Delete</button>
                </div>
              </article>
            }
          </div>
        }

        @if (activeTab === 'meals') {
          <button class="action-btn add alt" (click)="showMealModal = true" type="button">+ Add Meal</button>
          <div class="items-list">
            @for (item of meals(); track item.id) {
              <article class="list-card">
                <div>
                  <strong>{{ item.name }}</strong>
                </div>
                <div class="actions">
                  <button type="button" class="mini-btn" (click)="editMeal(item)">Edit</button>
                  <button type="button" class="mini-btn danger" (click)="deleteMeal(item)">Delete</button>
                </div>
              </article>
            }
          </div>
        }
      </section>
    </main>

    @if (showIngredientModal) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Ingredient editor">
        <div class="modal-card">
          <h2 class="title-font">{{ editingIngredient ? 'Edit' : 'Add' }} Ingredient</h2>
          <form (ngSubmit)="saveIngredient()" #ingForm="ngForm" class="stack-form">
            <input type="text" [(ngModel)]="ingredientForm.name" name="name" placeholder="Name" required>
            <input type="number" [(ngModel)]="ingredientForm.kcal_per_100" name="kcal" placeholder="Kcal / 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.protein_per_100" name="protein" placeholder="Protein / 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.carbs_per_100" name="carbs" placeholder="Carbs / 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.fat_per_100" name="fat" placeholder="Fat / 100g" required>
            <input type="text" [(ngModel)]="ingredientForm.brand" name="brand" placeholder="Brand (optional)">
            <div class="modal-actions">
              <button type="submit" class="action-btn" [disabled]="!ingForm.valid">Save</button>
              <button type="button" class="action-btn ghost" (click)="showIngredientModal = false">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showMealModal) {
      <div class="modal" role="dialog" aria-modal="true" aria-label="Meal editor">
        <div class="modal-card">
          <h2 class="title-font">{{ editingMeal ? 'Edit' : 'Add' }} Meal</h2>
          <form (ngSubmit)="saveMeal()" #mealFormRef="ngForm" class="stack-form">
            <input type="text" [(ngModel)]="mealForm.name" name="name" placeholder="Meal name" required>
            <div class="meal-items">
              @for (item of mealItems; track $index) {
                <div class="meal-item">
                  <select [(ngModel)]="item.ingredient_id" [name]="'ing' + $index">
                    @for (ing of ingredients(); track ing.id) {
                      <option [value]="ing.id">{{ ing.name }}</option>
                    }
                  </select>
                  <input type="number" [(ngModel)]="item.grams" [name]="'grams' + $index" placeholder="Grams">
                  <button type="button" class="mini-btn danger" (click)="removeMealItem($index)">Remove</button>
                </div>
              }
            </div>
            <button type="button" class="action-btn ghost" (click)="addMealItem()">+ Add Ingredient</button>
            <div class="modal-actions">
              <button type="submit" class="action-btn" [disabled]="!mealFormRef.valid">Save</button>
              <button type="button" class="action-btn ghost" (click)="showMealModal = false">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .library-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      font-size: 2rem;
      margin-top: 0.2rem;
    }

    .segmented {
      grid-template-columns: repeat(2, 1fr) auto;
    }

    .tab-spacer {
      width: 0;
    }

    .add {
      width: 100%;
      margin-top: 0.7rem;
    }

    .items-list {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.5rem;
    }

    .sub {
      margin-top: 0.2rem;
      color: #5e4935;
      font-weight: 700;
      font-size: 0.88rem;
    }

    .actions {
      display: flex;
      gap: 0.35rem;
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

    .stack-form {
      display: grid;
      gap: 0.55rem;
      margin-top: 0.7rem;
    }

    .meal-items {
      display: grid;
      gap: 0.5rem;
    }

    .meal-item {
      display: grid;
      grid-template-columns: 1fr 100px auto;
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
  activeTab = 'ingredients';
  ingredients = signal<Ingredient[]>([]);
  meals = signal<Meal[]>([]);
  showIngredientModal = false;
  showMealModal = false;
  editingIngredient: Ingredient | null = null;
  editingMeal: Meal | null = null;
  ingredientForm = {
    name: '',
    kcal_per_100: 0,
    protein_per_100: 0,
    carbs_per_100: 0,
    fat_per_100: 0,
    brand: ''
  };
  mealForm = {
    name: ''
  };
  mealItems: { ingredient_id: string; grams: number }[] = [];

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const user = this.authService.user();
    if (!user) return;

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

  editIngredient(ingredient: Ingredient) {
    this.editingIngredient = ingredient;
    this.ingredientForm = {
      name: ingredient.name,
      kcal_per_100: ingredient.kcal_per_100,
      protein_per_100: ingredient.protein_per_100,
      carbs_per_100: ingredient.carbs_per_100,
      fat_per_100: ingredient.fat_per_100,
      brand: ingredient.brand || ''
    };
    this.showIngredientModal = true;
  }

  async saveIngredient() {
    const user = this.authService.user();
    if (!user) return;

    if (this.editingIngredient) {
      await this.supabaseService.client
        .from('ingredients')
        .update(this.ingredientForm)
        .eq('id', this.editingIngredient.id);
    } else {
      await this.supabaseService.client
        .from('ingredients')
        .insert({ ...this.ingredientForm, owner_id: user.id });
    }

    this.showIngredientModal = false;
    this.editingIngredient = null;
    this.ingredientForm = {
      name: '',
      kcal_per_100: 0,
      protein_per_100: 0,
      carbs_per_100: 0,
      fat_per_100: 0,
      brand: ''
    };
    this.loadData();
  }

  async deleteIngredient(ingredient: Ingredient) {
    await this.supabaseService.client
      .from('ingredients')
      .delete()
      .eq('id', ingredient.id);

    this.loadData();
  }

  editMeal(meal: Meal) {
    this.editingMeal = meal;
    this.mealForm.name = meal.name;
    this.loadMealItems(meal.id);
    this.showMealModal = true;
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

  async saveMeal() {
    const user = this.authService.user();
    if (!user) return;

    let mealId: string;
    if (this.editingMeal) {
      await this.supabaseService.client
        .from('meals')
        .update(this.mealForm)
        .eq('id', this.editingMeal.id);
      mealId = this.editingMeal.id;
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

    this.showMealModal = false;
    this.editingMeal = null;
    this.mealForm = { name: '' };
    this.mealItems = [];
    this.loadData();
  }

  async deleteMeal(meal: Meal) {
    await this.supabaseService.client
      .from('meals')
      .delete()
      .eq('id', meal.id);

    this.loadData();
  }
}
