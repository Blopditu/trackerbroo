import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule, PencilLine } from 'lucide-angular';
import { LibraryMealListRow, formatMacroValue, roundKcal } from './library-view-utils';

@Component({
  selector: 'app-library-meals-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule],
  template: `
    @if (loading()) {
      <div class="skeleton card"></div>
      <div class="skeleton card"></div>
    } @else {
      <div class="items-list">
        @for (item of meals(); track item.id) {
          <article class="list-card meal-card">
            <div class="card-copy">
              <strong>{{ item.name }}</strong>
              <div class="meta-pills">
                <span class="meta-pill">Mahlzeit</span>
                <span class="meta-pill">Kosten {{ item.costLabel }}</span>
              </div>
              @if (item.macros; as macros) {
                <div class="macro-pills" aria-label="Makros pro Portion">
                  <span class="macro-pill macro-pill-kcal">{{ roundKcal(macros.kcal) }} kcal</span>
                  <span class="macro-pill">P {{ formatMacroValue(macros.protein) }}g</span>
                  <span class="macro-pill">KH {{ formatMacroValue(macros.carbs) }}g</span>
                  <span class="macro-pill">F {{ formatMacroValue(macros.fat) }}g</span>
                </div>
              }
            </div>
            <button
              mat-icon-button
              type="button"
              class="library-edit-btn"
              (click)="openActions.emit(item.id)"
              [attr.aria-label]="item.name + ' bearbeiten'"
            >
              <lucide-icon [img]="editIcon" aria-hidden="true"></lucide-icon>
            </button>
          </article>
        }
        @if (meals().length === 0) {
          <p class="empty-state">Noch keine Mahlzeiten. Lege deine erste Mahlzeit an, damit du später schneller loggen kannst.</p>
        }
      </div>

      @if (hasMore()) {
        <div class="list-more">
          <button mat-flat-button type="button" class="action-btn ghost" (click)="showMore.emit()">
            Weitere {{ totalCount() - meals().length }} Mahlzeiten anzeigen
          </button>
        </div>
      }
    }
  `
})
export class LibraryMealsTabComponent {
  readonly loading = input.required<boolean>();
  readonly meals = input.required<LibraryMealListRow[]>();
  readonly totalCount = input.required<number>();
  readonly hasMore = input.required<boolean>();
  readonly openActions = output<string>();
  readonly showMore = output<void>();

  readonly editIcon = PencilLine;
  readonly roundKcal = roundKcal;
  readonly formatMacroValue = formatMacroValue;
}
