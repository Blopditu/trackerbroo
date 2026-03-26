import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Ingredient } from '../../core/types';

@Component({
  selector: 'app-meal-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 id="meal-modal-title" class="title-font">
      {{ editing() ? 'Mahlzeit bearbeiten' : 'Mahlzeit hinzufügen' }}
    </h2>
    <form [formGroup]="form()" (ngSubmit)="save.emit()" class="stack-form">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Mahlzeitenname</mat-label>
        <input matInput id="meal-name" type="text" formControlName="name" required />
      </mat-form-field>

      <div class="meal-items" formArrayName="items">
        @for (item of itemControls(); track $index; let index = $index) {
          <div class="meal-item" [formGroupName]="index">
            <mat-form-field
              class="m3-field meal-field"
              appearance="outline"
              subscriptSizing="dynamic"
            >
              <mat-label>Zutat</mat-label>
              <mat-select formControlName="ingredient_id">
                @for (ingredient of ingredients(); track ingredient.id) {
                  <mat-option [value]="ingredient.id">{{ ingredient.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field
              class="m3-field meal-field grams"
              appearance="outline"
              subscriptSizing="dynamic"
            >
              <mat-label>Gramm</mat-label>
              <input matInput type="number" formControlName="grams" placeholder="Gramm" />
            </mat-form-field>
            <button
              mat-flat-button
              type="button"
              class="action-btn danger compact"
              (click)="removeItem.emit(index)"
            >
              Entfernen
            </button>
          </div>
        }
      </div>

      <p class="cost-preview">Geschätzte Mahlzeitenkosten: {{ draftMealCostLabel() }}</p>
      <button mat-flat-button type="button" class="action-btn tonal" (click)="addItem.emit()">
        + Zutat hinzufügen
      </button>

      <div class="modal-actions">
        <button mat-flat-button type="submit" class="action-btn" [disabled]="form().invalid">
          Speichern
        </button>
        <button mat-flat-button type="button" class="action-btn ghost" (click)="cancel.emit()">
          Abbrechen
        </button>
      </div>
    </form>
  `,
})
export class MealEditorComponent {
  readonly form = input.required<FormGroup>();
  readonly itemControls = input.required<FormGroup[]>();
  readonly ingredients = input.required<Ingredient[]>();
  readonly draftMealCostLabel = input.required<string>();
  readonly editing = input.required<boolean>();

  readonly addItem = output<void>();
  readonly removeItem = output<number>();
  readonly save = output<void>();
  readonly cancel = output<void>();
}
