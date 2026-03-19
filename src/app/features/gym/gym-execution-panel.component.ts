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

interface PreviousPerformanceRow {
  session_date: string;
  set_number: number;
  is_warmup: boolean;
  weight_kg: number | null;
  reps: number | null;
  estimated_10rm: number | null;
}

interface QuickWeightOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-gym-execution-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule],
  styleUrl: './gym-execution-panel.component.css',
  template: `
    @if (session()) {
      <section class="panel execution">
        <div class="execution-head">
          <div>
            <p class="eyebrow">Session läuft</p>
            <h2>{{ currentExercise()?.name || 'Workout-Ausfuehrung' }}</h2>
            <p class="muted">Übung {{ activeExerciseIndex() + 1 }} / {{ session()!.exercises.length }} • Werte prüfen, kurz anpassen, weiter</p>
          </div>
          <span class="mono-badge">Einheit {{ session()!.sessionDate }}</span>
        </div>

        <div class="exercise-tabs execution-rail" role="tablist" aria-label="Übungen">
          @for (exercise of session()!.exercises; track exercise.sessionExerciseId; let index = $index) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeExerciseIndex() === index"
              [attr.tabindex]="activeExerciseIndex() === index ? 0 : -1"
              class="execution-rail-btn"
              [class.active]="activeExerciseIndex() === index"
              (click)="selectExercise.emit(index)"
            >
              @if (hasExerciseImage(exercise)) {
                <img [src]="exercise.images[0]" alt="" loading="lazy" aria-hidden="true">
              } @else {
                <span class="execution-rail-fallback" aria-hidden="true">{{ index + 1 }}</span>
              }
              <span class="execution-rail-copy">
                <strong>{{ exercise.name }}</strong>
                <span>{{ equipmentLabel(exercise.equipment) }}</span>
              </span>
            </button>
          }
        </div>

        @if (currentExercise()) {
          <article class="exercise-detail">
            <header class="exercise-detail-head">
              <div class="exercise-copy">
                <p class="eyebrow">Aktuelle Übung</p>
                <h3>{{ currentExercise()!.name }}</h3>
                <p class="muted">{{ equipmentLabel(currentExercise()!.equipment) }} • Ziel {{ targetLabel(currentExercise()!) }}</p>
              </div>
              <div class="detail-meta">
                <span class="detail-pill">{{ currentExercise()!.sets.length }} Sätze</span>
                <span class="detail-pill">{{ completedSetCount(currentExercise()!) }} erledigt</span>
              </div>
            </header>

            @if (currentFocusSet()) {
              <div class="focus-card">
                <div>
                  <p class="label">Nächster Schritt</p>
                  <strong>Satz {{ currentFocusSet()!.setNumber }}</strong>
                  <p class="muted">Werte sind vorausgefüllt. Nur anpassen, wenn nötig.</p>
                </div>
              </div>
            }

            <div class="set-stack" role="table" aria-label="Sätze">
              @for (setRow of currentExercise()!.sets; track setRow.clientRef) {
                <article class="set-card" [class.active]="isFocusSet(setRow)" [class.done]="setRow.isCompleted" role="row">
                  <div class="set-card-head">
                    <div>
                      <p class="set-kicker">{{ setRow.isWarmup ? 'Warm-up' : 'Arbeitssatz' }}</p>
                      <strong>Satz {{ setRow.setNumber }}</strong>
                    </div>
                    <span class="set-state">{{ setStateLabel(setRow) }}</span>
                  </div>

                  <div class="set-grid">
                    <label class="set-field">
                      <span>KG</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputmode="decimal"
                        [value]="setRow.weightKg ?? ''"
                        (input)="emitSetInput(setRow, 'weight', $event)"
                      >
                    </label>
                    <label class="set-field">
                      <span>WDH</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputmode="numeric"
                        [value]="setRow.reps ?? ''"
                        (input)="emitSetInput(setRow, 'reps', $event)"
                      >
                    </label>
                    <button
                      mat-icon-button
                      type="button"
                      class="check-btn"
                      [class.done]="setRow.isCompleted"
                      [attr.aria-label]="setRow.isCompleted ? 'Satz als offen markieren' : 'Satz abschließen'"
                      (click)="toggleSetComplete.emit(setRow)"
                    >
                      <lucide-icon [img]="checkIcon" aria-hidden="true"></lucide-icon>
                    </button>
                  </div>

                  @if (isFocusSet(setRow) && quickWeightOptions(setRow).length > 0) {
                    <div class="quick-chip-row" role="group" aria-label="Schnelle Gewichtsauswahl">
                      @for (option of quickWeightOptions(setRow); track option.label + '-' + option.value) {
                        <button type="button" class="quick-chip" (click)="applyQuickWeight(setRow, option.value)">
                          {{ option.label }}
                        </button>
                      }
                    </div>
                  }
                </article>
              }
            </div>

            @if (currentExerciseSaveHint()) {
              <p class="save-hint">{{ currentExerciseSaveHint() }}</p>
            }

            @if (workingPreviousPerformance().length > 0) {
              <div class="previous-block history-card">
                <div class="history-head">
                  <div>
                    <p class="eyebrow">Letzte Einheit</p>
                    <strong>{{ workingPreviousPerformance()[0].session_date }}</strong>
                  </div>
                  <span class="detail-pill">Als Referenz</span>
                </div>
                <div class="history-lines">
                  @for (prev of workingPreviousPerformance(); track prev.set_number + '-' + prev.is_warmup) {
                    <p class="previous-row">Satz {{ prev.set_number }} • {{ prev.weight_kg || 0 }} kg × {{ prev.reps || 0 }}</p>
                  }
                </div>
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
  readonly previousPerformance = input<PreviousPerformanceRow[]>([]);
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

  hasExerciseImage(exercise: TrainingExecutionExercise): boolean {
    return exercise.images.length > 0 && exercise.images[0].trim().length > 0;
  }

  completedSetCount(exercise: TrainingExecutionExercise): number {
    return exercise.sets.filter(setRow => setRow.isCompleted).length;
  }

  currentFocusSet(): TrainingExecutionSet | null {
    return this.currentExercise()?.sets.find(setRow => !setRow.isCompleted) ?? this.currentExercise()?.sets.at(-1) ?? null;
  }

  isFocusSet(setRow: TrainingExecutionSet): boolean {
    return this.currentFocusSet()?.clientRef === setRow.clientRef;
  }

  setStateLabel(setRow: TrainingExecutionSet): string {
    if (setRow.isCompleted) {
      return 'Erledigt';
    }
    if (this.isFocusSet(setRow)) {
      return 'Jetzt';
    }
    return 'Offen';
  }

  workingPreviousPerformance(): PreviousPerformanceRow[] {
    return this.previousPerformance().filter(row => !row.is_warmup);
  }

  quickWeightOptions(setRow: TrainingExecutionSet): QuickWeightOption[] {
    const seed = setRow.weightKg ?? this.previousWeightForSet(setRow.setNumber);
    if (!seed || seed <= 0) {
      return [];
    }

    const values = [seed, seed + 2.5, seed + 5];
    const seen = new Set<number>();

    return values
      .map(value => Number(value.toFixed(1)))
      .filter(value => {
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      })
      .map((value, index) => ({
        label: index === 0 ? `${this.formatWeight(value)} kg` : `+${this.formatWeight(value - seed)} → ${this.formatWeight(value)}`,
        value
      }));
  }

  applyQuickWeight(setRow: TrainingExecutionSet, value: number): void {
    this.setInput.emit({ setRow, field: 'weight', value: this.formatWeight(value) });
  }

  private previousWeightForSet(setNumber: number): number | null {
    return this.workingPreviousPerformance().find(row => row.set_number === setNumber)?.weight_kg ?? null;
  }

  private formatWeight(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}
