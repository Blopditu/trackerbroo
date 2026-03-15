import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { LibraryFacadeService } from './library-facade.service';
import { LibraryIngredientsTabComponent } from './library-ingredients-tab.component';
import { LibraryMealsTabComponent } from './library-meals-tab.component';
import { IngredientEditorComponent } from './ingredient-editor.component';
import { MealEditorComponent } from './meal-editor.component';
import { LibraryActionSheetComponent } from './library-action-sheet.component';

@Component({
  selector: 'app-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [LibraryFacadeService],
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)'
  },
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    BottomSheetComponent,
    LibraryIngredientsTabComponent,
    LibraryMealsTabComponent,
    IngredientEditorComponent,
    MealEditorComponent,
    LibraryActionSheetComponent
  ],
  template: `
    <main class="page library-page">
      @if (facade.errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ facade.errorMessage() }}</p>
      }

      @if (facade.successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ facade.successMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Bibliothek</p>
        <h1>Zutaten & Mahlzeiten</h1>
        <p class="lead">Baue deine Komponenten einmal auf und halte die Bibliothek sauber.</p>
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
              {{ facade.filteredIngredients().length }} Zutaten
            } @else {
              {{ facade.mealListRows().length }} Mahlzeiten
            }
          </span>
          <button mat-flat-button type="button" class="action-btn tonal compact" (click)="openCreateModal()">Neu</button>
        </div>

        @if (activeTab() === 'ingredients') {
          <app-library-ingredients-tab
            [loading]="facade.loadingIngredients()"
            [ingredientSearch]="facade.ingredientSearch()"
            [marketFilter]="facade.marketFilter()"
            [marketSuggestions]="facade.marketSuggestions()"
            [ingredients]="facade.filteredIngredients()"
            (ingredientSearchChange)="facade.setIngredientSearch($event)"
            (marketFilterChange)="facade.setMarketFilter($event)"
            (openActions)="openIngredientActions($event)"
          />
        }

        @if (activeTab() === 'meals') {
          <app-library-meals-tab
            [loading]="facade.loadingMeals()"
            [meals]="facade.mealListRows()"
            (openActions)="openMealActions($event)"
          />
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

    <app-bottom-sheet [open]="actionSheetOpen()" title="Eintrag verwalten" (closed)="closeActionSheet()">
      <app-library-action-sheet
        [label]="facade.actionSheetItemLabel()"
        [subLabel]="facade.actionSheetItemSubLabel()"
        (edit)="editSelectedItem()"
        (remove)="deleteSelectedItem()"
      />
    </app-bottom-sheet>

    @if (showIngredientModal()) {
      <div class="modal" role="presentation" (click)="onModalBackdropClick($event, 'ingredient')">
        <div
          #ingredientDialog
          class="modal-card library-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingredient-modal-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <app-ingredient-editor
            [form]="facade.ingredientForm"
            [editing]="!!facade.editingIngredient()"
            [macroPasteText]="facade.macroPasteText()"
            [macroPasteMessage]="facade.macroPasteMessage()"
            [detailsExpanded]="facade.ingredientDetailsExpanded()"
            [baseIngredientOptions]="facade.baseIngredientOptions()"
            [marketSuggestions]="facade.marketSuggestions()"
            (sourceTypeChange)="facade.onIngredientSourceTypeChange()"
            (macroPasteTextChange)="facade.setMacroPasteText($event)"
            (applyMacroPaste)="facade.applyMacroPaste()"
            (toggleDetails)="facade.toggleIngredientDetails()"
            (copyNutrition)="facade.copyNutritionFromBaseIngredient()"
            (save)="saveIngredient()"
            (cancel)="closeIngredientModal()"
          />
        </div>
      </div>
    }

    @if (showMealModal()) {
      <div class="modal" role="presentation" (click)="onModalBackdropClick($event, 'meal')">
        <div
          #mealDialog
          class="modal-card library-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meal-modal-title"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <app-meal-editor
            [form]="facade.mealForm"
            [itemControls]="mealItemControls()"
            [ingredients]="facade.ingredients()"
            [draftMealCostLabel]="facade.draftMealCostLabel()"
            [editing]="!!facade.editingMeal()"
            (addItem)="facade.addMealItem()"
            (removeItem)="facade.removeMealItem($event)"
            (save)="saveMeal()"
            (cancel)="closeMealModal()"
          />
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
      contain: layout style;
    }

    .sub {
      margin-top: 0.2rem;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .ingredient-card,
    .meal-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 0.9rem;
      padding: 0.95rem 1rem;
      border-radius: 24px;
      content-visibility: auto;
      contain-intrinsic-size: 132px;
    }

    .card-copy {
      display: grid;
      gap: 0.55rem;
      min-width: 0;
    }

    .card-copy strong {
      display: block;
      font-size: 1.05rem;
      line-height: 1.2;
      color: var(--m3-sys-color-on-surface);
    }

    .meta-pills,
    .macro-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .meta-pill,
    .macro-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border-radius: 999px;
      padding: 0 0.7rem;
      font-size: 0.76rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .meta-pill {
      background: color-mix(in srgb, var(--m3-sys-color-surface-container-highest) 76%, transparent);
      color: var(--m3-sys-color-on-surface-variant);
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
    }

    .macro-pill {
      background: color-mix(in srgb, var(--m3-sys-color-secondary-container) 70%, var(--m3-sys-color-surface) 30%);
      color: var(--m3-sys-color-on-secondary-container);
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-secondary-container) 92%, transparent);
    }

    .macro-pill-kcal {
      background: color-mix(in srgb, var(--m3-sys-color-primary-container) 76%, var(--m3-sys-color-surface) 24%);
      color: var(--m3-sys-color-on-primary-container);
      border-color: color-mix(in srgb, var(--m3-sys-color-primary-container) 88%, transparent);
    }

    .library-edit-btn {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      display: grid;
      place-items: center;
      margin-top: 0.1rem;
    }

    .library-edit-btn lucide-icon {
      width: 18px;
      height: 18px;
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

    .ingredient-primary-macros {
      gap: 0.7rem;
    }

    .ingredient-details {
      margin-top: -0.1rem;
    }

    .details-toggle {
      justify-self: start;
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

    .library-modal-card {
      max-width: 620px;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.7rem;
    }

    @media (max-width: 480px) {
      .toolbar {
        grid-template-columns: 1fr;
      }

      .meal-item,
      .grid-two {
        grid-template-columns: 1fr;
      }

      .ingredient-card,
      .meal-card {
        grid-template-columns: minmax(0, 1fr) 44px;
        gap: 0.7rem;
      }
    }
  `]
})
export class LibraryComponent implements OnInit, OnDestroy {
  readonly facade = inject(LibraryFacadeService);

