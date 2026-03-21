import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule, Check, Pencil, Timer } from 'lucide-angular';
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
  template: `
    @if (session()) {
      <section class="execution-shell" [class.history-mode]="mode() === 'history'">
        <div class="execution-rail" role="tablist" aria-label="Übungen">
          @for (exercise of session()!.exercises; track exercise.sessionExerciseId; let index = $index) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeExerciseIndex() === index"
              [attr.tabindex]="activeExerciseIndex() === index ? 0 : -1"
              class="execution-rail-btn"
              [class.active]="activeExerciseIndex() === index"
              [class.complete]="isExerciseComplete(exercise)"
              (click)="selectExercise.emit(index)"
            >
              <span class="execution-rail-copy">
                <strong>{{ exercise.name }}</strong>
                <span>{{ railMetaLabel(exercise, index) }}</span>
              </span>
              <span class="execution-rail-indicator" aria-hidden="true"></span>
            </button>
          }
        </div>

        @if (currentExercise()) {
          <article class="execution-context">
            <div class="execution-context-copy">
              <div>
                <p class="context-kicker">Active Exercise</p>
                <h3>{{ currentExercise()!.name }}</h3>
              </div>
              <p class="muted">Übung {{ activeExerciseIndex() + 1 }} / {{ session()!.exercises.length }} • Satz für Satz durchziehen</p>
            </div>

            <div class="execution-context-grid">
              <article class="context-stat">
                <span>Target</span>
                <strong>{{ targetLabel(currentExercise()!) }}</strong>
              </article>
              <article class="context-stat">
                <span>Equipment</span>
                <strong>{{ equipmentLabel(currentExercise()!.equipment) }}</strong>
              </article>

              @if (workingPreviousPerformance().length > 0) {
                <article class="context-ref">
                  <div class="context-ref-head">
                    <span>Previous Session Ref</span>
                    <lucide-icon [img]="timerIcon" aria-hidden="true"></lucide-icon>
                  </div>
                  <p>{{ previousSessionSummary() }}</p>
                </article>
              } @else {
                <article class="context-ref empty">
                  <div class="context-ref-head">
                    <span>Previous Session Ref</span>
                  </div>
                  <p>Noch keine Referenz für diese Übung.</p>
                </article>
              }
            </div>

            @if (mode() === 'workout') {
              <section class="set-flow" aria-label="Satzfolge">
                @for (setRow of completedSets(); track setRow.clientRef) {
                  <article class="set-row done">
                    <div class="set-row-leading done">
                      <lucide-icon [img]="checkIcon" aria-hidden="true"></lucide-icon>
                    </div>
                    <div class="set-row-copy">
                      <span class="set-row-label">Set {{ setRow.setNumber }}</span>
                      <strong>{{ formatSetValue(setRow.weightKg, 'kg') }} <span>/</span> {{ formatSetValue(setRow.reps, 'reps') }}</strong>
                    </div>
                    <button
                      type="button"
                      class="set-row-icon"
                      (click)="toggleSetComplete.emit(setRow)"
                      aria-label="Satz erneut öffnen"
                    >
                      <lucide-icon [img]="pencilIcon" aria-hidden="true"></lucide-icon>
                    </button>
                  </article>
                }

                @if (activeSet()) {
                  <article class="active-set-card">
                    <div class="active-set-head">
                      <div>
                        <span class="active-set-label">Set {{ activeSet()!.setNumber }}</span>
                        <p>Active Set</p>
                      </div>
                      <div class="active-set-timer">
                        <lucide-icon [img]="timerIcon" aria-hidden="true"></lucide-icon>
                        <span>{{ timerLabel() }}</span>
                      </div>
                    </div>

                    <div class="active-set-fields">
                      <label class="active-set-field">
                        <span>Weight (kg)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          inputmode="decimal"
                          [value]="activeSet()!.weightKg ?? ''"
                          (input)="emitSetInput(activeSet()!, 'weight', $event)"
                        >
                      </label>
                      <label class="active-set-field">
                        <span>Reps</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputmode="numeric"
                          [value]="activeSet()!.reps ?? ''"
                          (input)="emitSetInput(activeSet()!, 'reps', $event)"
                        >
                      </label>
                    </div>

                    @if (quickWeightOptions(activeSet()!).length > 0) {
                      <div class="quick-adjust-row" role="group" aria-label="Gewicht schnell anpassen">
                        @for (option of quickWeightOptions(activeSet()!); track option.label + '-' + option.value) {
                          <button type="button" class="quick-adjust-chip" (click)="applyQuickWeight(activeSet()!, option.value)">
                            {{ option.label }}
                          </button>
                        }
                      </div>
                    }
                  </article>
                }

                @for (setRow of upcomingSets(); track setRow.clientRef) {
                  <article class="set-row upcoming">
                    <div class="set-row-leading upcoming">{{ setRow.setNumber }}</div>
                    <div class="set-row-copy">
                      <span class="set-row-label">Upcoming</span>
                      <strong>{{ formatSetValue(setRow.weightKg, 'kg') }} <span>/</span> {{ formatSetValue(setRow.reps, 'reps') }}</strong>
                    </div>
                  </article>
                }
              </section>

              @if (currentExerciseSaveHint()) {
                <p class="save-hint">{{ currentExerciseSaveHint() }}</p>
              }

              <div class="execution-actions">
                <button
                  mat-flat-button
                  type="button"
                  class="action-btn"
                  (click)="runPrimaryAction()"
                >
                  {{ primaryActionLabel() }}
                </button>
                <button
                  mat-flat-button
                  type="button"
                  class="action-btn ghost compact"
                  (click)="finishWorkout.emit()"
                >
                  Finish Workout
                </button>
              </div>
            } @else {
              <section class="history-mode-block" aria-label="Workout History">
                <header class="history-mode-head">
                  <div>
                    <p class="context-kicker">History</p>
                    <h4>{{ currentExercise()!.name }}</h4>
                  </div>
                  <span class="history-count">{{ completedSetCount(currentExercise()!) }} / {{ currentExercise()!.sets.length }} Sets</span>
                </header>

                @if (workingPreviousPerformance().length > 0) {
                  <div class="history-list">
                    @for (prev of workingPreviousPerformance(); track prev.set_number + '-' + prev.is_warmup) {
                      <article class="history-row">
                        <span>Satz {{ prev.set_number }}</span>
                        <strong>{{ formatSetValue(prev.weight_kg, 'kg') }} <span>/</span> {{ formatSetValue(prev.reps, 'reps') }}</strong>
                        <small>{{ prev.session_date }}</small>
                      </article>
                    }
                  </div>
                } @else {
                  <div class="history-empty">
                    <p>Noch keine gespeicherte Historie für diese Übung.</p>
                  </div>
                }

                <div class="history-list current">
                  @for (setRow of currentExercise()!.sets; track setRow.clientRef) {
                    <article class="history-row" [class.complete]="setRow.isCompleted" [class.current]="isFocusSet(setRow)">
                      <span>Satz {{ setRow.setNumber }}</span>
                      <strong>{{ formatSetValue(setRow.weightKg, 'kg') }} <span>/</span> {{ formatSetValue(setRow.reps, 'reps') }}</strong>
                      <small>{{ setStateLabel(setRow) }}</small>
                    </article>
                  }
                </div>
              </section>
            }
          </article>
        }
      </section>
    }
  `
})
export class GymExecutionPanelComponent implements OnDestroy {
  readonly session = input.required<TrainingExecutionSession | null>();
  readonly activeExerciseIndex = input.required<number>();
  readonly currentExercise = input<TrainingExecutionExercise | null>(null);
  readonly previousPerformance = input<PreviousPerformanceRow[]>([]);
  readonly currentExerciseSaveHint = input<string | null>(null);
  readonly mode = input<'workout' | 'history'>('workout');

