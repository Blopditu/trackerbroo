import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Ingredient } from '../../core/types';

@Component({
  selector: 'app-ingredient-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <h2 id="ingredient-modal-title" class="title-font">{{ editing() ? 'Zutat bearbeiten' : 'Zutat hinzufügen' }}</h2>
    <form [formGroup]="form()" (ngSubmit)="save.emit()" class="stack-form">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Name</mat-label>
        <input #nameInput matInput id="ing-name" type="text" formControlName="name" required>
      </mat-form-field>

      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Quelle</mat-label>
        <mat-select id="ing-source" formControlName="source_type" (valueChange)="sourceTypeChange.emit()">
          <mat-option value="manual">Manuell</mat-option>
          <mat-option value="custom_product">Konkretes Produkt</mat-option>
          <mat-option value="blv_generic">BLV generisch</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Makros aus Text (optional)</mat-label>
        <textarea
          matInput
          id="ing-macro-paste"
          [value]="macroPasteText()"
          (input)="macroPasteTextChange.emit(valueOf($event))"
          rows="4"
          placeholder="kcal: 230&#10;protein: 8.5&#10;carbs: 29&#10;fat: 6.2"
        ></textarea>
      </mat-form-field>
      <button mat-flat-button type="button" class="action-btn tonal compact" [disabled]="!macroPasteText().trim()" (click)="applyMacroPaste.emit()">
        Makros übernehmen
      </button>
      @if (macroPasteMessage()) {
        <p class="sub">{{ macroPasteMessage() }}</p>
      }

      <div class="grid-two ingredient-primary-macros">
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Kcal / 100g</mat-label>
          <input matInput id="ing-kcal" type="number" formControlName="kcal_per_100" required>
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Protein / 100g</mat-label>
          <input matInput id="ing-protein" type="number" formControlName="protein_per_100" required>
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Kohlenhydrate / 100g</mat-label>
          <input matInput id="ing-carbs" type="number" formControlName="carbs_per_100" required>
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Fett / 100g</mat-label>
          <input matInput id="ing-fat" type="number" formControlName="fat_per_100" required>
        </mat-form-field>
      </div>

      <button mat-flat-button type="button" class="action-btn ghost compact details-toggle" (click)="toggleDetails.emit()">
        {{ detailsExpanded() ? 'Weniger Details' : 'Mehr Details' }}
      </button>

      @if (detailsExpanded()) {
        <div class="stack-form ingredient-details">
          @if (form().controls.source_type.value === 'custom_product') {
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>BLV-Basiszutat</mat-label>
              <mat-select id="ing-base" formControlName="base_ingredient_id">
                <mat-option [value]="null">Bitte wählen</mat-option>
                @for (item of baseIngredientOptions(); track item.id) {
                  <mat-option [value]="item.id">{{ item.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button type="button" class="action-btn tonal compact" (click)="copyNutrition.emit()">
              BLV-Werte übernehmen
            </button>
          }

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Kosten / 100g (optional)</mat-label>
            <input matInput id="ing-cost" type="number" formControlName="cost_per_100" min="0" step="0.01">
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Markt (optional)</mat-label>
            <input matInput id="ing-market" type="text" formControlName="market_name" list="market-suggestions">
          </mat-form-field>
          <datalist id="market-suggestions">
            @for (market of marketSuggestions(); track market) {
              <option [value]="market"></option>
            }
          </datalist>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Marke (optional)</mat-label>
            <input matInput id="ing-brand" type="text" formControlName="brand">
          </mat-form-field>
        </div>
      }

      <div class="modal-actions">
        <button mat-flat-button type="submit" class="action-btn" [disabled]="form().invalid">Speichern</button>
        <button mat-flat-button type="button" class="action-btn ghost" (click)="cancel.emit()">Abbrechen</button>
      </div>
    </form>
  `
})
export class IngredientEditorComponent {
  readonly form = input.required<FormGroup>();
  readonly editing = input.required<boolean>();
  readonly macroPasteText = input.required<string>();
  readonly macroPasteMessage = input<string | null>(null);
  readonly detailsExpanded = input.required<boolean>();
  readonly baseIngredientOptions = input.required<Ingredient[]>();
  readonly marketSuggestions = input.required<string[]>();

  readonly sourceTypeChange = output<void>();
  readonly macroPasteTextChange = output<string>();
  readonly applyMacroPaste = output<void>();
  readonly toggleDetails = output<void>();
  readonly copyNutrition = output<void>();
  readonly save = output<void>();
  readonly cancel = output<void>();

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
