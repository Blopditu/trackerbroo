import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Ingredient, Meal, MealItem } from '../../core/types';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';

interface ParsedMacroInput {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)'
  },
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    BottomSheetComponent
  ],
  template: `
    <main class="page library-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ successMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Bibliothek</p>
        <h1>Zutaten & Mahlzeiten</h1>
        <p class="lead">Baue deine Komponenten einmal und logge täglich schneller.</p>
      </header>

      <section class="panel">
        <div class="tab-toggle" role="tablist" aria-label="Bibliothek-Tabs">
          <button
            type="button"
            role="tab"
            class="tab-toggle-btn"
            [class.active]="activeTab() === 'ingredients'"
            [attr.aria-selected]="activeTab() === 'ingredients'"
            [attr.tabindex]="activeTab() === 'ingredients' ? 0 : -1"
            (click)="onTabChanged('ingredients')"
          >
            Zutaten
          </button>
          <button
            type="button"
            role="tab"
            class="tab-toggle-btn"
            [class.active]="activeTab() === 'meals'"
            [attr.aria-selected]="activeTab() === 'meals'"
            [attr.tabindex]="activeTab() === 'meals' ? 0 : -1"
            (click)="onTabChanged('meals')"
          >
            Mahlzeiten
          </button>
        </div>

        <div class="m3-section-head list-head">
          <span class="m3-section-meta">
            @if (activeTab() === 'ingredients') {
              {{ filteredIngredients().length }} Zutaten
            } @else {
              {{ meals().length }} Mahlzeiten
            }
          </span>
          <button mat-flat-button type="button" class="action-btn tonal compact" (click)="openCreateModal()">Neu</button>
        </div>

        @if (activeTab() === 'ingredients') {
          <div class="toolbar">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Zutat suchen</mat-label>
              <input matInput type="search" [(ngModel)]="ingredientSearch" placeholder="Zutat suchen" aria-label="Zutaten suchen">
            </mat-form-field>
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Markt</mat-label>
              <mat-select [(ngModel)]="marketFilter" aria-label="Nach Markt filtern">
                <mat-option value="">Alle Märkte</mat-option>
                @for (market of marketSuggestions(); track market) {
                  <mat-option [value]="market">{{ market }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
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
                    <button mat-flat-button type="button" class="action-btn tonal compact" (click)="logIngredientToday(item)">Loggen</button>
                    <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openIngredientActions(item)">Verwalten</button>
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
                    <button mat-flat-button type="button" class="action-btn tonal compact" (click)="logMealToday(item)">Loggen</button>
                    <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openMealActions(item)">Verwalten</button>
                  </div>
                </article>
              }
              @if (meals().length === 0) {
                <p class="empty-state">Noch keine Mahlzeiten. Lege deine erste Mahlzeit an, damit du später schneller loggen kannst.</p>
              }
            </div>
          }
        }
      </section>

      <button
        mat-fab
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
        <button mat-flat-button type="button" class="action-btn" (click)="logSelectedItemToday()">Heute loggen</button>
        <button mat-flat-button type="button" class="action-btn tonal" (click)="editSelectedItem()">Bearbeiten</button>
        <button mat-flat-button type="button" class="action-btn danger" (click)="deleteSelectedItem()">Löschen</button>
      </div>
    </app-bottom-sheet>

    @if (showIngredientModal()) {
      <div class="modal" role="presentation" (click)="onModalBackdropClick($event, 'ingredient')">
        <div
          #ingredientDialog
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingredient-modal-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <h2 id="ingredient-modal-title" class="title-font">{{ editingIngredient() ? 'Zutat bearbeiten' : 'Zutat hinzufügen' }}</h2>
          <form (ngSubmit)="saveIngredient()" #ingForm="ngForm" class="stack-form">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Quelle</mat-label>
              <mat-select
                id="ing-source"
                [(ngModel)]="ingredientForm.source_type"
                name="source_type"
                (ngModelChange)="onIngredientSourceTypeChange()"
                required
              >
                <mat-option value="manual">Manuell</mat-option>
                <mat-option value="custom_product">Konkretes Produkt</mat-option>
                <mat-option value="blv_generic">BLV generisch</mat-option>
              </mat-select>
            </mat-form-field>

            @if (ingredientForm.source_type === 'custom_product') {
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>BLV-Basiszutat</mat-label>
                <mat-select
                  id="ing-base"
                  [(ngModel)]="ingredientForm.base_ingredient_id"
                  name="base_ingredient_id"
                  [required]="ingredientForm.source_type === 'custom_product'"
                >
                  <mat-option [value]="null">Bitte wählen</mat-option>
                  @for (item of baseIngredientOptions(); track item.id) {
                    <mat-option [value]="item.id">{{ item.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <button mat-flat-button type="button" class="action-btn tonal compact" (click)="copyNutritionFromBaseIngredient()">
                BLV-Werte übernehmen
              </button>
            }

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Name</mat-label>
              <input matInput id="ing-name" type="text" [(ngModel)]="ingredientForm.name" name="name" required>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Makros aus Text (optional)</mat-label>
              <textarea
                matInput
                id="ing-macro-paste"
                [(ngModel)]="macroPasteText"
                name="macro_paste"
                rows="4"
                placeholder="kcal: 230&#10;protein: 8.5&#10;carbs: 29&#10;fat: 6.2"
              ></textarea>
            </mat-form-field>
            <button mat-flat-button type="button" class="action-btn tonal compact" [disabled]="!macroPasteText.trim()" (click)="applyMacroPaste()">
              Makros übernehmen
            </button>
            @if (macroPasteMessage()) {
              <p class="sub">{{ macroPasteMessage() }}</p>
            }

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Kcal / 100g</mat-label>
              <input matInput id="ing-kcal" type="number" [(ngModel)]="ingredientForm.kcal_per_100" name="kcal" required>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Kosten / 100g (optional)</mat-label>
              <input matInput id="ing-cost" type="number" [(ngModel)]="ingredientForm.cost_per_100" name="cost" min="0" step="0.01">
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Markt (optional)</mat-label>
              <input matInput id="ing-market" type="text" [(ngModel)]="ingredientForm.market_name" name="market" list="market-suggestions">
            </mat-form-field>
            <datalist id="market-suggestions">
              @for (market of marketSuggestions(); track market) {
                <option [value]="market"></option>
              }
            </datalist>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Protein / 100g</mat-label>
              <input matInput id="ing-protein" type="number" [(ngModel)]="ingredientForm.protein_per_100" name="protein" required>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Kohlenhydrate / 100g</mat-label>
              <input matInput id="ing-carbs" type="number" [(ngModel)]="ingredientForm.carbs_per_100" name="carbs" required>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Fett / 100g</mat-label>
              <input matInput id="ing-fat" type="number" [(ngModel)]="ingredientForm.fat_per_100" name="fat" required>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Marke (optional)</mat-label>
              <input matInput id="ing-brand" type="text" [(ngModel)]="ingredientForm.brand" name="brand">
            </mat-form-field>

            <div class="modal-actions">
              <button mat-flat-button type="submit" class="action-btn" [disabled]="!ingForm.valid">Speichern</button>
              <button mat-flat-button type="button" class="action-btn ghost" (click)="closeIngredientModal()">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showMealModal()) {
      <div class="modal" role="presentation" (click)="onModalBackdropClick($event, 'meal')">
        <div
          #mealDialog
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meal-modal-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <h2 id="meal-modal-title" class="title-font">{{ editingMeal() ? 'Mahlzeit bearbeiten' : 'Mahlzeit hinzufügen' }}</h2>
          <form (ngSubmit)="saveMeal()" #mealFormRef="ngForm" class="stack-form">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Mahlzeitenname</mat-label>
              <input matInput id="meal-name" type="text" [(ngModel)]="mealForm.name" name="name" required>
            </mat-form-field>

            <div class="meal-items">
              @for (item of mealItems; track $index) {
                <div class="meal-item">
                  <mat-form-field class="m3-field meal-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Zutat</mat-label>
                    <mat-select [(ngModel)]="item.ingredient_id" [name]="'ing' + $index">
                      @for (ing of ingredients(); track ing.id) {
                        <mat-option [value]="ing.id">{{ ing.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="m3-field meal-field grams" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Gramm</mat-label>
                    <input matInput type="number" [(ngModel)]="item.grams" [name]="'grams' + $index" placeholder="Gramm">
                  </mat-form-field>
                  <button mat-flat-button type="button" class="action-btn danger compact" (click)="removeMealItem($index)">Entfernen</button>
                </div>
              }
            </div>

            <p class="cost-preview">Geschätzte Mahlzeitenkosten: {{ draftMealCostLabel() }}</p>
            <button mat-flat-button type="button" class="action-btn tonal" (click)="addMealItem()">+ Zutat hinzufügen</button>

            <div class="modal-actions">
              <button mat-flat-button type="submit" class="action-btn" [disabled]="!mealFormRef.valid">Speichern</button>
              <button mat-flat-button type="button" class="action-btn ghost" (click)="closeMealModal()">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .library-page {
      gap: var(--layout-gap);
    }

    .tab-toggle {
      display: inline-flex;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      overflow: hidden;
      background: var(--m3-sys-color-surface-container-high);
    }

    .tab-toggle-btn {
      min-height: var(--touch-target);
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: var(--text-sm);
      font-weight: 700;
      padding: 0 16px;
    }

    .tab-toggle-btn.active {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    h1 {
      margin-top: 0.2rem;
      font-size: clamp(1.85rem, 4vw, 2.25rem);
      line-height: 1.06;
    }

    .lead {
      margin: 0.35rem 0 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 0.95rem;
      font-weight: 600;
    }

    .toolbar {
      margin-top: 0.7rem;
      display: grid;
      gap: 0.55rem;
      grid-template-columns: 1fr minmax(148px, 220px);
    }

    .list-head {
      margin-top: 0.65rem;
    }

    .items-list {
      margin-top: 0.7rem;
      display: grid;
      gap: 0.65rem;
    }

    .sub {
      margin-top: 0.2rem;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .ingredient-card,
    .meal-card {
      align-items: flex-start;
      gap: 0.75rem;
    }

    .actions {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }

    .stack-form {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.7rem;
    }

    .stack-form textarea {
      min-height: 88px;
      resize: vertical;
    }

    .meal-items {
      display: grid;
      gap: 0.65rem;
    }

    .cost-preview {
      margin: 0.1rem 0 0;
      font-weight: 800;
      color: var(--m3-sys-color-on-surface);
    }

    .meal-item {
      display: grid;
      grid-template-columns: 1fr 120px auto;
      gap: 0.55rem;
      align-items: start;
    }

    .meal-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .meal-field.grams {
      max-width: 120px;
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
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 0.85rem 0.95rem;
      display: grid;
      gap: 0.4rem;
    }

    .sheet-preview strong {
      font-size: 1rem;
      color: var(--m3-sys-color-on-surface);
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

    @media (max-width: 480px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      .meal-item {
        grid-template-columns: 1fr;
      }

      .actions {
        width: 100%;
      }
    }
  `]
})
export class LibraryComponent implements OnInit, OnDestroy {
  activeTab = signal<'ingredients' | 'meals'>('ingredients');
  ingredients = signal<Ingredient[]>([]);
  meals = signal<Meal[]>([]);
  showIngredientModal = signal(false);
  showMealModal = signal(false);
  editingIngredient = signal<Ingredient | null>(null);
  editingMeal = signal<Meal | null>(null);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  selectedIngredientForActions = signal<Ingredient | null>(null);
  selectedMealForActions = signal<Meal | null>(null);
  actionSheetOpen = signal(false);
  readonly ingredientDialog = viewChild<ElementRef<HTMLElement>>('ingredientDialog');
  readonly mealDialog = viewChild<ElementRef<HTMLElement>>('mealDialog');