  readonly selectExercise = output<number>();
  readonly setInput = output<GymSetInputChange>();
  readonly toggleSetComplete = output<TrainingExecutionSet>();
  readonly previousExercise = output<void>();
  readonly nextExercise = output<void>();
  readonly finishWorkout = output<void>();

  readonly checkIcon = Check;
  readonly pencilIcon = Pencil;
  readonly timerIcon = Timer;
  readonly equipmentLabel = equipmentLabel;
  readonly targetLabel = targetLabel;
  readonly elapsedSeconds = signal(102);
  readonly completedSets = computed(() => this.currentExercise()?.sets.filter(setRow => setRow.isCompleted) ?? []);
  readonly activeSet = computed(() => this.currentFocusSet());
  readonly upcomingSets = computed(() => {
    const currentSet = this.currentFocusSet();
    const exercise = this.currentExercise();
    if (!exercise || !currentSet) {
      return [];
    }
    return exercise.sets.filter(setRow => !setRow.isCompleted && setRow.clientRef !== currentSet.clientRef);
  });

  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const focusKey = this.currentFocusSet()?.clientRef || null;
      if (!focusKey || this.mode() !== 'workout') {
        this.clearTimer();
        return;
      }

      this.elapsedSeconds.set(102);
      this.clearTimer();
      this.timerHandle = setInterval(() => {
        this.elapsedSeconds.update(value => value + 1);
      }, 1000);
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  emitSetInput(setRow: TrainingExecutionSet, field: 'weight' | 'reps', event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setInput.emit({ setRow, field, value: target.value });
  }

