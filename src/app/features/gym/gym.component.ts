import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  Activity,
  BarChart3,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  LucideAngularModule,
  Play,
  Plus,
  User
} from 'lucide-angular';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import {
  ProgressSeriesQuery,
  SavePlanInput,
  TrainingDashboardDay,
  TrainingDashboardWeek,
  TrainingDataService,
  TrainingExecutionExercise,
  TrainingExecutionSession,
  TrainingExecutionSet,
  TrainingGraphDataPoint,
  TrainingPlanOverview,
  TrainingPersonalStats
} from '../../core/training/training-data.service';
import {
  TrainingExercise,
  TrainingGraphConfig,
  TrainingGraphType,
  TrainingMeasurementType,
  TrainingPlan
} from '../../core/types';
import {
  addDays,
  calculateVolume,
  estimateTenRm,
  newClientRef,
  roundTo,
  startOfIsoWeek,
  suggestNextWeightKg,
  toIsoDate
} from '../../core/training/training-utils';
import { formatAppError } from '../../core/error-format';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';

interface BuilderDayDraft {
  name: string;
  targetMuscles: string;
  exercises: Array<{
    exerciseId: string;
    sets: number;
    targetReps: number | null;
    targetSeconds: number | null;
  }>;
}

interface ExerciseProgressRow {
  date: string;
  tenRm: string;
  volume: string;
}

