import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
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
  templateUrl: './library.component.html',
  styleUrl: './library.component.css'
})
export class LibraryComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly facade = inject(LibraryFacadeService);

  readonly activeTab = this.facade.activeTab;
  readonly actionSheetOpen = signal(false);
  readonly showIngredientModal = signal(false);
  readonly showMealModal = signal(false);
  readonly ingredientDialog = viewChild<ElementRef<HTMLElement>>('ingredientDialog');
  readonly mealDialog = viewChild<ElementRef<HTMLElement>>('mealDialog');

  private previousFocusedElement: HTMLElement | null = null;

  ngOnInit(): void {
    void this.facade.activate();
  }

  ngAfterViewInit(): void {
    this.scheduleScrollRestore();
  }

  ngOnDestroy(): void {
    this.facade.deactivate(this.readScrollY());
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

  mealItemControls(): FormGroup[] {
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

  private scheduleScrollRestore(): void {
    if (typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: this.facade.scrollY(), left: 0, behavior: 'auto' });
    });
  }

  private readScrollY(): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    return window.scrollY || window.pageYOffset || 0;
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
