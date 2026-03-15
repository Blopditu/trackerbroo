import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { LucideAngularModule, Dumbbell } from 'lucide-angular';
import { TrainingExercise, TrainingPlan } from '../../core/types';
import { equipmentLabel, muscleLabel } from './gym-view-utils';

@Component({
  selector: 'app-gym-session-hub-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatFormFieldModule, MatSelectModule, LucideAngularModule],
  template: `
    <div class="hub-tabs" role="group" aria-label="Session Hub Tabs">
      <button mat-flat-button type="button" class="hub-tab-btn" [class.active]="tab() === 'plans'" (click)="tabChange.emit('plans')">Pläne</button>
      <button mat-flat-button type="button" class="hub-tab-btn" [class.active]="tab() === 'exercises'" (click)="tabChange.emit('exercises')">Übungen</button>
      <button mat-flat-button type="button" class="hub-tab-btn" [class.active]="tab() === 'help'" (click)="tabChange.emit('help')">Hilfe</button>
    </div>

    @if (tab() === 'plans') {
      <div class="sheet-stack">
        <button mat-flat-button type="button" class="action-btn" (click)="startPlanBuilder.emit()">Neuen Plan erstellen</button>
        @for (plan of plans(); track plan.id) {
          <article class="list-card sheet-card">
            <div>
              <strong>{{ plan.name }}</strong>
              <p class="muted">{{ plan.days_per_week }} Tage • {{ plan.duration_weeks }} Wochen</p>
            </div>
            <button mat-flat-button type="button" class="action-btn ghost" [disabled]="plan.is_active" (click)="activatePlan.emit(plan.id)">
              {{ plan.is_active ? 'Aktiv' : 'Aktivieren' }}
            </button>
          </article>
        }
      </div>
    }

    @if (tab() === 'exercises') {
      <div class="sheet-stack">
        <section class="list-card sheet-card filter-card">
          <div class="filter-head">
            <strong>Filter</strong>
            @if (activeExerciseFilterCount() > 0) {
              <button mat-flat-button type="button" class="action-btn ghost compact" (click)="resetFilters.emit()">Zuruecksetzen</button>
            }
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Equipment</mat-label>
            <mat-select id="exercise-filter-equipment" [value]="exerciseEquipmentFilter()" (valueChange)="equipmentFilterChange.emit($event)">
              <mat-option value="">Alle</mat-option>
              @for (equipment of exerciseEquipmentOptions(); track equipment) {
                <mat-option [value]="equipment">{{ equipmentLabel(equipment) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Muskel</mat-label>
            <mat-select id="exercise-filter-muscle" [value]="exerciseMuscleFilter()" (valueChange)="muscleFilterChange.emit($event)">
              <mat-option value="">Alle</mat-option>
              @for (muscle of exerciseMuscleOptions(); track muscle) {
                <mat-option [value]="muscle">{{ muscleLabel(muscle) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <p class="muted">{{ filteredExerciseLibrary().length }} von {{ exercisesCount() }} Übungen</p>
        </section>

        <div class="sheet-scroll-list">
          @for (exercise of filteredExerciseLibrary(); track exercise.id) {
            <article class="list-card sheet-card">
              @if (hasExerciseImage(exercise.images)) {
                <img [src]="exercise.images[0]" alt="{{ exercise.name }}" loading="lazy" decoding="async">
              } @else {
                <div class="sheet-image-fallback" aria-hidden="true">
                  <lucide-icon [img]="dumbbellIcon"></lucide-icon>
                </div>
              }
              <div>
                <strong>{{ exercise.name }}</strong>
                <p class="muted">{{ equipmentLabel(exercise.equipment) }} • {{ muscleLabel(exercise.primary_muscle) }}</p>
                <p class="muted">{{ exercise.is_system ? 'System' : 'Eigen' }}</p>
              </div>
            </article>
          }
        </div>
      </div>
    }

    @if (tab() === 'help') {
      <div class="sheet-stack">
        <article class="list-card sheet-card text-only">
          <strong>Quick Logging</strong>
          <p class="muted">Vorherige Sätze werden automatisch übernommen, damit du nur bestätigen oder anpassen musst.</p>
        </article>
        <article class="list-card sheet-card text-only">
          <strong>Klare Ausführung</strong>
          <p class="muted">Während des Workouts stehen nur aktueller Satz, Historie und Abschluss im Fokus.</p>
        </article>
        <article class="list-card sheet-card text-only">
          <strong>Offline First</strong>
          <p class="muted">Alle Schreibaktionen werden offline lokal gespeichert und automatisch synchronisiert.</p>
        </article>
      </div>
    }
  `
})
export class GymSessionHubSheetComponent {
  readonly tab = input.required<'plans' | 'exercises' | 'help'>();
  readonly plans = input.required<TrainingPlan[]>();
  readonly activeExerciseFilterCount = input.required<number>();
  readonly exerciseEquipmentFilter = input.required<string>();
  readonly exerciseMuscleFilter = input.required<string>();
  readonly exerciseEquipmentOptions = input.required<string[]>();
  readonly exerciseMuscleOptions = input.required<string[]>();
  readonly filteredExerciseLibrary = input.required<TrainingExercise[]>();
  readonly exercisesCount = input.required<number>();

  readonly tabChange = output<'plans' | 'exercises' | 'help'>();
  readonly startPlanBuilder = output<void>();
  readonly activatePlan = output<string>();
  readonly equipmentFilterChange = output<string>();
  readonly muscleFilterChange = output<string>();
  readonly resetFilters = output<void>();

  readonly dumbbellIcon = Dumbbell;
  readonly equipmentLabel = equipmentLabel;
  readonly muscleLabel = muscleLabel;

  hasExerciseImage(images: string[] | null | undefined): boolean {
    const firstImage = images?.[0] || null;
    return !firstImage || !/dummyimage\.com/i.test(firstImage) ? Boolean(firstImage) : false;
  }
}