  readonly activeTab = signal<'ingredients' | 'meals'>('ingredients');
  readonly actionSheetOpen = signal(false);
  readonly showIngredientModal = signal(false);
  readonly showMealModal = signal(false);
  readonly ingredientDialog = viewChild<ElementRef<HTMLElement>>('ingredientDialog');
  readonly mealDialog = viewChild<ElementRef<HTMLElement>>('mealDialog');
  readonly loading = computed(() =>
    this.activeTab() === 'ingredients' ? this.facade.loadingIngredients() : this.facade.loadingMeals()
  );

  private previousFocusedElement: HTMLElement | null = null;

  ngOnInit(): void {
    this.facade.init();
  }

  ngOnDestroy(): void {
    this.restorePreviousFocus();
  }

  async onTabChanged(value: 'ingredients' | 'meals'): Promise<void> {
    this.activeTab.set(value);
    await this.facade.activateTab(value);
  }

  async openCreateModal(): Promise<void> {
    if (this.activeTab() === 'ingredients') {
      this.facade.openCreateIngredient();
      this.openIngredientModal();
      return;
    }

    await this.facade.openCreateMeal();
    this.openMealModal();
  }

  openIngredientActions(ingredient: import('../../core/types').Ingredient): void {
    this.facade.openIngredientActions(ingredient);
    this.actionSheetOpen.set(true);
  }

  openMealActions(mealId: string): void {
    const meal = this.facade.meals().find(entry => entry.id === mealId);
    if (!meal) {
      return;
    }
    this.facade.openMealActions(meal);
    this.actionSheetOpen.set(true);
  }

  closeActionSheet(): void {
    this.actionSheetOpen.set(false);
    this.facade.clearActionSelection();
  }

  editSelectedItem(): void {
    const kind = this.facade.editSelectedItem();
    this.closeActionSheet();
    if (kind === 'ingredient') {
      this.openIngredientModal();
      return;
    }
    if (kind === 'meal') {
      this.openMealModal();
    }
  }

  async deleteSelectedItem(): Promise<void> {
    await this.facade.deleteSelectedItem();
    this.closeActionSheet();
  }

  async saveIngredient(): Promise<void> {
    const saved = await this.facade.saveIngredient();
    if (saved) {
      this.closeIngredientModal();
    }
  }

  async saveMeal(): Promise<void> {
    const saved = await this.facade.saveMeal();
    if (saved) {
      this.closeMealModal();
    }
  }

  closeIngredientModal(): void {
    this.showIngredientModal.set(false);
    this.facade.clearEditingIngredient();
    this.restorePreviousFocus();
  }

  closeMealModal(): void {
    this.showMealModal.set(false);
    this.facade.clearEditingMeal();
    this.restorePreviousFocus();
  }

  mealItemControls(): import('@angular/forms').FormGroup[] {
    return this.facade.mealItemsArray.controls;
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
}