@Component({
  selector: 'app-gym',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    BottomSheetComponent
  ],
  template: `
    <main class="page gym-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ successMessage() }}</p>
      }

      <header class="panel hero">
        <p class="title-font">Gym</p>
        <h1>Krafttracker</h1>
        <div class="hero-controls">
          <mat-button-toggle-group
            class="gym-tabs"
            [value]="activeTab()"
            aria-label="Gym Ansicht"
            (valueChange)="onHeroTabChange($event)"
          >
            <mat-button-toggle value="tracker">
              <lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon>
              Tracker
            </mat-button-toggle>
            <mat-button-toggle value="progress">
              <lucide-icon [img]="icons.barChart" class="icon" aria-hidden="true"></lucide-icon>
              Progress
            </mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-icon-button type="button" routerLink="/profile" aria-label="Profil öffnen">
            <lucide-icon [img]="icons.user" class="icon" aria-hidden="true"></lucide-icon>
          </button>
        </div>
      </header>

      @if (activeTab() === 'tracker' && !activeSession() && selectedOverview()) {
        <section class="panel quick-start-strip" aria-label="Schnellstart">
          <div class="quick-start-copy">
            <p class="muted">Ausgewählt</p>
            <strong>{{ selectedOverview()!.dayName }}</strong>
            <p class="muted">{{ selectedOverview()!.totalExercises }} Übungen • {{ selectedOverview()!.totalSets }} Sätze</p>
          </div>
          <button mat-flat-button type="button" class="action-btn" (click)="startWorkout()">
            <lucide-icon [img]="icons.play" class="icon" aria-hidden="true"></lucide-icon>
            Schnellstart
          </button>
        </section>
      }

      @if (activeTab() === 'tracker') {
        @if (!activeSession()) {
          <section class="panel">
            <div class="week-nav">
              <button mat-icon-button type="button" class="week-btn" (click)="goPrevWeek()" aria-label="Vorherige Woche">
                <lucide-icon [img]="icons.chevronLeft" aria-hidden="true"></lucide-icon>
              </button>
              <div class="week-scroll" role="tablist" aria-label="Wochentage">
                @for (day of dashboardWeek()?.days || []; track day.iso) {
                  <button
                    mat-button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="selectedDate() === day.iso"
                    [attr.tabindex]="selectedDate() === day.iso ? 0 : -1"
                    [class.day-pill]="true"
                    [class.active]="selectedDate() === day.iso"
                    [class.today]="day.isToday"
                    (click)="onSelectDate(day.iso)"
                  >
                    {{ day.label }}
                  </button>
                }
              </div>
              <button mat-icon-button type="button" class="week-btn" (click)="goNextWeek()" aria-label="Nächste Woche">
                <lucide-icon [img]="icons.chevronRight" aria-hidden="true"></lucide-icon>
              </button>
            </div>
          </section>

          <section class="panel">
            @if (dashboardWeek()?.activePlan) {
              <div class="active-plan-head">
                <div>
                  <p class="muted">Aktiver Plan</p>
                  <h2>{{ dashboardWeek()!.activePlan!.name }}</h2>
                  <p class="muted">Woche {{ dashboardWeek()!.activePlan!.weekNumber }}</p>
                </div>
                <span class="mono-badge">{{ dashboardWeek()!.activePlan!.durationWeeks }} Wochen</span>
              </div>

              <div class="workout-days">
                @for (workout of dashboardWeek()?.workoutDays || []; track workout.dayId) {
                  <button type="button" class="workout-day" [class.completed]="workout.completed" (click)="openWorkoutPreview(workout)">
                    <div class="left">
                      <strong>{{ workout.dayNumber }} {{ workout.name }}</strong>
                      <div class="thumbs" aria-hidden="true">
                        @for (thumb of workout.thumbnails.slice(0, 3); track thumb) {
                          @if (isPlaceholderImage(thumb)) {
                            <span class="thumb-fallback"></span>
                          } @else {
                            <img [src]="thumb" alt="" loading="lazy" decoding="async">
                          }
                        }
                        @if (workout.exerciseCount > 3) {
                          <span class="thumb-more">+{{ workout.exerciseCount - 3 }}</span>
                        }
                      </div>
                    </div>
                    <div class="right">
                      <span>{{ workout.exerciseCount }} Übungen</span>
                      @if (workout.completed) {
                        <lucide-icon [img]="icons.check" class="check-icon" aria-hidden="true"></lucide-icon>
                      }
                    </div>
                  </button>
                }
              </div>
            } @else {
              <p class="muted">Noch kein Trainingsplan aktiv. Erstelle deinen ersten Plan.</p>
            }

            <div class="quick-actions">
              <button mat-flat-button type="button" class="action-btn ghost" (click)="openSheet('plans')">Alle Plaene</button>
              <button mat-flat-button type="button" class="action-btn ghost" (click)="openSheet('exercises')">Uebungen</button>
              <button mat-flat-button type="button" class="action-btn ghost" (click)="openSheet('help')">Hilfe</button>
            </div>
          </section>

          @if (selectedOverview()) {
            <section class="panel">
              <div class="overview-head">
                <div>
                  <h2>{{ selectedOverview()!.dayName }}</h2>
                  <p class="muted">{{ selectedOverview()!.planName }} • Woche {{ selectedOverview()!.weekNumber }}</p>
                  <p class="muted">{{ selectedOverview()!.totalExercises }} Uebungen • {{ selectedOverview()!.totalSets }} Saetze</p>
                </div>
                <button mat-flat-button type="button" class="action-btn" (click)="startWorkout()">
                  <lucide-icon [img]="icons.play" class="icon" aria-hidden="true"></lucide-icon>
                  Start
                </button>
              </div>

              <div class="body-diagram" aria-label="Muskelgruppenübersicht">
                <svg viewBox="0 0 220 130" role="img" aria-label="Zielmuskeln">
                  <rect x="10" y="10" width="58" height="48" [attr.fill]="muscleColor('chest')"></rect>
                  <rect x="82" y="10" width="58" height="48" [attr.fill]="muscleColor('shoulders')"></rect>
                  <rect x="154" y="10" width="58" height="48" [attr.fill]="muscleColor('lats')"></rect>
                  <rect x="10" y="72" width="58" height="48" [attr.fill]="muscleColor('quads')"></rect>
                  <rect x="82" y="72" width="58" height="48" [attr.fill]="muscleColor('hamstrings')"></rect>
                  <rect x="154" y="72" width="58" height="48" [attr.fill]="muscleColor('core')"></rect>
                </svg>
              </div>

              <div class="exercise-list">
                @for (exercise of selectedOverview()?.exercises || []; track exercise.dayExerciseId) {
                  <article class="exercise-row">
                    @if (isPlaceholderImage(exercise.images[0] || null)) {
                      <span class="exercise-thumb-fallback"></span>
                    } @else {
                      <img [src]="exercise.images[0] || placeholderImage" alt="{{ exercise.name }}" loading="lazy" decoding="async">
                    }
                    <div>
                      <strong>{{ exercise.name }}</strong>
                      <p class="muted">{{ equipmentLabel(exercise.equipment) }} • {{ exercise.sets }} x {{ exercise.targetReps ? exercise.targetReps : (exercise.targetSeconds + 's') }}</p>
                    </div>
                  </article>
                }
              </div>
            </section>
          }
        }

        @if (activeSession()) {
          <section class="panel execution">
            <div class="execution-head">
              <div>
                <h2>Workout-Ausfuehrung</h2>
                <p class="muted">Übung {{ activeExerciseIndex() + 1 }} / {{ activeSession()!.exercises.length }}</p>
              </div>
              <span class="mono-badge">Einheit {{ activeSession()!.sessionDate }}</span>
            </div>

            <div class="exercise-tabs" role="tablist" aria-label="Übungen">
              @for (exercise of activeSession()!.exercises; track exercise.sessionExerciseId) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeExerciseIndex() === $index"
                  [attr.tabindex]="activeExerciseIndex() === $index ? 0 : -1"
                  [class.active]="activeExerciseIndex() === $index"
                  (click)="setActiveExercise($index)"
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
                  <p class="muted">3 Warmup Sets (optional)</p>
                </header>

                <div class="media-carousel" aria-label="Übungsbilder">
                  @for (image of currentExercise()!.images; track image) {
                    <img [src]="image" alt="{{ currentExercise()!.name }} Technikbild" loading="lazy" decoding="async">
                  }
                  @if (currentExercise()!.images.length === 0) {
                    <img [src]="placeholderImage" alt="Platzhalter Übungsbild" loading="lazy" decoding="async">
                  }
                </div>

                @if (recommendedSetLine()) {
                  <button type="button" class="recommended-row" (click)="acceptRecommendation()">
                    Empfehlung: {{ recommendedSetLine() }}
                  </button>
                }

                <div class="set-table" role="table" aria-label="Sätze">
                  <div class="table-head" role="row">
                    <span>#</span>
                    <span>KG</span>
                    <span>WDH</span>
                    <span>10RM</span>
                    <span>OK</span>
                  </div>

                  @for (setRow of currentExercise()!.sets; track setRow.clientRef) {
                    <div class="table-row" role="row">
                      <span>{{ setRow.setNumber }}</span>
                      <input type="number" min="0" step="0.5" [value]="setRow.weightKg ?? ''" (input)="onSetInput($event, setRow, 'weight')">
                      <input type="number" min="0" step="1" [value]="setRow.reps ?? ''" (input)="onSetInput($event, setRow, 'reps')">
                      <span>{{ setRow.estimated10Rm ? setRow.estimated10Rm.toFixed(1) : '--' }}</span>
                      <button mat-icon-button type="button" class="check-btn" [class.done]="setRow.isCompleted" (click)="toggleSetComplete(setRow)">
                        <lucide-icon [img]="icons.check" aria-hidden="true"></lucide-icon>
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
              <button mat-flat-button type="button" class="action-btn ghost" [disabled]="activeExerciseIndex() === 0" (click)="goToPreviousExercise()">
                Zurück
              </button>
              <button mat-flat-button type="button" class="action-btn ghost" [disabled]="activeExerciseIndex() >= activeSession()!.exercises.length - 1" (click)="goToNextExercise()">
                Nächste Übung
              </button>
              <button mat-flat-button type="button" class="action-btn" (click)="finishWorkout()">Workout abschließen</button>
            </div>
          </section>
        }
      }

      @if (activeTab() === 'progress') {
        <section class="panel stats-card">
          <h2>Personal Stats</h2>
          <div class="stats-grid">
            <article class="stat-box">
              <p class="label">Workouts</p>
              <strong>{{ personalStats()?.totalWorkouts || 0 }}</strong>
            </article>
            <article class="stat-box">
              <p class="label">Streak</p>
              <strong>{{ personalStats()?.currentStreakWeeks || 0 }} Wochen</strong>
            </article>
            <article class="stat-box">
              <p class="label">Gym</p>
              <strong>{{ personalStats()?.gymName || 'Nicht gesetzt' }}</strong>
            </article>
            <article class="stat-box">
              <p class="label">Gewicht</p>
              <strong>{{ personalStats()?.latestBodyweight ? personalStats()!.latestBodyweight + ' kg' : '--' }}</strong>
            </article>
          </div>

          <form class="measurement-form" [formGroup]="measurementForm" (ngSubmit)="saveMeasurement()">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Messung</mat-label>
              <mat-select id="measure-type" formControlName="type">
                <mat-option value="weight">Gewicht</mat-option>
                <mat-option value="bodyfat">Körperfett</mat-option>
                <mat-option value="waist">Taille</mat-option>
                <mat-option value="chest">Brust</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Wert</mat-label>
              <input matInput id="measure-value" type="number" min="0" step="0.1" formControlName="value">
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Datum</mat-label>
              <input matInput id="measure-date" type="date" formControlName="measuredOn">
            </mat-form-field>

            <button mat-flat-button type="submit" class="action-btn" [disabled]="measurementForm.invalid">Wert speichern</button>
          </form>
        </section>

        <section class="panel">
          <div class="progress-head">
            <h2>Übungs-Progress</h2>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Übung</mat-label>
            <mat-select
              id="progress-exercise"
              [value]="selectedProgressExerciseId()"
              (valueChange)="onProgressExerciseChange($event)"
            >
              <mat-option value="">Bitte wählen</mat-option>
              @for (exercise of exercises(); track exercise.id) {
                <mat-option [value]="exercise.id">{{ exercise.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (selectedProgressExercise()) {
            <p class="muted">{{ equipmentLabel(selectedProgressExercise()!.equipment) }} • {{ muscleLabel(selectedProgressExercise()!.primary_muscle) }}</p>
          }

          <div class="stats-grid">
            <article class="stat-box">
              <p class="label">Aktuelles 10RM</p>
              <strong>{{ latestTenRmLabel() }}</strong>
            </article>
            <article class="stat-box">
              <p class="label">Volumen / Session</p>
              <strong>{{ latestSessionVolumeLabel() }}</strong>
            </article>
          </div>

          <article class="graph-card">
            <div class="graph-head">
              <strong>10RM Verlauf</strong>
              <span class="muted">Arbeitssets, pro Session</span>
            </div>
            @if (tenRmSeries().length > 0) {
              <svg class="graph" viewBox="0 0 100 34" preserveAspectRatio="none" aria-label="10RM Verlauf">
                <polyline [attr.points]="toLinePoints(tenRmSeries())"></polyline>
              </svg>
            } @else {
              <p class="muted">Noch keine 10RM-Daten für diese Übung.</p>
            }
          </article>

          <article class="graph-card">
            <div class="graph-head">
              <strong>Volumen pro Session</strong>
              <span class="muted">Summe aus Gewicht × Wdh</span>
            </div>
            @if (exerciseVolumeSeries().length > 0) {
              <svg class="graph" viewBox="0 0 100 34" preserveAspectRatio="none" aria-label="Volumen pro Session">
                <polyline [attr.points]="toLinePoints(exerciseVolumeSeries())"></polyline>
              </svg>
            } @else {
              <p class="muted">Noch keine Volumen-Daten für diese Übung.</p>
            }
          </article>

          @if (progressSessionRows().length > 0) {
            <div class="previous-block">
              <p class="muted">Letzte Sessions</p>
              @for (row of progressSessionRows(); track row.date) {
                <p class="previous-row">{{ row.date }} • 10RM {{ row.tenRm }} • Volumen {{ row.volume }}</p>
              }
            </div>
          }
        </section>
      }
    </main>

    <app-bottom-sheet [open]="activeSheet() === 'plans'" title="Alle Plaene" (closed)="closeSheet()">
      <div class="sheet-stack">
        <button mat-flat-button type="button" class="action-btn" (click)="startPlanBuilder()">Neuen Plan erstellen</button>
        @for (plan of plans(); track plan.id) {
          <article class="list-card sheet-card">
            <div>
              <strong>{{ plan.name }}</strong>
              <p class="muted">{{ plan.days_per_week }} Tage • {{ plan.duration_weeks }} Wochen</p>
            </div>
            <button mat-flat-button type="button" class="action-btn ghost" [disabled]="plan.is_active" (click)="activatePlan(plan.id)">
              {{ plan.is_active ? 'Aktiv' : 'Aktivieren' }}
            </button>
          </article>
        }
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'builder'" [closeOnBackdrop]="false" title="Plan Builder" (closed)="closeSheet()">
      <form class="sheet-stack" [formGroup]="planMetaForm" (ngSubmit)="savePlan()">
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Plan Name</mat-label>
          <input matInput id="plan-name" type="text" formControlName="name">
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Frequenz</mat-label>
          <mat-select id="plan-days" formControlName="daysPerWeek" (valueChange)="syncBuilderDayCount()">
            @for (freq of frequencies; track freq) {
              <mat-option [value]="freq">{{ freq }}x pro Woche</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Dauer (Wochen)</mat-label>
          <input matInput id="plan-weeks" type="number" min="1" max="52" formControlName="durationWeeks">
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Startdatum</mat-label>
          <input matInput id="plan-start" type="date" formControlName="startDate">
        </mat-form-field>

        <mat-slide-toggle formControlName="isActive">Als aktiven Plan setzen</mat-slide-toggle>

        @for (day of builderDays(); track $index; let dayIndex = $index) {
          <section class="list-card builder-day">
            <h3>Day {{ dayIndex + 1 }}</h3>
            <input type="text" [value]="day.name" (input)="setBuilderDayName(dayIndex, $event)" placeholder="Day Name">
            <input type="text" [value]="day.targetMuscles" (input)="setBuilderDayMuscles(dayIndex, $event)" placeholder="Zielmuskeln (Komma-getrennt)">

            @for (exercise of day.exercises; track $index; let exerciseIndex = $index) {
              <div class="sheet-stack builder-exercise">
                <select [value]="exercise.exerciseId" (change)="setBuilderExercise(dayIndex, exerciseIndex, 'exerciseId', $event)">
                  @for (option of exercises(); track option.id) {
                    <option [value]="option.id">{{ option.name }}</option>
                  }
                </select>
                <input type="number" min="1" [value]="exercise.sets" (input)="setBuilderExercise(dayIndex, exerciseIndex, 'sets', $event)">
                <input type="number" min="1" [value]="exercise.targetReps ?? ''" (input)="setBuilderExercise(dayIndex, exerciseIndex, 'targetReps', $event)" placeholder="Wdh">
                <button mat-flat-button type="button" class="action-btn ghost" (click)="removeBuilderExercise(dayIndex, exerciseIndex)">Entfernen</button>
              </div>
            }

            <button mat-flat-button type="button" class="action-btn ghost" (click)="addBuilderExercise(dayIndex)">Uebung hinzufuegen</button>
          </section>
        }

        <button mat-flat-button type="button" class="action-btn ghost" [disabled]="builderDays().length >= 7" (click)="addBuilderDay()">Tag hinzufuegen</button>
        <button mat-flat-button type="submit" class="action-btn" [disabled]="planMetaForm.invalid || builderDays().length === 0">Plan speichern</button>
      </form>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'exercises'" [closeOnBackdrop]="false" title="Uebungen" (closed)="closeSheet()">
      <div class="sheet-stack">
        <section class="list-card sheet-card filter-card">
          <div class="filter-head">
            <strong>Filter</strong>
            @if (activeExerciseFilterCount() > 0) {
              <button mat-flat-button type="button" class="action-btn ghost compact" (click)="resetExerciseFilters()">
                Zuruecksetzen
              </button>
            }
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Equipment</mat-label>
            <mat-select
              id="exercise-filter-equipment"
              [value]="exerciseEquipmentFilter()"
              (valueChange)="onExerciseEquipmentFilterChange($event)"
            >
              <mat-option value="">Alle</mat-option>
              @for (equipment of exerciseEquipmentOptions(); track equipment) {
                <mat-option [value]="equipment">{{ equipmentLabel(equipment) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Muskel</mat-label>
            <mat-select
              id="exercise-filter-muscle"
              [value]="exerciseMuscleFilter()"
              (valueChange)="onExerciseMuscleFilterChange($event)"
            >
              <mat-option value="">Alle</mat-option>
              @for (muscle of exerciseMuscleOptions(); track muscle) {
                <mat-option [value]="muscle">{{ muscleLabel(muscle) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <p class="muted">{{ filteredExerciseLibrary().length }} von {{ exercises().length }} Uebungen</p>
        </section>

        <div class="sheet-scroll-list">
          @for (exercise of filteredExerciseLibrary(); track exercise.id) {
            <article class="list-card sheet-card">
              <img [src]="exercise.images[0] || placeholderImage" alt="{{ exercise.name }}" loading="lazy" decoding="async">
              <div>
                <strong>{{ exercise.name }}</strong>
                <p class="muted">{{ equipmentLabel(exercise.equipment) }} • {{ muscleLabel(exercise.primary_muscle) }}</p>
                <p class="muted">{{ exercise.is_system ? 'System' : 'Eigen' }}</p>
              </div>
            </article>
          }
        </div>
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'help'" title="Hilfe" (closed)="closeSheet()">
      <div class="sheet-stack">
        <article class="list-card sheet-card text-only">
          <strong>Quick Logging</strong>
          <p class="muted">Gewicht wird aus dem letzten Workout als Empfehlung vorgeschlagen.</p>
        </article>
        <article class="list-card sheet-card text-only">
          <strong>Smart Suggestions</strong>
          <p class="muted">Wenn alle Arbeitssätze das Ziel erreichen, wird +2.5kg fürs nächste Mal vorgeschlagen.</p>
        </article>
        <article class="list-card sheet-card text-only">
          <strong>Offline First</strong>
          <p class="muted">Alle Schreibaktionen werden offline lokal gespeichert und automatisch synchronisiert.</p>
        </article>
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'session-share'" [closeOnBackdrop]="false" title="Workout teilen" (closed)="closeSheet()">
      <p class="muted">{{ workoutShareSuggestion() }}</p>
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Notiz (optional)</mat-label>
        <textarea matInput id="session-share-note" rows="2" [(ngModel)]="workoutShareNote" placeholder="Wie lief das Training?"></textarea>
      </mat-form-field>

      <p class="file-label">Foto (optional)</p>
      <div class="file-row">
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="pickSessionSharePhoto()">Foto auswählen</button>
        <span class="file-name">{{ workoutSharePhotoName() || 'Kein Foto gewählt' }}</span>
      </div>
      <input #sessionSharePhotoInput class="sr-only" type="file" accept="image/*" (change)="onSessionSharePhotoSelected($event)">

      <div class="action-list">
        <button mat-flat-button type="button" class="action-btn" [disabled]="sharingWorkoutPost()" (click)="submitSessionCommunityPost()">
          {{ sharingWorkoutPost() ? 'Wird gepostet...' : 'In Community posten' }}
        </button>
        <button mat-flat-button type="button" class="action-btn ghost" [disabled]="sharingWorkoutPost()" (click)="skipSessionShare()">Überspringen</button>
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graphs'" [closeOnBackdrop]="false" title="Graph hinzufuegen" (closed)="closeSheet()">
      <form class="sheet-stack" [formGroup]="graphForm" (ngSubmit)="addGraphWidget()">
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Graph-Typ</mat-label>
          <mat-select id="graph-type" formControlName="graphType">
            <mat-option value="workout_count">Workouts pro Woche</mat-option>
            <mat-option value="exercise_10rm">Uebung 10RM Verlauf</mat-option>
            <mat-option value="muscle_volume">Muskelgruppen-Volumen</mat-option>
            <mat-option value="bodyweight">Koerpergewicht</mat-option>
            <mat-option value="total_volume">Gesamtvolumen</mat-option>
          </mat-select>
        </mat-form-field>

        @if (graphForm.value.graphType === 'exercise_10rm') {
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Uebung</mat-label>
            <mat-select id="graph-exercise" formControlName="exerciseId">
              <mat-option value="">Bitte wählen</mat-option>
              @for (exercise of exercises(); track exercise.id) {
                <mat-option [value]="exercise.id">{{ exercise.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (graphForm.value.graphType === 'muscle_volume') {
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Muskelgruppe</mat-label>
            <input matInput id="graph-muscle" type="text" formControlName="muscleGroup" placeholder="z.B. quads">
          </mat-form-field>
        }

        <button mat-flat-button type="submit" class="action-btn" [disabled]="graphForm.invalid">Graph hinzufügen</button>
      </form>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graph-detail'" title="Erweiterte Analyse" (closed)="closeSheet()">
      @if (selectedDetailWidget()) {
        <div class="sheet-stack">
          <strong>{{ graphTitle(selectedDetailWidget()!) }}</strong>
          <div class="grid-two">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Von</mat-label>
              <input matInput id="detail-from" type="date" [value]="detailFrom()" (input)="onDetailDateChange($event, 'from')">
            </mat-form-field>
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Bis</mat-label>
              <input matInput id="detail-to" type="date" [value]="detailTo()" (input)="onDetailDateChange($event, 'to')">
            </mat-form-field>
          </div>
          <button mat-flat-button type="button" class="action-btn ghost" (click)="reloadDetailSeries()">Neu laden</button>

          @if (detailSeries().length > 0) {
            <svg class="graph detail" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Detailgraph">
              <polyline [attr.points]="toLinePoints(detailSeries())"></polyline>
            </svg>
          } @else {
            <p class="muted">Keine Daten für den gewählten Zeitraum.</p>
          }
        </div>
      }
    </app-bottom-sheet>
  `,
  styles: [`
    .hero h1 {
      margin: 0;
      font-size: clamp(1.95rem, 4vw, 2.4rem);
      line-height: 1.04;
    }

    .hero-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .gym-tabs {
      flex: 1;
    }

    .gym-tabs .mat-button-toggle {
      min-height: var(--touch-target);
    }

    .gym-tabs .mat-button-toggle-label-content {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .quick-start-strip {
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
    }

    .quick-start-copy {
      display: grid;
      gap: 4px;
    }

    .quick-start-copy strong {
      font-size: 18px;
      color: var(--m3-sys-color-on-surface);
    }

    .active-plan-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .active-plan-head h2 {
      margin: 0;
      font-size: 20px;
    }

    .workout-days {
      display: grid;
      gap: 10px;
    }

    .workout-day {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px;
      text-align: left;
      width: 100%;
    }

    .workout-day.completed {
      border-color: var(--success-500);
      background: color-mix(in srgb, var(--success-500) 20%, var(--m3-sys-color-surface-container-low));
    }

    .left,
    .right {
      display: grid;
      gap: 6px;
    }

    .thumbs {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .thumbs img,
    .exercise-row img,
    .sheet-card img,
    .media-carousel img {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 12px;
      background: var(--m3-sys-color-surface-container);
    }

    .thumb-fallback,
    .exercise-thumb-fallback {
      width: 40px;
      height: 40px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 12px;
      background: var(--m3-sys-color-surface-container-high);
      display: inline-block;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--m3-sys-color-primary) 24%, transparent);
    }

    .thumb-more {
      font-size: 12px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 700;
    }

    .check-icon {
      color: var(--success-500);
      width: 16px;
      height: 16px;
      justify-self: end;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .overview-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .body-diagram {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
      display: grid;
      place-items: center;
    }

    .exercise-list {
      display: grid;
      gap: 10px;
    }

    .exercise-row {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
    }

    .exercise-row img,
    .exercise-row .exercise-thumb-fallback {
      width: 48px;
      height: 48px;
      border-radius: 12px;
    }

    .execution-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .execution-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .exercise-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .exercise-tabs button {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
      padding: 0 14px;
      white-space: nowrap;
    }

    .exercise-tabs button.active {
      color: var(--m3-sys-color-on-surface);
      border-color: var(--m3-sys-color-primary);
      background: var(--m3-sys-color-outline-variant);
    }

    .exercise-detail {
      display: grid;
      gap: 12px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 24px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 14px;
    }

    .exercise-detail h3 {
      margin: 0;
      font-size: 18px;
    }

    .media-carousel {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .media-carousel img {
      width: 148px;
      height: 92px;
      border-radius: 14px;
    }

    .recommended-row {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--success-500);
      border-radius: 16px;
      background: color-mix(in srgb, var(--success-500) 20%, var(--m3-sys-color-surface-container-low));
      color: var(--m3-sys-color-on-surface);
      font-weight: 700;
      text-align: left;
      padding: 0 12px;
    }

    .set-table {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      display: grid;
      gap: 8px;
      padding: 12px;
      background: var(--m3-sys-color-surface-container);
    }

    .table-head,
    .table-row {
      display: grid;
      grid-template-columns: 30px 1fr 1fr 1fr 52px;
      gap: 8px;
      align-items: center;
    }

    .table-head {
      font-size: 12px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 700;
    }

    .table-row input {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 14px;
      background: var(--m3-sys-color-surface-container-highest);
      color: var(--m3-sys-color-on-surface);
      padding: 0 10px;
    }

    .check-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 14px;
      background: var(--m3-sys-color-surface-container-highest);
      color: var(--m3-sys-color-on-surface-variant);
      display: grid;
      place-items: center;
    }

    .check-btn.done {
      border-color: var(--success-500);
      color: var(--success-500);
      background: color-mix(in srgb, var(--success-500) 20%, var(--m3-sys-color-surface-container-low));
    }

    .previous-block {
      border-top: 1px solid var(--m3-sys-color-outline-variant);
      padding-top: 10px;
      display: grid;
      gap: 6px;
    }

    .previous-row {
      margin: 0;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface);
    }

    .save-hint {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
    }

    .progress-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .graph-card {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
      display: grid;
      gap: 8px;
      cursor: pointer;
    }

    .graph-head {
      display: grid;
      gap: 4px;
    }

    .graph {
      width: 100%;
      height: 62px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container);
    }

    .graph.detail {
      height: 120px;
    }

    .graph polyline {
      fill: none;
      stroke: var(--m3-sys-color-primary);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .gym-fab {
      z-index: 35;
    }

    .fab-icon {
      width: 24px;
      height: 24px;
    }

    .filter-card {
      gap: 10px;
    }

    .filter-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .sheet-card img {
      width: 52px;
      height: 52px;
    }

    .sheet-scroll-list {
      display: grid;
      gap: 10px;
      max-height: 46vh;
      overflow-y: auto;
    }

    .builder-day h3 {
      margin: 0;
      font-size: 16px;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    @media (max-width: 420px) {
      .quick-actions {
        grid-template-columns: 1fr;
      }

      .execution-actions {
        grid-template-columns: 1fr;
      }

      .table-head,
      .table-row {
        grid-template-columns: 24px 1fr 1fr 1fr 44px;
      }
    }
  `]
})
export class GymComponent implements OnInit, OnDestroy {
  readonly icons = {
    dumbbell: Dumbbell,
    barChart: BarChart3,
    user: User,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    check: Check,
    play: Play,
    plus: Plus,
    activity: Activity,
    flame: Flame,
    calendar: Calendar
  };

