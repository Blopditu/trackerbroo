import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule, Check } from 'lucide-angular';
import {
  TrainingExecutionExercise,
  TrainingExecutionSession,
  TrainingExecutionSet
} from '../../core/training/training-data.service';
import { equipmentLabel, targetLabel } from './gym-view-utils';

export interface GymSetInputChange {
  setRow: TrainingExecutionSet;
  field: 'weight' | 'reps';
  value: string;
}

@Component({
  selector: 'app-gym-execution-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule],
  template: `
    @if (session()) {
      <section class="panel execution">
        <div class="execution-head">
          <div>
            <h2>Workout-Ausfuehrung</h2>
            <p class="muted">Übung {{ activeExerciseIndex() + 1 }} / {{ session()!.exercises.length }}</p>
          </div>
          <span class="mono-badge">Einheit {{ session()!.sessionDate }}</span>
        </div>

        <div class="exercise-tabs" role="tablist" aria-label="Übungen">
          @for (exercise of session()!.exercises; track exercise.sessionExerciseId; let index = $index) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeExerciseIndex() === index"
              [attr.tabindex]="activeExerciseIndex() === index ? 0 : -1"
              [class.active]="activeExerciseIndex() === index"
              (click)="selectExercise.emit(index)"
            >
              {{ exercise.name }}
            </button>
          }
        </div>

        @if (currentExercise()) {
          <article class="exercise-detail">
            <header>
              <h3>{{ currentExercise()!.name }}</h3>
              <p class="muted">{{ equipmentLabel(currentExercise()!.equipment) }} • Ziel {{ targetLabel(currentExercise()!) }}</p>
              <div class="detail-meta">
                <span class="detail-pill">{{ currentExercise()!.sets.length }} Sätze</span>
                <span class="detail-pill">3 Warm-up optional</span>
              </div>
            </header>

            <div class="set-table" role="table" aria-label="Sätze">
              <div class="table-head" role="row">
                <span>#</span>
                <span>KG</span>
                <span>WDH</span>
                <span>OK</span>
              </div>

              @for (setRow of currentExercise()!.sets; track setRow.clientRef) {
                <div class="table-row" role="row">
                  <span>{{ setRow.setNumber }}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    [value]="setRow.weightKg ?? ''"
                    (input)="emitSetInput(setRow, 'weight', $event)"
                  >
                  <input
                    type="number"
                    min="0"
                    step="1"
                    [value]="setRow.reps ?? ''"
                    (input)="emitSetInput(setRow, 'reps', $event)"
                  >
                  <button mat-icon-button type="button" class="check-btn" [class.done]="setRow.isCompleted" (click)="toggleSetComplete.emit(setRow)">
                    <lucide-icon [img]="checkIcon" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              }
            </div>

            @if (currentExerciseSaveHint()) {
              <p class="save-hint">{{ currentExerciseSaveHint() }}</p>
            }

            @if (previousPerformance().length > 0) {
              <div class="previous-block">
                <p class="muted">Vorheriges Workout ({{ previousPerformance()[0].session_date }})</p>
                @for (prev of previousPerformance(); track prev.set_number + '-' + prev.is_warmup) {
                  <p class="previous-row">{{ prev.set_number }} | {{ prev.weight_kg || 0 }} | {{ prev.reps || 0 }}</p>
                }
              </div>
            }
          </article>
        }

        <div class="execution-actions">
          <button mat-flat-button type="button" class="action-btn ghost" [disabled]="activeExerciseIndex() === 0" (click)="previousExercise.emit()">
            Zurück
          </button>
          <button
            mat-flat-button
            type="button"
            class="action-btn ghost"
            [disabled]="activeExerciseIndex() >= session()!.exercises.length - 1"
            (click)="nextExercise.emit()"
          >
            Nächste Übung
          </button>
          <button mat-flat-button type="button" class="action-btn" (click)="finishWorkout.emit()">Workout abschließen</button>
        </div>
      </section>
    }
  `
})
export class GymExecutionPanelComponent {
  readonly session = input.required<TrainingExecutionSession | null>();
  readonly activeExerciseIndex = input.required<number>();
  readonly currentExercise = input<TrainingExecutionExercise | null>(null);
  readonly previousPerformance = input<
    Array<{
      session_date: string;
      set_number: number;
      is_warmup: boolean;
      weight_kg: number | null;
      reps: number | null;
      estimated_10rm: number | null;
    }>
  >([]);
  readonly currentExerciseSaveHint = input<string | null>(null);

  readonly selectExercise = output<number>();
  readonly setInput = output<GymSetInputChange>();
  readonly toggleSetComplete = output<TrainingExecutionSet>();
  readonly previousExercise = output<void>();
  readonly nextExercise = output<void>();
  readonly finishWorkout = output<void>();

  readonly checkIcon = Check;
  readonly equipmentLabel = equipmentLabel;
  readonly targetLabel = targetLabel;

  emitSetInput(setRow: TrainingExecutionSet, field: 'weight' | 'reps', event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setInput.emit({ setRow, field, value: target.value });
  }
}
