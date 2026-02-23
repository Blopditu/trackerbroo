import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, MealItem } from '../../core/types';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="library-container">
      <h1>Library</h1>
      <div class="tabs">
        <button [class.active]="activeTab === 'ingredients'" (click)="activeTab = 'ingredients'">Ingredients</button>
        <button [class.active]="activeTab === 'meals'" (click)="activeTab = 'meals'">Meals</button>
      </div>

      @if (activeTab === 'ingredients') {
        <button class="add-btn" (click)="showIngredientModal = true">+ Add Ingredient</button>
        <div class="items-list">
          @for (item of ingredients(); track item.id) {
            <div class="item-card">
              <div>
                <strong>{{ item.name }}</strong>
                <div>{{ item.kcal_per_100 }} kcal/100g</div>
              </div>
              <button (click)="editIngredient(item)">Edit</button>
              <button (click)="deleteIngredient(item)">Delete</button>
            </div>
          }
        </div>
      }

      @if (activeTab === 'meals') {
        <button class="add-btn" (click)="showMealModal = true">+ Add Meal</button>
        <div class="items-list">
          @for (item of meals(); track item.id) {
            <div class="item-card">
              <div>
                <strong>{{ item.name }}</strong>
              </div>
              <button (click)="editMeal(item)">Edit</button>
              <button (click)="deleteMeal(item)">Delete</button>
            </div>
          }
        </div>
      }
    </div>

    <!-- Ingredient Modal -->
    @if (showIngredientModal) {
      <div class="modal">
        <div class="modal-content">
          <h2>{{ editingIngredient ? 'Edit' : 'Add' }} Ingredient</h2>
          <form (ngSubmit)="saveIngredient()" #ingForm="ngForm">
            <input type="text" [(ngModel)]="ingredientForm.name" name="name" placeholder="Name" required>
            <input type="number" [(ngModel)]="ingredientForm.kcal_per_100" name="kcal" placeholder="Kcal per 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.protein_per_100" name="protein" placeholder="Protein per 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.carbs_per_100" name="carbs" placeholder="Carbs per 100g" required>
            <input type="number" [(ngModel)]="ingredientForm.fat_per_100" name="fat" placeholder="Fat per 100g" required>
            <input type="text" [(ngModel)]="ingredientForm.brand" name="brand" placeholder="Brand (optional)">
            <button type="submit" [disabled]="!ingForm.valid">Save</button>
            <button type="button" (click)="showIngredientModal = false">Cancel</button>
          </form>
        </div>
      </div>
    }

    <!-- Meal Modal -->
    @if (showMealModal) {
      <div class="modal">
        <div class="modal-content">
          <h2>{{ editingMeal ? 'Edit' : 'Add' }} Meal</h2>
          <form (ngSubmit)="saveMeal()" #mealForm="ngForm">
            <input type="text" [(ngModel)]="mealForm.name" name="name" placeholder="Name" required>
            <div class="meal-items">
              @for (item of mealItems; track $index) {
                <div class="meal-item">
                  <select [(ngModel)]="item.ingredient_id" [name]="'ing' + $index">
                    @for (ing of ingredients(); track ing.id) {
                      <option [value]="ing.id">{{ ing.name }}</option>
                    }
                  </select>
                  <input type="number" [(ngModel)]="item.grams" [name]="'grams' + $index" placeholder="Grams">
                  <button type="button" (click)="removeMealItem($index)">Remove</button>
                </div>
              }
              <button type="button" (click)="addMealItem()">+ Add Ingredient</button>
            </div>
            <button type="submit" [disabled]="!mealForm.valid">Save</button>
            <button type="button" (click)="showMealModal = false">Cancel</button>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .library-container {
      padding: 1rem;
      max-width: 480px;
      margin: 0 auto;
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
    .add-btn {
      width: 100%;
      padding: 1rem;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 10px;
      margin-bottom: 1rem;
      cursor: pointer;
    }
    .items-list {
      margin-bottom: 2rem;
    }
    .item-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 0.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
    form {
      display: flex;
      flex-direction: column;
    }
    input, select {
      padding: 0.5rem;
      margin-bottom: 1rem;
      border: 1px solid #ccc;
      border-radius: 5px;
    }
    button {
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    button[type="submit"] {
      background: #007bff;
      color: white;
    }
    .meal-items {
      margin-bottom: 1rem;
    }
    .meal-item {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .meal-item select, .meal-item input {
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
    // Load meal items
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

    // Save meal items
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