  ingredientSearch = '';
  marketFilter = '';
  macroPasteText = '';
  macroPasteMessage = signal<string | null>(null);

  ingredientForm = this.createEmptyIngredientForm();

  mealForm = { name: '' };
  mealItems: { ingredient_id: string; grams: number }[] = [];
  mealCosts = signal<Record<string, number>>({});
  mealMacros = signal<Record<string, { kcal: number; protein: number; carbs: number; fat: number }>>({});
  private readonly allMealItems = signal<MealItem[]>([]);

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly libraryDataService = inject(LibraryDataService);
  private previousFocusedElement: HTMLElement | null = null;

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

  ngOnDestroy(): void {
    this.restorePreviousFocus();
  }

  onTabChanged(value: string): void {
    if (value === 'ingredients' || value === 'meals') {
      this.activeTab.set(value);
    }
  }

  async loadData(forceRefresh = false) {
    const user = this.authService.user();
    if (!user) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const snapshot = await this.libraryDataService.loadLibrary(user.id, {
        forceRefresh,
        allowStaleOnError: true
      });

      this.ingredients.set(snapshot.ingredients);
      this.meals.set(snapshot.meals);
      this.allMealItems.set(snapshot.mealItems);
      this.mealCosts.set(this.buildMealCosts(snapshot.meals, snapshot.mealItems, snapshot.ingredients));
      this.mealMacros.set(snapshot.mealMacros);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Bibliothek konnte nicht geladen werden'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateModal() {
    if (this.activeTab() === 'ingredients') {
      this.editingIngredient.set(null);
      this.ingredientForm = this.createEmptyIngredientForm();
      this.macroPasteText = '';
      this.macroPasteMessage.set(null);
      this.openIngredientModal();
      return;
    }

    this.editingMeal.set(null);
    this.mealForm = { name: '' };
    this.mealItems = [];
    this.openMealModal();
  }