  readonly frequencies = [1, 2, 3, 4, 5, 6, 7];
  readonly equipmentOptions: TrainingExercise['equipment'][] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'bands', 'other'];
  readonly placeholderImage = 'https://dummyimage.com/640x360/1b202b/a4a9b6&text=Uebung';

  readonly activeTab = signal<'tracker' | 'progress'>('tracker');
  readonly selectedDate = signal(toIsoDate(new Date()));
  readonly dashboardWeek = signal<TrainingDashboardWeek | null>(null);
  readonly selectedWorkoutDay = signal<TrainingDashboardDay | null>(null);
  readonly selectedOverview = signal<TrainingPlanOverview | null>(null);
  readonly activeSession = signal<TrainingExecutionSession | null>(null);
  readonly activeExerciseIndex = signal(0);
  readonly previousPerformance = signal<Array<{
    session_date: string;
    set_number: number;
    is_warmup: boolean;
    weight_kg: number | null;
    reps: number | null;
    estimated_10rm: number | null;
  }>>([]);

  readonly plans = signal<TrainingPlan[]>([]);
  readonly exercises = signal<TrainingExercise[]>([]);
  readonly widgets = signal<TrainingGraphConfig[]>([]);
  readonly seriesMap = signal<Record<number, TrainingGraphDataPoint[]>>({});
  readonly personalStats = signal<TrainingPersonalStats | null>(null);

  readonly selectedDetailWidget = signal<TrainingGraphConfig | null>(null);
  readonly detailSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly detailFrom = signal(toIsoDate(addDays(new Date(), -365)));
  readonly detailTo = signal(toIsoDate(new Date()));
  readonly exerciseEquipmentFilter = signal('');
  readonly exerciseMuscleFilter = signal('');
  readonly selectedProgressExerciseId = signal('');
  readonly tenRmSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly exerciseVolumeSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly workoutShareSuggestion = signal('1/3 Workouts diese Woche');
  readonly workoutSharePhotoName = signal<string | null>(null);
  readonly sharingWorkoutPost = signal(false);
  readonly lastCompletedSessionDay = signal<string | null>(null);
  readonly sessionSharePhotoInput = viewChild<ElementRef<HTMLInputElement>>('sessionSharePhotoInput');

  readonly activeSheet = signal<'none' | 'plans' | 'builder' | 'exercises' | 'help' | 'graphs' | 'graph-detail' | 'session-share'>('none');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly setSaveState = signal<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  readonly currentExercise = computed<TrainingExecutionExercise | null>(() => {
    const session = this.activeSession();
    if (!session) {
      return null;
    }
    return session.exercises[this.activeExerciseIndex()] || null;
  });

  readonly selectedProgressExercise = computed<TrainingExercise | null>(() => {
    const selectedId = this.selectedProgressExerciseId();
    if (!selectedId) {
      return null;
    }
    return this.exercises().find(exercise => exercise.id === selectedId) || null;
  });

  readonly exerciseEquipmentOptions = computed(() =>
    [...new Set(this.exercises().map(exercise => exercise.equipment))]
      .sort((a, b) => a.localeCompare(b))
  );

  readonly exerciseMuscleOptions = computed(() =>
    [
      ...new Set(
        this.exercises().flatMap(exercise => [exercise.primary_muscle, ...(exercise.secondary_muscles || [])])
      )
    ].sort((a, b) => this.muscleLabel(a).localeCompare(this.muscleLabel(b)))
  );

  readonly activeExerciseFilterCount = computed(() => {
    let count = 0;
    if (this.exerciseEquipmentFilter()) {
      count += 1;
    }
    if (this.exerciseMuscleFilter()) {
      count += 1;
    }
    return count;
  });

  readonly filteredExerciseLibrary = computed(() => {
    const equipment = this.exerciseEquipmentFilter();
    const muscle = this.exerciseMuscleFilter();

    return this.exercises().filter(exercise => {
      if (equipment && exercise.equipment !== equipment) {
        return false;
      }

      if (!muscle) {
        return true;
      }

      if (exercise.primary_muscle === muscle) {
        return true;
      }

      return exercise.secondary_muscles.includes(muscle);
    });
  });

  readonly latestTenRmLabel = computed(() => {
    const latest = this.tenRmSeries()[this.tenRmSeries().length - 1];
    if (!latest) {
      return '--';
    }
    return `${Number(latest.point_value).toFixed(1)} kg`;
  });

  readonly latestSessionVolumeLabel = computed(() => {
    const latest = this.exerciseVolumeSeries()[this.exerciseVolumeSeries().length - 1];
    if (!latest) {
      return '--';
    }
    return `${Math.round(Number(latest.point_value))} kg`;
  });

  readonly progressSessionRows = computed<ExerciseProgressRow[]>(() => {
    const tenRmByDay = new Map<string, number>();
    const volumeByDay = new Map<string, number>();

    for (const point of this.tenRmSeries()) {
      tenRmByDay.set(point.point_date, Number(point.point_value));
    }
    for (const point of this.exerciseVolumeSeries()) {
      volumeByDay.set(point.point_date, Number(point.point_value));
    }

    const dates = [...new Set([...tenRmByDay.keys(), ...volumeByDay.keys()])]
      .sort((a, b) => (a < b ? 1 : -1))
      .slice(0, 8);

    return dates.map(date => ({
      date,
      tenRm: tenRmByDay.has(date) ? `${tenRmByDay.get(date)!.toFixed(1)} kg` : '--',
      volume: volumeByDay.has(date) ? `${Math.round(volumeByDay.get(date)!)} kg` : '--'
    }));
  });
  readonly currentExerciseSaveHint = computed(() => {
    const exercise = this.currentExercise();
    if (!exercise) {
      return null;
    }

    const states = exercise.sets.map(setRow => this.setSaveState()[setRow.clientRef] || 'idle');
    if (states.includes('error')) {
      return 'Einige Eingaben konnten noch nicht gespeichert werden.';
    }
    if (states.includes('saving')) {
      return 'Eingaben werden gespeichert...';
    }
    return null;
  });

  readonly recommendedSetLine = computed(() => {
    const exercise = this.currentExercise();
    if (!exercise || this.previousPerformance().length === 0) {
      return null;
    }

    const previousWorking = this.previousPerformance().filter(item => !item.is_warmup && Number(item.weight_kg || 0) > 0);
    if (previousWorking.length === 0) {
      return null;
    }

    const baseWeight = Number(previousWorking[0].weight_kg || 0);
    if (baseWeight <= 0) {
      return null;
    }

    const suggested = suggestNextWeightKg({
      targetReps: exercise.targetReps,
      currentWeightKg: baseWeight,
      sets: previousWorking.map(item => ({ reps: item.reps, isWarmup: item.is_warmup }))
    });

    const weight = suggested || baseWeight;
    const reps = exercise.targetReps || Number(previousWorking[0].reps || 0);
    const tenRm = estimateTenRm(weight, reps);

    return `${weight.toFixed(1)}kg • ${reps} reps • ${tenRm ? tenRm.toFixed(1) : '--'} 10RM`;
  });

  readonly measurementForm = inject(FormBuilder).nonNullable.group({
    type: 'weight' as TrainingMeasurementType,
    value: 70,
    measuredOn: toIsoDate(new Date())
  });

  readonly planMetaForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    daysPerWeek: [4, [Validators.required, Validators.min(1), Validators.max(7)]],
    durationWeeks: [12, [Validators.required, Validators.min(1), Validators.max(52)]],
    startDate: [toIsoDate(new Date()), Validators.required],
    isActive: [true]
  });

  readonly graphForm = inject(FormBuilder).nonNullable.group({
    graphType: ['workout_count' as TrainingGraphType, Validators.required],
    exerciseId: [''],
    muscleGroup: ['']
  });

  readonly builderDays = signal<BuilderDayDraft[]>([]);

  private readonly trainingData = inject(TrainingDataService);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly pendingSetSaves = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingSetStateResets = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlightSetSaves = new Map<string, Promise<void>>();
  private workoutSharePhoto: File | null = null;
  workoutShareNote = '';

  ngOnInit(): void {
    this.syncBuilderDayCount();
    void this.loadTrackerData();
  }

  isPlaceholderImage(url: string | null | undefined): boolean {
    return !url || /dummyimage\.com/i.test(url);
  }

  ngOnDestroy(): void {
    for (const timer of this.pendingSetSaves.values()) {
      clearTimeout(timer);
    }
    this.pendingSetSaves.clear();

    for (const timer of this.pendingSetStateResets.values()) {
      clearTimeout(timer);
    }
    this.pendingSetStateResets.clear();
  }

  async activateProgressTab(): Promise<void> {
    this.activeTab.set('progress');
    await this.loadProgressData();
  }

  onHeroTabChange(value: string): void {
    if (value === 'progress') {
      void this.activateProgressTab();
      return;
    }
    this.activeTab.set('tracker');
  }

  async loadTrackerData(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);

    try {
      await this.trainingData.flushPendingSync();
      const [dashboard, exercises, plans] = await Promise.all([
        this.trainingData.getDashboardWeek(this.selectedDate(), forceRefresh),
        this.trainingData.getExercises(forceRefresh),
        this.trainingData.getPlans(forceRefresh)
      ]);

      this.dashboardWeek.set(dashboard);
      this.exercises.set(exercises);
      this.plans.set(plans);

      if (dashboard.workoutDays.length > 0 && !this.selectedWorkoutDay()) {
        await this.openWorkoutPreview(dashboard.workoutDays[0]);
      }
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym Tracker konnte nicht geladen werden'));
    }
  }

  async loadProgressData(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);

    try {
      const [widgets, personalStats] = await Promise.all([
        this.trainingData.getProgressWidgets(forceRefresh),
        this.trainingData.getPersonalStats(forceRefresh)
      ]);

      if (this.exercises().length === 0) {
        this.exercises.set(await this.trainingData.getExercises(forceRefresh));
      }

      if (!this.selectedProgressExerciseId() && this.exercises().length > 0) {
        this.selectedProgressExerciseId.set(this.exercises()[0].id);
      }

      await this.loadSelectedExerciseProgress(forceRefresh);
      this.personalStats.set(personalStats);
      this.widgets.set(widgets.sort((a, b) => a.position - b.position));
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Progress Daten konnten nicht geladen werden'));
    }
  }

  async openWorkoutPreview(workout: TrainingDashboardDay): Promise<void> {
    this.selectedWorkoutDay.set(workout);

    try {
      const overview = await this.trainingData.getPlanOverview(workout.dayId);
      this.selectedOverview.set(overview);

      if (workout.currentSessionClientRef) {
        const activeSession = await this.trainingData.getSessionByClientRef(workout.currentSessionClientRef);
        if (activeSession && activeSession.status === 'in_progress') {
          this.activeSession.set(activeSession);
          const nextOpenIndex = this.findNextIncompleteExerciseIndex(activeSession, 0);
          this.activeExerciseIndex.set(nextOpenIndex >= 0 ? nextOpenIndex : 0);
          await this.refreshPreviousPerformance();
        }
      }
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout Vorschau konnte nicht geladen werden'));
    }
  }

  async startWorkout(): Promise<void> {
    const overview = this.selectedOverview();
    if (!overview) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const session = await this.trainingData.startSession(overview.dayId, this.selectedDate());
      this.activeSession.set(session);
      this.activeExerciseIndex.set(0);
      await this.refreshPreviousPerformance();
      this.successMessage.set('Workout gestartet.');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout konnte nicht gestartet werden'));
    }
  }

  setActiveExercise(index: number): void {
    this.activeExerciseIndex.set(index);
    void this.refreshPreviousPerformance();
  }

  goToPreviousExercise(): void {
    const previous = Math.max(0, this.activeExerciseIndex() - 1);
    if (previous === this.activeExerciseIndex()) {
      return;
    }
    this.setActiveExercise(previous);
  }

  goToNextExercise(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    const next = Math.min(session.exercises.length - 1, this.activeExerciseIndex() + 1);
    if (next === this.activeExerciseIndex()) {
      return;
    }
    this.setActiveExercise(next);
  }

  async refreshPreviousPerformance(): Promise<void> {
    const exercise = this.currentExercise();
    if (!exercise) {
      this.previousPerformance.set([]);
      return;
    }

    try {
      const previous = await this.trainingData.getPreviousPerformance(exercise.exerciseId, this.selectedDate());
      this.previousPerformance.set(previous);
    } catch {
      this.previousPerformance.set([]);
    }
  }

  onSetInput(event: Event, setRow: TrainingExecutionSet, field: 'weight' | 'reps'): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.trim();
    const numericValue = rawValue === '' ? null : Number(rawValue);

    this.updateSet(setRow.clientRef, draft => {
      if (field === 'weight') {
        draft.weightKg = numericValue;
      } else {
        draft.reps = numericValue;
      }

      draft.volume = calculateVolume(draft.weightKg, draft.reps);
      draft.estimated10Rm = estimateTenRm(draft.weightKg, draft.reps);
    });

    this.scheduleSetSave(setRow.clientRef);
  }

  async toggleSetComplete(setRow: TrainingExecutionSet): Promise<void> {
    const exercise = this.currentExercise();
    if (!exercise || !this.activeSession()) {
      return;
    }

    const nextCompleted = !setRow.isCompleted;

    this.updateSet(setRow.clientRef, draft => {
      draft.isCompleted = nextCompleted;
      draft.volume = calculateVolume(draft.weightKg, draft.reps);
      draft.estimated10Rm = estimateTenRm(draft.weightKg, draft.reps);
    });

    const currentSet = this.findSetByClientRef(setRow.clientRef);
    if (!currentSet) {
      return;
    }

    await this.persistSetLog(currentSet.clientRef);

    if (!nextCompleted) {
      return;
    }

    const updatedExercise = this.currentExercise();
    if (!updatedExercise) {
      return;
    }

    const isExerciseDone = updatedExercise.sets.every(item => item.isCompleted);
    if (!isExerciseDone) {
      return;
    }

    const updatedSession = this.activeSession();
    if (!updatedSession) {
      return;
    }

    const nextOpenIndex = this.findNextIncompleteExerciseIndex(updatedSession, this.activeExerciseIndex() + 1);
    if (nextOpenIndex >= 0) {
      this.setActiveExercise(nextOpenIndex);
      this.successMessage.set(`"${updatedExercise.name}" abgeschlossen. Weiter zur nächsten Übung.`);
      return;
    }

    const fallbackOpenIndex = this.findNextIncompleteExerciseIndex(updatedSession, 0);
    if (fallbackOpenIndex >= 0 && fallbackOpenIndex !== this.activeExerciseIndex()) {
      this.setActiveExercise(fallbackOpenIndex);
      this.successMessage.set(`"${updatedExercise.name}" abgeschlossen. Weiter zur nächsten offenen Übung.`);
      return;
    }

    if (this.areAllSessionExercisesCompleted(updatedSession)) {
      this.successMessage.set('Alle Übungen abgeschlossen. Workout jetzt beenden.');
    }
  }

  acceptRecommendation(): void {
    const recommendation = this.recommendedSetLine();
    const exercise = this.currentExercise();
    if (!recommendation || !exercise) {
      return;
    }

    const [weightToken, repsToken] = recommendation.split('•').map(token => token.trim());
    const weight = Number(weightToken.replace('kg', '').trim());
    const reps = Number(repsToken.replace('reps', '').trim());

    if (Number.isNaN(weight) || Number.isNaN(reps)) {
      return;
    }

    const firstSet = exercise.sets[0];
    if (!firstSet) {
      return;
    }

    this.updateSet(firstSet.clientRef, draft => {
      draft.weightKg = weight;
      draft.reps = reps;
      draft.volume = calculateVolume(weight, reps);
      draft.estimated10Rm = estimateTenRm(weight, reps);
    });

    this.scheduleSetSave(firstSet.clientRef);
  }

  async finishWorkout(): Promise<void> {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    this.errorMessage.set(null);

    try {
      await this.flushPendingSetSaves();
      await this.trainingData.completeSession(session.sessionClientRef);
      this.lastCompletedSessionDay.set(session.sessionDate);
      try {
        await this.prepareWorkoutShareSuggestion(session.sessionDate);
      } catch {
        this.workoutShareSuggestion.set('1/3 Workouts diese Woche');
        this.workoutShareNote = 'Gym erledigt 1/3 diese Woche 💪';
      }
      this.successMessage.set('Workout abgeschlossen.');
      this.activeSession.set(null);
      this.previousPerformance.set([]);
      await this.loadTrackerData(true);
      await this.loadProgressData(true);
      this.activeSheet.set('session-share');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout konnte nicht abgeschlossen werden'));
    }
  }

  openSheet(sheet: 'plans' | 'builder' | 'exercises' | 'help' | 'graphs' | 'graph-detail' | 'session-share'): void {
    this.activeSheet.set(sheet);
  }

  closeSheet(): void {
    if (this.activeSheet() === 'session-share') {
      this.resetWorkoutShareState();
    }
    this.activeSheet.set('none');
  }

  startPlanBuilder(): void {
    this.syncBuilderDayCount();
    this.activeSheet.set('builder');
  }

  syncBuilderDayCount(): void {
    const targetDays = Number(this.planMetaForm.controls.daysPerWeek.value || 1);
    const existing = [...this.builderDays()];

    if (existing.length < targetDays) {
      const fallbackExerciseId = this.exercises()[0]?.id || '';
      for (let i = existing.length; i < targetDays; i += 1) {
        existing.push({
          name: `Day ${i + 1}`,
          targetMuscles: '',
          exercises: fallbackExerciseId
            ? [{ exerciseId: fallbackExerciseId, sets: 3, targetReps: 8, targetSeconds: null }]
            : []
        });
      }
    } else if (existing.length > targetDays) {
      existing.length = targetDays;
    }

    this.builderDays.set(existing);
  }

  setBuilderDayName(dayIndex: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.builderDays.update(days => {
      const next = [...days];
      next[dayIndex] = { ...next[dayIndex], name: value };
      return next;
    });
  }

  setBuilderDayMuscles(dayIndex: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.builderDays.update(days => {
      const next = [...days];
      next[dayIndex] = { ...next[dayIndex], targetMuscles: value };
      return next;
    });
  }

  setBuilderExercise(
    dayIndex: number,
    exerciseIndex: number,
    field: 'exerciseId' | 'sets' | 'targetReps',
    event: Event
  ): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;

    this.builderDays.update(days => {
      const next = [...days];
      const day = { ...next[dayIndex] };
      const exercises = [...day.exercises];
      const row = { ...exercises[exerciseIndex] };

      if (field === 'exerciseId') {
        row.exerciseId = value;
      } else if (field === 'sets') {
        row.sets = Math.max(1, Number(value || 1));
      } else {
        row.targetReps = value ? Math.max(1, Number(value)) : null;
      }

      exercises[exerciseIndex] = row;
      day.exercises = exercises;
      next[dayIndex] = day;
      return next;
    });
  }

  addBuilderExercise(dayIndex: number): void {
    const fallbackExerciseId = this.exercises()[0]?.id || '';
    if (!fallbackExerciseId) {
      this.errorMessage.set('Keine Übungen vorhanden. Bitte erst eine Übung anlegen.');
      return;
    }

    this.builderDays.update(days => {
      const next = [...days];
      next[dayIndex] = {
        ...next[dayIndex],
        exercises: [
          ...next[dayIndex].exercises,
          { exerciseId: fallbackExerciseId, sets: 3, targetReps: 8, targetSeconds: null }
        ]
      };
      return next;
    });
  }

  removeBuilderExercise(dayIndex: number, exerciseIndex: number): void {
    this.builderDays.update(days => {
      const next = [...days];
      const day = next[dayIndex];
      next[dayIndex] = {
        ...day,
        exercises: day.exercises.filter((_, index) => index !== exerciseIndex)
      };
      return next;
    });
  }

  addBuilderDay(): void {
    if (this.builderDays().length >= 7) {
      return;
    }

    const fallbackExerciseId = this.exercises()[0]?.id || '';
    this.builderDays.update(days => [
      ...days,
      {
        name: `Day ${days.length + 1}`,
        targetMuscles: '',
        exercises: fallbackExerciseId
          ? [{ exerciseId: fallbackExerciseId, sets: 3, targetReps: 8, targetSeconds: null }]
          : []
      }
    ]);
  }

  async savePlan(): Promise<void> {
    if (this.planMetaForm.invalid || this.builderDays().length === 0) {
      return;
    }

    const value = this.planMetaForm.getRawValue();
    const payload: SavePlanInput = {
      name: value.name,
      daysPerWeek: Number(value.daysPerWeek),
      durationWeeks: Number(value.durationWeeks),
      startDate: value.startDate,
      isActive: Boolean(value.isActive),
      days: this.builderDays().map(day => ({
        name: day.name,
        targetMuscles: day.targetMuscles
          .split(',')
          .map(item => item.trim().toLowerCase())
          .filter(Boolean),
        exercises: day.exercises
      }))
    };

    try {
      await this.trainingData.savePlan(payload);
      this.successMessage.set('Plan gespeichert.');
      this.activeSheet.set('plans');
      await this.loadTrackerData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Plan konnte nicht gespeichert werden'));
    }
  }

  async activatePlan(planId: string): Promise<void> {
    try {
      await this.trainingData.activatePlan(planId);
      this.successMessage.set('Plan aktiviert.');
      await this.loadTrackerData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Plan konnte nicht aktiviert werden'));
    }
  }

  async saveMeasurement(): Promise<void> {
    if (this.measurementForm.invalid) {
      return;
    }

    const value = this.measurementForm.getRawValue();

    try {
      await this.trainingData.upsertMeasurement({
        type: value.type,
        value: Number(value.value),
        measuredOn: value.measuredOn
      });

      this.successMessage.set('Measurement gespeichert.');
      await this.loadProgressData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Measurement konnte nicht gespeichert werden'));
    }
  }

  async addGraphWidget(): Promise<void> {
    if (this.graphForm.invalid) {
      return;
    }

    const value = this.graphForm.getRawValue();
    const configs: Array<{
      id?: string;
      graph_type: TrainingGraphType;
      exercise_id: string | null;
      muscle_group: string | null;
      position: number;
      settings: Record<string, unknown>;
    }> = [...this.widgets()].map(item => ({
      id: item.id.startsWith('local-') ? undefined : item.id,
      graph_type: item.graph_type,
      exercise_id: item.exercise_id,
      muscle_group: item.muscle_group,
      position: item.position,
      settings: item.settings
    }));

    configs.push({
      graph_type: value.graphType,
      exercise_id: value.graphType === 'exercise_10rm' ? value.exerciseId || null : null,
      muscle_group: value.graphType === 'muscle_volume' ? (value.muscleGroup || null) : null,
      position: configs.length + 1,
      settings: {}
    });

    try {
      await this.trainingData.saveProgressWidgets(configs);
      this.graphForm.patchValue({ graphType: 'workout_count', exerciseId: '', muscleGroup: '' });
      this.successMessage.set('Graph hinzugefügt.');
      this.activeSheet.set('none');
      await this.loadProgressData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Graph konnte nicht gespeichert werden'));
    }
  }

  async openGraphDetail(widget: TrainingGraphConfig): Promise<void> {
    this.selectedDetailWidget.set(widget);
    this.detailFrom.set(toIsoDate(addDays(new Date(), -730)));
    this.detailTo.set(toIsoDate(new Date()));
    this.activeSheet.set('graph-detail');
    await this.reloadDetailSeries();
  }

  onDetailDateChange(event: Event, type: 'from' | 'to'): void {
    const value = (event.target as HTMLInputElement).value;
    if (type === 'from') {
      this.detailFrom.set(value);
    } else {
      this.detailTo.set(value);
    }
  }

  async reloadDetailSeries(): Promise<void> {
    const widget = this.selectedDetailWidget();
    if (!widget) {
      return;
    }

    const query = this.widgetToSeriesQuery(widget, this.detailFrom(), this.detailTo());
    try {
      this.detailSeries.set(await this.trainingData.getProgressSeries(query));
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Detail-Graph konnte nicht geladen werden'));
    }
  }

  goPrevWeek(): void {
    const next = addDays(new Date(`${this.selectedDate()}T00:00:00`), -7);
    this.selectedDate.set(toIsoDate(next));
    void this.loadTrackerData(true);
  }

  goNextWeek(): void {
    const next = addDays(new Date(`${this.selectedDate()}T00:00:00`), 7);
    this.selectedDate.set(toIsoDate(next));
    void this.loadTrackerData(true);
  }

  onSelectDate(dayIso: string): void {
    this.selectedDate.set(dayIso);
    const weekStart = toIsoDate(startOfIsoWeek(new Date(`${dayIso}T00:00:00`)));
    if (weekStart !== this.dashboardWeek()?.weekStart) {
      void this.loadTrackerData(true);
    }
  }

  onProgressExerciseChange(value: string): void {
    this.selectedProgressExerciseId.set(value);
    void this.loadSelectedExerciseProgress(true);
  }

  onExerciseEquipmentFilterChange(value: string): void {
    this.exerciseEquipmentFilter.set(value);
  }

  onExerciseMuscleFilterChange(value: string): void {
    this.exerciseMuscleFilter.set(value);
  }

  resetExerciseFilters(): void {
    this.exerciseEquipmentFilter.set('');
    this.exerciseMuscleFilter.set('');
  }

  onSessionSharePhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.workoutSharePhoto = input.files?.[0] || null;
    this.workoutSharePhotoName.set(this.workoutSharePhoto?.name || null);
  }

  pickSessionSharePhoto(): void {
    this.sessionSharePhotoInput()?.nativeElement.click();
  }

  async submitSessionCommunityPost(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.sharingWorkoutPost.set(true);
    this.errorMessage.set(null);

    try {
      let photoPath: string | null = null;
      if (this.workoutSharePhoto) {
        photoPath = await this.uploadGymImage(this.workoutSharePhoto, user.id);
      }

      const postDay = this.lastCompletedSessionDay() || toIsoDate(new Date());
      const { error } = await this.supabaseService.client
        .from('community_posts')
        .upsert(
          {
            user_id: user.id,
            post_type: 'gym_checkin',
            day: postDay,
            note: this.workoutShareNote.trim() || this.workoutShareSuggestion(),
            summary: {
              session_day: postDay,
              weekly_progress: this.workoutShareSuggestion()
            },
            photo_url: photoPath
          },
          { onConflict: 'user_id,day,post_type' }
        );

      if (error) {
        throw error;
      }

      this.successMessage.set('Gym-Post erstellt.');
      this.resetWorkoutShareState();
      this.activeSheet.set('none');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Community-Post konnte nicht erstellt werden'));
    } finally {
      this.sharingWorkoutPost.set(false);
    }
  }

  skipSessionShare(): void {
    this.resetWorkoutShareState();
    this.activeSheet.set('none');
  }

  equipmentLabel(equipment: string): string {
    const map: Record<string, string> = {
      barbell: 'Langhantel',
      dumbbell: 'Kurzhantel',
      machine: 'Maschine',
      cable: 'Kabel',
      bodyweight: 'Koerpergewicht',
      bands: 'Baender',
      other: 'Sonstiges'
    };

    return map[equipment] || equipment;
  }

  muscleLabel(muscle: string): string {
    const map: Record<string, string> = {
      chest: 'Brust',
      upper_chest: 'Obere Brust',
      lower_chest: 'Untere Brust',
      neck: 'Nacken',
      shoulders: 'Schultern',
      side_delts: 'Seitliche Schulter',
      rear_delts: 'Hintere Schulter',
      front_delts: 'Vordere Schulter',
      triceps: 'Trizeps',
      biceps: 'Bizeps',
      brachialis: 'Brachialis',
      forearms: 'Unterarme',
      lats: 'Latissimus',
      mid_back: 'Mittlerer Ruecken',
      upper_back: 'Oberer Ruecken',
      lower_back: 'Unterer Ruecken',
      traps: 'Trapez',
      posterior_chain: 'Rueckseite',
      quads: 'Quadrizeps',
      hamstrings: 'Hamstrings',
      glutes: 'Gesaess',
      calves: 'Waden',
      abs: 'Bauch',
      core: 'Rumpf',
      obliques: 'Seitliche Bauchmuskeln',
      serratus_anterior: 'Serratus',
      hip_flexors: 'Hueftbeuger',
      rectus_femoris: 'Rectus Femoris',
      teres_major: 'Teres Major',
      soleus: 'Soleus',
      adductors: 'Adduktoren',
      abductors: 'Abduktoren'
    };

    return map[muscle] || muscle;
  }

  targetLabel(exercise: TrainingExecutionExercise): string {
    if (exercise.targetReps) {
      return `${exercise.targetReps} reps`;
    }
    if (exercise.targetSeconds) {
      return `${exercise.targetSeconds}s`;
    }
    return '--';
  }

  muscleColor(muscle: string): string {
    const overview = this.selectedOverview();
    const targets = overview?.targetMuscles || [];
    return targets.includes(muscle) ? 'var(--m3-sys-color-primary)' : 'var(--m3-sys-color-outline-variant)';
  }

  graphTitle(widget: TrainingGraphConfig): string {
    if (widget.graph_type === 'workout_count') return 'Workout-Haeufigkeit';
    if (widget.graph_type === 'exercise_10rm') {
      const exerciseName = this.exercises().find(item => item.id === widget.exercise_id)?.name;
      return `${exerciseName || 'Uebung'} 10RM`;
    }
    if (widget.graph_type === 'muscle_volume') return `Muskelvolumen (${widget.muscle_group || 'alle'})`;
    if (widget.graph_type === 'bodyweight') return 'Koerpergewicht';
    return 'Gesamtvolumen';
  }

  graphSubtitle(widget: TrainingGraphConfig): string {
    if (widget.graph_type === 'exercise_10rm' && !widget.exercise_id) return 'Bitte Uebung waehlen';
    if (widget.graph_type === 'muscle_volume' && !widget.muscle_group) return 'Alle Muskelgruppen';
    return 'Tippen fuer erweiterte Analyse';
  }

  toLinePoints(points: TrainingGraphDataPoint[]): string {
    if (points.length === 0) {
      return '0,34 100,34';
    }

    const values = points.map(point => Number(point.point_value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 32 - ((value - min) / range) * 28;
        return `${x},${roundTo(y, 2)}`;
      })
      .join(' ');
  }

  private async loadSelectedExerciseProgress(forceRefresh = false): Promise<void> {
    const exerciseId = this.selectedProgressExerciseId();
    if (!exerciseId) {
      this.tenRmSeries.set([]);
      this.exerciseVolumeSeries.set([]);
      return;
    }

    const tenRm = await this.trainingData.getProgressSeries({
      graphType: 'exercise_10rm',
      exerciseId
    });

    let volume: TrainingGraphDataPoint[] = [];
    try {
      volume = await this.trainingData.getExerciseVolumeSeries(exerciseId, undefined, undefined, forceRefresh);
    } catch {
      volume = [];
    }

    this.tenRmSeries.set(tenRm);
    this.exerciseVolumeSeries.set(volume);
  }

  private async prepareWorkoutShareSuggestion(sessionDay: string): Promise<void> {
    const sessionDate = new Date(`${sessionDay}T00:00:00`);
    const weekStartDate = startOfIsoWeek(sessionDate);
    const weekStart = toIsoDate(weekStartDate);
    const weekEnd = toIsoDate(addDays(weekStartDate, 6));
    const completedThisWeek = await this.trainingData.getCompletedWorkoutCountForRange(weekStart, weekEnd);
    const level = Math.min(Math.max(completedThisWeek, 1), 3);
    const progressLabel = `${level}/3`;

    this.workoutShareSuggestion.set(`${progressLabel} Workouts diese Woche`);
    this.workoutShareNote = `Gym erledigt ${progressLabel} diese Woche 💪`;
  }

  private resetWorkoutShareState(): void {
    this.workoutSharePhoto = null;
    this.workoutSharePhotoName.set(null);
    this.workoutShareSuggestion.set('1/3 Workouts diese Woche');
    this.workoutShareNote = '';
    this.lastCompletedSessionDay.set(null);
    const input = this.sessionSharePhotoInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }

  private async uploadGymImage(file: File, userId: string): Promise<string> {
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;
    const { error } = await this.supabaseService.client.storage
      .from('gym-checkins')
      .upload(path, file, { upsert: true });

    if (error) {
      throw error;
    }

    return path;
  }

  private async loadSeriesForWidgets(): Promise<void> {
    const entries = await Promise.all(
      this.widgets().map(async widget => {
        const query = this.widgetToSeriesQuery(widget);
        const series = await this.trainingData.getProgressSeries(query);
        return [widget.position, series] as const;
      })
    );

    const map: Record<number, TrainingGraphDataPoint[]> = {};
    for (const [position, series] of entries) {
      map[position] = series;
    }

    this.seriesMap.set(map);
  }

  private widgetToSeriesQuery(widget: TrainingGraphConfig, from?: string, to?: string): ProgressSeriesQuery {
    return {
      graphType: widget.graph_type,
      from,
      to,
      exerciseId: widget.exercise_id,
      muscleGroup: widget.muscle_group
    };
  }

  private findSetByClientRef(clientRef: string): TrainingExecutionSet | null {
    const session = this.activeSession();
    if (!session) {
      return null;
    }

    for (const exercise of session.exercises) {
      const hit = exercise.sets.find(setRow => setRow.clientRef === clientRef);
      if (hit) {
        return hit;
      }
    }

    return null;
  }

  private findSetContext(clientRef: string): { exercise: TrainingExecutionExercise; setRow: TrainingExecutionSet } | null {
    const session = this.activeSession();
    if (!session) {
      return null;
    }

    for (const exercise of session.exercises) {
      const setRow = exercise.sets.find(setItem => setItem.clientRef === clientRef);
      if (setRow) {
        return { exercise, setRow };
      }
    }

    return null;
  }

  private isExerciseCompleted(exercise: TrainingExecutionExercise): boolean {
    return exercise.sets.length > 0 && exercise.sets.every(setRow => setRow.isCompleted);
  }

  private findNextIncompleteExerciseIndex(session: TrainingExecutionSession, startIndex: number): number {
    for (let index = Math.max(0, startIndex); index < session.exercises.length; index += 1) {
      if (!this.isExerciseCompleted(session.exercises[index])) {
        return index;
      }
    }

    return -1;
  }

  private areAllSessionExercisesCompleted(session: TrainingExecutionSession): boolean {
    return session.exercises.every(exercise => this.isExerciseCompleted(exercise));
  }

  private scheduleSetSave(clientRef: string): void {
    const pending = this.pendingSetSaves.get(clientRef);
    if (pending) {
      clearTimeout(pending);
    }

    this.markSetSaveState(clientRef, 'saving');

    const timer = setTimeout(() => {
      this.pendingSetSaves.delete(clientRef);
      void this.persistSetLog(clientRef);
    }, 420);

    this.pendingSetSaves.set(clientRef, timer);
  }

  private async persistSetLog(clientRef: string): Promise<void> {
    const session = this.activeSession();
    const context = this.findSetContext(clientRef);
    if (!session || !context) {
      return;
    }

    const task = (async () => {
      this.markSetSaveState(clientRef, 'saving');
      await this.trainingData.upsertSetLog({
        sessionClientRef: session.sessionClientRef,
        exerciseSortOrder: context.exercise.sortOrder,
        setNumber: context.setRow.setNumber,
        isWarmup: context.setRow.isWarmup,
        weightKg: context.setRow.weightKg,
        reps: context.setRow.reps,
        durationSeconds: context.setRow.durationSeconds,
        isCompleted: context.setRow.isCompleted,
        clientRef: context.setRow.clientRef
      });

      this.markSetSaveState(clientRef, 'saved');
      const existing = this.pendingSetStateResets.get(clientRef);
      if (existing) {
        clearTimeout(existing);
      }

      const resetTimer = setTimeout(() => {
        this.pendingSetStateResets.delete(clientRef);
        this.markSetSaveState(clientRef, 'idle');
      }, 1200);
      this.pendingSetStateResets.set(clientRef, resetTimer);
    })();

    this.inFlightSetSaves.set(clientRef, task);
    try {
      await task;
    } catch {
      this.markSetSaveState(clientRef, 'error');
    } finally {
      if (this.inFlightSetSaves.get(clientRef) === task) {
        this.inFlightSetSaves.delete(clientRef);
      }
    }
  }

  private async flushPendingSetSaves(): Promise<void> {
    const saves: Promise<void>[] = [];

    for (const [clientRef, timer] of this.pendingSetSaves.entries()) {
      clearTimeout(timer);
      this.pendingSetSaves.delete(clientRef);
      saves.push(this.persistSetLog(clientRef));
    }

    saves.push(...this.inFlightSetSaves.values());
    if (saves.length === 0) {
      return;
    }

    await Promise.allSettled(saves);
  }

  private markSetSaveState(clientRef: string, state: 'idle' | 'saving' | 'saved' | 'error'): void {
    this.setSaveState.update(current => {
      if (state === 'idle') {
        const { [clientRef]: removed, ...rest } = current;
        void removed;
        return rest;
      }
      return { ...current, [clientRef]: state };
    });
  }

  private updateSet(clientRef: string, updater: (setRow: TrainingExecutionSet) => void): void {
    this.activeSession.update(current => {
      if (!current) {
        return current;
      }

      const exercises = current.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(setRow => {
          if (setRow.clientRef !== clientRef) {
            return setRow;
          }
          const next = { ...setRow };
          updater(next);
          return next;
        })
      }));

      return {
        ...current,
        exercises
      };
    });
  }
}
