import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { LucideAngularModule, PencilLine } from 'lucide-angular';
import { Ingredient } from '../../core/types';
import { formatMacroValue, sourceTypeLabel } from './library-view-utils';

@Component({
  selector: 'app-library-ingredients-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    LucideAngularModule,
  ],
  template: `
    <div class="toolbar">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Zutat suchen</mat-label>
        <input
          matInput
          type="search"
          [ngModel]="ingredientSearch()"
          (ngModelChange)="ingredientSearchChange.emit($event)"
          placeholder="Zutat suchen"
          aria-label="Zutaten suchen"
        />
      </mat-form-field>
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Markt</mat-label>
        <mat-select
          [ngModel]="marketFilter()"
          (ngModelChange)="marketFilterChange.emit($event)"
          aria-label="Nach Markt filtern"
        >
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
        @for (item of ingredients(); track item.id) {
          <article class="list-card ingredient-card">
            <div class="card-copy">
              <strong>{{ item.name }}</strong>
              <div class="meta-pills">
                <span class="meta-pill">{{ sourceTypeLabel(item.source_type) }}</span>
                @if (item.market_name) {
                  <span class="meta-pill">{{ item.market_name }}</span>
                }
              </div>
              <div class="macro-pills" aria-label="Makros je 100 Gramm">
                <span class="macro-pill macro-pill-kcal">{{ item.kcal_per_100 }} kcal</span>
                <span class="macro-pill">P {{ formatMacroValue(item.protein_per_100) }}g</span>
                <span class="macro-pill">KH {{ formatMacroValue(item.carbs_per_100) }}g</span>
                <span class="macro-pill">F {{ formatMacroValue(item.fat_per_100) }}g</span>
              </div>
            </div>
            <button
              mat-icon-button
              type="button"
              class="library-edit-btn"
              (click)="openActions.emit(item)"
              [attr.aria-label]="item.name + ' bearbeiten'"
            >
              <lucide-icon [img]="editIcon" aria-hidden="true"></lucide-icon>
            </button>
          </article>
        }
        @if (ingredients().length === 0) {
          <p class="empty-state">Keine Zutaten passen zu deinen Filtern.</p>
        }
      </div>

      @if (hasMore()) {
        <div class="list-more">
          <button mat-flat-button type="button" class="action-btn ghost" (click)="showMore.emit()">
            Weitere {{ totalCount() - ingredients().length }} Zutaten anzeigen
          </button>
        </div>
      }
    }
  `,
})
export class LibraryIngredientsTabComponent {
  readonly loading = input.required<boolean>();
  readonly ingredientSearch = input.required<string>();
  readonly marketFilter = input.required<string>();
  readonly marketSuggestions = input.required<string[]>();
  readonly ingredients = input.required<Ingredient[]>();
  readonly totalCount = input.required<number>();
  readonly hasMore = input.required<boolean>();

  readonly ingredientSearchChange = output<string>();
  readonly marketFilterChange = output<string>();
  readonly openActions = output<Ingredient>();
  readonly showMore = output<void>();

  readonly editIcon = PencilLine;
  readonly sourceTypeLabel = sourceTypeLabel;
  readonly formatMacroValue = formatMacroValue;
}