  completedSetCount(exercise: TrainingExecutionExercise): number {
    return exercise.sets.filter(setRow => setRow.isCompleted).length;
  }

  isExerciseComplete(exercise: TrainingExecutionExercise): boolean {
    return exercise.sets.every(setRow => setRow.isCompleted);
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

  previousSessionSummary(): string {
    const firstRow = this.workingPreviousPerformance()[0];
    if (!firstRow) {
      return 'Noch keine Referenz';
    }

    return `${firstRow.session_date} • ${firstRow.weight_kg || 0} kg × ${firstRow.reps || 0}`;
  }

  hasNextExercise(): boolean {
    const session = this.session();
    return Boolean(session) && this.activeExerciseIndex() < session!.exercises.length - 1;
  }

  primaryActionLabel(): string {
    const focusSet = this.currentFocusSet();
    if (focusSet && !focusSet.isCompleted) {
      return 'Satz abschließen';
    }
    return this.hasNextExercise() ? 'Next Exercise' : 'Finish Workout';
  }

  runPrimaryAction(): void {
    const focusSet = this.currentFocusSet();
    if (focusSet && !focusSet.isCompleted) {
      this.toggleSetComplete.emit(focusSet);
      return;
    }

    if (this.hasNextExercise()) {
      this.nextExercise.emit();
      return;
    }

    this.finishWorkout.emit();
  }

  quickWeightOptions(setRow: TrainingExecutionSet): QuickWeightOption[] {
    const seed = setRow.weightKg ?? this.previousWeightForSet(setRow.setNumber);
    if (!seed || seed <= 0) {
      return [];
    }

    const values = [seed - 5, seed - 2.5, seed + 2.5, seed + 5].filter(value => value > 0);
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
      .map(value => ({
        label: `${value > seed ? '+' : ''}${this.formatWeight(value - seed)}`,
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

  formatSetValue(value: number | null, unit: string): string {
    if (value === null) {
      return `-- ${unit}`;
    }
    return `${value} ${unit}`;
  }

  railMetaLabel(exercise: TrainingExecutionExercise, index: number): string {
    if (this.activeExerciseIndex() === index) {
      return 'Jetzt';
    }
    return this.isExerciseComplete(exercise) ? 'Erledigt' : `${exercise.sets.length} Sätze`;
  }

  timerLabel(): string {
    const totalSeconds = this.elapsedSeconds();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private clearTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