  editIngredient(ingredient: Ingredient) {
    this.editingIngredient.set(ingredient);
    this.macroPasteText = '';
    this.macroPasteMessage.set(null);
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
    this.openIngredientModal();
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

      this.closeIngredientModal();
      this.ingredientForm = this.createEmptyIngredientForm();

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
    this.openMealModal();
  }

  closeIngredientModal(): void {
    this.showIngredientModal.set(false);
    this.editingIngredient.set(null);
    this.macroPasteText = '';
    this.macroPasteMessage.set(null);
    this.restorePreviousFocus();
  }

  closeMealModal(): void {
    this.showMealModal.set(false);
    this.editingMeal.set(null);
    this.restorePreviousFocus();
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

      this.closeMealModal();
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

  applyMacroPaste(): void {
    const parsed = this.parseMacroInput(this.macroPasteText);
    if (!parsed) {
      this.macroPasteMessage.set('Keine Makros erkannt. Bitte Format wie "protein: 10.5" nutzen.');
      return;
    }

    if (parsed.protein !== undefined) {
      this.ingredientForm.protein_per_100 = this.roundOneDecimal(parsed.protein);
    }
    if (parsed.carbs !== undefined) {
      this.ingredientForm.carbs_per_100 = this.roundOneDecimal(parsed.carbs);
    }
    if (parsed.fat !== undefined) {
      this.ingredientForm.fat_per_100 = this.roundOneDecimal(parsed.fat);
    }

    if (parsed.kcal !== undefined) {
      this.ingredientForm.kcal_per_100 = this.roundKcal(parsed.kcal);
    } else {
      const protein = Number(this.ingredientForm.protein_per_100 || 0);
      const carbs = Number(this.ingredientForm.carbs_per_100 || 0);
      const fat = Number(this.ingredientForm.fat_per_100 || 0);
      this.ingredientForm.kcal_per_100 = this.roundKcal(protein * 4 + carbs * 4 + fat * 9);
    }

    this.macroPasteMessage.set(
      `Übernommen: ${this.ingredientForm.kcal_per_100} kcal · P ${Number(this.ingredientForm.protein_per_100).toFixed(1)} · KH ${Number(this.ingredientForm.carbs_per_100).toFixed(1)} · F ${Number(this.ingredientForm.fat_per_100).toFixed(1)}`
    );
  }

  private formatCurrency(value: number) {
    return `${value.toFixed(2)} €`;
  }

  private openIngredientModal(): void {
    this.captureFocusBeforeModal();
    this.showIngredientModal.set(true);
    this.scheduleDialogFocus();
  }

  private openMealModal(): void {
    this.captureFocusBeforeModal();
    this.showMealModal.set(true);
    this.scheduleDialogFocus();
  }

  private scheduleDialogFocus(): void {
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => this.focusActiveDialog());
      return;
    }

    queueMicrotask(() => this.focusActiveDialog());
  }

  private focusActiveDialog(): void {
    const host = this.getActiveDialog();
    if (!host) {
      return;
    }

    const focusables = this.getFocusableElements(host);
    const target = focusables[0] || host;
    target.focus({ preventScroll: true });
  }

  private trapFocus(event: KeyboardEvent): void {
    const host = this.getActiveDialog();
    if (!host || typeof document === 'undefined') {
      return;
    }

    const focusables = this.getFocusableElements(host);
    if (focusables.length === 0) {
      event.preventDefault();
      host.focus({ preventScroll: true });
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!active || !host.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private getFocusableElements(root: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(',')))
      .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
  }

  private getActiveDialog(): HTMLElement | null {
    if (this.showIngredientModal()) {
      return this.ingredientDialog()?.nativeElement ?? null;
    }

    if (this.showMealModal()) {
      return this.mealDialog()?.nativeElement ?? null;
    }

    return null;
  }

  private captureFocusBeforeModal(): void {
    if (typeof document === 'undefined' || this.previousFocusedElement) {
      return;
    }

    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active.closest('[aria-modal="true"]')) {
      return;
    }

    this.previousFocusedElement = active;
  }

  private restorePreviousFocus(): void {
    if (!this.previousFocusedElement) {
      return;
    }

    const target = this.previousFocusedElement;
    this.previousFocusedElement = null;
    queueMicrotask(() => target.focus({ preventScroll: true }));
  }

  private createEmptyIngredientForm() {
    return {
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
  }

  private parseMacroInput(input: string): ParsedMacroInput | null {
    const raw = input.trim();
    if (!raw) {
      return null;
    }

    const jsonParsed = this.parseMacroJson(raw);
    if (jsonParsed) {
      return jsonParsed;
    }

    const normalized = raw.replace(/\u00a0/g, ' ');
    const parsed: ParsedMacroInput = {
      kcal: this.extractMacroValue(normalized, [
        /\b(?:kcal|kalorien|kalorie|calories?)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
        /(-?\d+(?:[.,]\d+)?)\s*(?:kcal)\b/i
      ]),
      protein: this.extractMacroValue(normalized, [
        /\b(?:protein|eiweiss|eiweiß|p)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
        /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:protein|eiweiss|eiweiß)\b/i
      ]),
      carbs: this.extractMacroValue(normalized, [
        /\b(?:carbs?|kohlenhydrate|kh|c)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
        /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:carbs?|kohlenhydrate|kh)\b/i
      ]),
      fat: this.extractMacroValue(normalized, [
        /\b(?:fett|fat|f)\b\s*(?:[:=\-])?\s*(-?\d+(?:[.,]\d+)?)/i,
        /(-?\d+(?:[.,]\d+)?)\s*g?\s*(?:fett|fat)\b/i
      ])
    };

    return this.hasMacroValues(parsed) ? parsed : null;
  }

  private parseMacroJson(input: string): ParsedMacroInput | null {
    try {
      const payload: unknown = JSON.parse(input);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
      }

      const record = payload as Record<string, unknown>;
      const getValue = (keys: string[]): number | undefined => {
        for (const key of keys) {
          const value = this.parseNumericValue(record[key]);
          if (value !== undefined) {
            return value;
          }
        }
        return undefined;
      };

      const parsed: ParsedMacroInput = {
        kcal: getValue(['kcal', 'calories', 'kalorien']),
        protein: getValue(['protein', 'eiweiss', 'eiweiß', 'p']),
        carbs: getValue(['carbs', 'carbohydrates', 'kohlenhydrate', 'kh', 'c']),
        fat: getValue(['fat', 'fett', 'f'])
      };

      return this.hasMacroValues(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private extractMacroValue(input: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (!match?.[1]) {
        continue;
      }
      const value = this.parseNumericValue(match[1]);
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  private parseNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const token = value.trim().match(/-?\d+(?:[.,]\d+)?/);
    if (!token?.[0]) {
      return undefined;
    }

    const numeric = Number(token[0].replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private hasMacroValues(parsed: ParsedMacroInput): boolean {
    return parsed.kcal !== undefined
      || parsed.protein !== undefined
      || parsed.carbs !== undefined
      || parsed.fat !== undefined;
  }

  private roundOneDecimal(value: number): number {
    return Number(value.toFixed(1));
  }

  private roundKcal(value: number): number {
    return Math.max(0, Math.round(value));
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
      queueMicrotask(() => this.editIngredient(ingredient));
      return;
    }

    const meal = this.selectedMealForActions();
    if (meal) {
      this.closeActionSheet();
      queueMicrotask(() => this.editMeal(meal));
    }
  }

  onModalBackdropClick(event: MouseEvent, modal: 'ingredient' | 'meal'): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (modal === 'ingredient') {
      this.closeIngredientModal();
      return;
    }

    this.closeMealModal();
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.showIngredientModal() && !this.showMealModal()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.showIngredientModal()) {
        this.closeIngredientModal();
        return;
      }
      this.closeMealModal();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
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

  async logSelectedItemToday(): Promise<void> {
    const ingredient = this.selectedIngredientForActions();
    if (ingredient) {
      await this.logIngredientToday(ingredient);
      this.closeActionSheet();
      return;
    }

    const meal = this.selectedMealForActions();
    if (meal) {
      await this.logMealToday(meal);
      this.closeActionSheet();
    }
  }

  async logIngredientToday(item: Ingredient): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const amount = 100;
    const factor = amount / 100;
    const success = await this.logTodayEntry({
      owner_id: user.id,
      group_id: null,
      day: this.todayIso(),
      entry_type: 'ingredient',
      ref_id: item.id,
      quantity: amount,
      kcal: Number((Number(item.kcal_per_100) * factor).toFixed(2)),
      protein: Number((Number(item.protein_per_100) * factor).toFixed(2)),
      carbs: Number((Number(item.carbs_per_100) * factor).toFixed(2)),
      fat: Number((Number(item.fat_per_100) * factor).toFixed(2)),
      created_at: new Date().toISOString()
    });

    if (success) {
      this.successMessage.set(`${item.name} für heute geloggt.`);
    }
  }

  async logMealToday(item: Meal): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const macros = this.mealMacros()[item.id];
    if (!macros) {
      this.errorMessage.set('Mahlzeitenmakros konnten nicht geladen werden.');
      return;
    }

    const success = await this.logTodayEntry({
      owner_id: user.id,
      group_id: null,
      day: this.todayIso(),
      entry_type: 'meal',
      ref_id: item.id,
      quantity: 1,
      kcal: Number(macros.kcal.toFixed(2)),
      protein: Number(macros.protein.toFixed(2)),
      carbs: Number(macros.carbs.toFixed(2)),
      fat: Number(macros.fat.toFixed(2)),
      created_at: new Date().toISOString()
    });

    if (success) {
      this.successMessage.set(`${item.name} für heute geloggt.`);
    }
  }

  private async logTodayEntry(payload: {
    owner_id: string;
    group_id: string | null;
    day: string;
    entry_type: 'ingredient' | 'meal';
    ref_id: string;
    quantity: number;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    created_at: string;
  }): Promise<boolean> {
    const { error } = await this.supabaseService.client.from('log_entries').insert(payload);
    if (error) {
      this.errorMessage.set(formatAppError(error, 'Konnte nicht geloggt werden'));
      return false;
    }

    return true;
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

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
