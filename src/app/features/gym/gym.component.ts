import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-gym',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule, BottomSheetComponent],
  template: `
    <main class="page gym-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <header class="panel hero">
        <p class="title-font">Gym</p>
        <h1>Krafttracker</h1>
        <div class="tabs" role="tablist" aria-label="Gym Tabs">
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'tracker'" [class.active]="activeTab() === 'tracker'" (click)="activeTab.set('tracker')">
            <lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon>
            Tracker
          </button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'progress'" [class.active]="activeTab() === 'progress'" (click)="activateProgressTab()">
            <lucide-icon [img]="icons.barChart" class="icon" aria-hidden="true"></lucide-icon>
            Progress
          </button>
          <a routerLink="/profile" role="tab" aria-selected="false">
            <lucide-icon [img]="icons.user" class="icon" aria-hidden="true"></lucide-icon>
            Profile
          </a>
        </div>
      </header>

      @if (activeTab() === 'tracker') {
        <section class="panel">
          <div class="week-nav">
            <button type="button" class="week-btn" (click)="goPrevWeek()" aria-label="Vorherige Woche">
              <lucide-icon [img]="icons.chevronLeft" aria-hidden="true"></lucide-icon>
            </button>
            <div class="week-scroll" role="tablist" aria-label="Wochentage">
              @for (day of dashboardWeek()?.days || []; track day.iso) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="selectedDate() === day.iso"
                  [class.day-pill]="true"
                  [class.active]="selectedDate() === day.iso"
                  [class.today]="day.isToday"
                  (click)="onSelectDate(day.iso)"
                >
                  {{ day.label }}
                </button>
              }
            </div>
            <button type="button" class="week-btn" (click)="goNextWeek()" aria-label="Nächste Woche">
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
                <p class="muted">Week {{ dashboardWeek()!.activePlan!.weekNumber }}</p>
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
                        <img [src]="thumb" alt="" loading="lazy" decoding="async">
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
            <button type="button" class="action-btn ghost" (click)="openSheet('plans')">Alle Plaene</button>
            <button type="button" class="action-btn ghost" (click)="openSheet('exercises')">Uebungen</button>
            <button type="button" class="action-btn ghost" (click)="openSheet('help')">Hilfe</button>
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
              <button type="button" class="action-btn" (click)="startWorkout()">
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
                  <img [src]="exercise.images[0] || placeholderImage" alt="{{ exercise.name }}" loading="lazy" decoding="async">
                  <div>
                    <strong>{{ exercise.name }}</strong>
                    <p class="muted">{{ equipmentLabel(exercise.equipment) }} • {{ exercise.sets }} x {{ exercise.targetReps ? exercise.targetReps : (exercise.targetSeconds + 's') }}</p>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        @if (activeSession()) {
          <section class="panel execution">
            <div class="execution-head">
              <h2>Workout-Ausfuehrung</h2>
              <span class="mono-badge">Einheit {{ activeSession()!.sessionDate }}</span>
            </div>

            <div class="exercise-tabs" role="tablist" aria-label="Übungen">
              @for (exercise of activeSession()!.exercises; track exercise.sessionExerciseId) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeExerciseIndex() === $index"
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
                      <button type="button" class="check-btn" [class.done]="setRow.isCompleted" (click)="toggleSetComplete(setRow)">
                        <lucide-icon [img]="icons.check" aria-hidden="true"></lucide-icon>
                      </button>
                    </div>
                  }
                </div>

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

            <button type="button" class="action-btn" (click)="finishWorkout()">Workout abschließen</button>
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
            <label for="measure-type">Measurement</label>
            <select id="measure-type" formControlName="type">
              <option value="weight">Weight</option>
              <option value="bodyfat">Bodyfat</option>
              <option value="waist">Waist</option>
              <option value="chest">Chest</option>
            </select>

            <label for="measure-value">Value</label>
            <input id="measure-value" type="number" min="0" step="0.1" formControlName="value">

            <label for="measure-date">Datum</label>
            <input id="measure-date" type="date" formControlName="measuredOn">

            <button type="submit" class="action-btn" [disabled]="measurementForm.invalid">Wert speichern</button>
          </form>
        </section>

        <section class="panel">
          <div class="progress-head">
            <h2>Progress</h2>
            <button type="button" class="action-btn ghost" (click)="openSheet('graphs')">
              <lucide-icon [img]="icons.plus" class="icon" aria-hidden="true"></lucide-icon>
              Graph hinzufuegen
            </button>
          </div>

          @for (widget of widgets(); track widget.position + '-' + widget.graph_type + '-' + (widget.exercise_id || '') + '-' + (widget.muscle_group || '')) {
            <article class="graph-card" (click)="openGraphDetail(widget)">
              <div class="graph-head">
                <strong>{{ graphTitle(widget) }}</strong>
                <span class="muted">{{ graphSubtitle(widget) }}</span>
              </div>

              @if ((seriesMap()[widget.position] || []).length > 0) {
                <svg class="graph" viewBox="0 0 100 34" preserveAspectRatio="none" aria-label="Graph">
                  <polyline [attr.points]="toLinePoints(seriesMap()[widget.position] || [])"></polyline>
                </svg>
              } @else {
                <p class="muted">Noch keine Daten für diesen Graph.</p>
              }
            </article>
          }

          @if (widgets().length === 0) {
            <p class="muted">Füge deinen ersten Graph hinzu.</p>
          }
        </section>
      }

      <button class="gym-fab" type="button" (click)="openSheet(activeTab() === 'tracker' ? 'plans' : 'graphs')" aria-label="Schnellaktion">
        <lucide-icon [img]="icons.plus" class="fab-icon" aria-hidden="true"></lucide-icon>
      </button>
    </main>

    <app-bottom-sheet [open]="activeSheet() === 'plans'" title="Alle Plaene" (closed)="closeSheet()">
      <div class="sheet-stack">
        <button type="button" class="action-btn" (click)="startPlanBuilder()">Neuen Plan erstellen</button>
        @for (plan of plans(); track plan.id) {
          <article class="sheet-card">
            <div>
              <strong>{{ plan.name }}</strong>
              <p class="muted">{{ plan.days_per_week }} Tage • {{ plan.duration_weeks }} Wochen</p>
            </div>
            <button type="button" class="action-btn ghost" [disabled]="plan.is_active" (click)="activatePlan(plan.id)">
              {{ plan.is_active ? 'Aktiv' : 'Aktivieren' }}
            </button>
          </article>
        }
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'builder'" title="Plan Builder" (closed)="closeSheet()">
      <form class="sheet-stack" [formGroup]="planMetaForm" (ngSubmit)="savePlan()">
        <label for="plan-name">Plan Name</label>
        <input id="plan-name" type="text" formControlName="name">

        <label for="plan-days">Frequenz</label>
        <select id="plan-days" formControlName="daysPerWeek" (change)="syncBuilderDayCount()">
          @for (freq of frequencies; track freq) {
            <option [value]="freq">{{ freq }}x pro Woche</option>
          }
        </select>

        <label for="plan-weeks">Dauer (Wochen)</label>
        <input id="plan-weeks" type="number" min="1" max="52" formControlName="durationWeeks">

        <label for="plan-start">Startdatum</label>
        <input id="plan-start" type="date" formControlName="startDate">

        <label class="switch-row">
          <input type="checkbox" formControlName="isActive">
          Als aktiven Plan setzen
        </label>

        @for (day of builderDays(); track $index; let dayIndex = $index) {
          <section class="builder-day">
            <h3>Day {{ dayIndex + 1 }}</h3>
            <input type="text" [value]="day.name" (input)="setBuilderDayName(dayIndex, $event)" placeholder="Day Name">
            <input type="text" [value]="day.targetMuscles" (input)="setBuilderDayMuscles(dayIndex, $event)" placeholder="Zielmuskeln (Komma-getrennt)">

            @for (exercise of day.exercises; track $index; let exerciseIndex = $index) {
              <div class="builder-exercise">
                <select [value]="exercise.exerciseId" (change)="setBuilderExercise(dayIndex, exerciseIndex, 'exerciseId', $event)">
                  @for (option of exercises(); track option.id) {
                    <option [value]="option.id">{{ option.name }}</option>
                  }
                </select>
                <input type="number" min="1" [value]="exercise.sets" (input)="setBuilderExercise(dayIndex, exerciseIndex, 'sets', $event)">
                <input type="number" min="1" [value]="exercise.targetReps ?? ''" (input)="setBuilderExercise(dayIndex, exerciseIndex, 'targetReps', $event)" placeholder="Wdh">
                <button type="button" class="action-btn ghost" (click)="removeBuilderExercise(dayIndex, exerciseIndex)">Entfernen</button>
              </div>
            }

            <button type="button" class="action-btn ghost" (click)="addBuilderExercise(dayIndex)">Uebung hinzufuegen</button>
          </section>
        }

        <button type="button" class="action-btn ghost" [disabled]="builderDays().length >= 7" (click)="addBuilderDay()">Tag hinzufuegen</button>
        <button type="submit" class="action-btn" [disabled]="planMetaForm.invalid || builderDays().length === 0">Plan speichern</button>
      </form>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'exercises'" title="Uebungen" (closed)="closeSheet()">
      <div class="sheet-stack">
        <form class="sheet-card" [formGroup]="customExerciseForm" (ngSubmit)="saveCustomExercise()">
          <strong>Eigene Uebung</strong>
          <input type="text" formControlName="name" placeholder="Name">
          <select formControlName="equipment">
            @for (equipment of equipmentOptions; track equipment) {
              <option [value]="equipment">{{ equipmentLabel(equipment) }}</option>
            }
          </select>
          <input type="text" formControlName="primaryMuscle" placeholder="Primaerer Muskel">
          <input type="text" formControlName="secondaryMuscles" placeholder="Sekundaere Muskeln (Komma-getrennt)">
          <input type="text" formControlName="images" placeholder="Bild-URLs (Komma-getrennt)">
          <button type="submit" class="action-btn" [disabled]="customExerciseForm.invalid">Speichern</button>
        </form>

        <div class="sheet-scroll-list">
          @for (exercise of filteredExerciseLibrary(); track exercise.id) {
            <article class="sheet-card">
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
        <article class="sheet-card text-only">
          <strong>Quick Logging</strong>
          <p class="muted">Gewicht wird aus dem letzten Workout als Empfehlung vorgeschlagen.</p>
        </article>
        <article class="sheet-card text-only">
          <strong>Smart Suggestions</strong>
          <p class="muted">Wenn alle Arbeitssätze das Ziel erreichen, wird +2.5kg fürs nächste Mal vorgeschlagen.</p>
        </article>
        <article class="sheet-card text-only">
          <strong>Offline First</strong>
          <p class="muted">Alle Schreibaktionen werden offline lokal gespeichert und automatisch synchronisiert.</p>
        </article>
      </div>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graphs'" title="Graph hinzufuegen" (closed)="closeSheet()">
      <form class="sheet-stack" [formGroup]="graphForm" (ngSubmit)="addGraphWidget()">
        <label for="graph-type">Graph-Typ</label>
        <select id="graph-type" formControlName="graphType">
          <option value="workout_count">Workouts pro Woche</option>
          <option value="exercise_10rm">Uebung 10RM Verlauf</option>
          <option value="muscle_volume">Muskelgruppen-Volumen</option>
          <option value="bodyweight">Koerpergewicht</option>
          <option value="total_volume">Gesamtvolumen</option>
        </select>

        @if (graphForm.value.graphType === 'exercise_10rm') {
          <label for="graph-exercise">Uebung</label>
          <select id="graph-exercise" formControlName="exerciseId">
            <option value="">Bitte wählen</option>
            @for (exercise of exercises(); track exercise.id) {
              <option [value]="exercise.id">{{ exercise.name }}</option>
            }
          </select>
        }

        @if (graphForm.value.graphType === 'muscle_volume') {
          <label for="graph-muscle">Muskelgruppe</label>
          <input id="graph-muscle" type="text" formControlName="muscleGroup" placeholder="z.B. quads">
        }

        <button type="submit" class="action-btn" [disabled]="graphForm.invalid">Graph hinzufügen</button>
      </form>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graph-detail'" title="Erweiterte Analyse" (closed)="closeSheet()">
      @if (selectedDetailWidget()) {
        <div class="sheet-stack">
          <strong>{{ graphTitle(selectedDetailWidget()!) }}</strong>
          <div class="grid-two">
            <div>
              <label for="detail-from">Von</label>
              <input id="detail-from" type="date" [value]="detailFrom()" (input)="onDetailDateChange($event, 'from')">
            </div>
            <div>
              <label for="detail-to">Bis</label>
              <input id="detail-to" type="date" [value]="detailTo()" (input)="onDetailDateChange($event, 'to')">
            </div>
          </div>
          <button type="button" class="action-btn ghost" (click)="reloadDetailSeries()">Neu laden</button>

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
    .gym-page {
      background: #0F1115;
      color: #E6E8EC;
      gap: 12px;
      padding: 16px;
    }

    .panel {
      display: grid;
      gap: 12px;
      background: #151922;
      border: 1px solid #1B202B;
      padding: 14px;
      border-radius: 12px;
    }

    .hero h1 {
      margin: 0;
      font-size: 22px;
    }

    .tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .tabs button,
    .tabs a {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #A4A9B6;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 8px;
    }

    .tabs button.active {
      background: #1B202B;
      color: #E6E8EC;
      border-color: #5B8CFF;
    }

    .icon {
      width: 16px;
      height: 16px;
    }

    .week-nav {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      gap: 8px;
      align-items: center;
    }

    .week-btn {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      display: grid;
      place-items: center;
    }

    .week-scroll {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: thin;
      padding-bottom: 4px;
    }

    .day-pill {
      min-height: 42px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #A4A9B6;
      font-size: 12px;
      font-weight: 700;
      padding: 0 10px;
      white-space: nowrap;
    }

    .day-pill.active {
      border-color: #5B8CFF;
      background: #1B202B;
      color: #E6E8EC;
    }

    .day-pill.today {
      box-shadow: inset 0 0 0 1px #3DBB78;
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
      gap: 8px;
    }

    .workout-day {
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px;
      text-align: left;
      width: 100%;
    }

    .workout-day.completed {
      border-color: #3DBB78;
      background: #12251b;
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
      border: 1px solid #1B202B;
      border-radius: 8px;
      background: #0F1115;
    }

    .thumb-more {
      font-size: 12px;
      color: #A4A9B6;
      font-weight: 700;
    }

    .check-icon {
      color: #3DBB78;
      width: 16px;
      height: 16px;
      justify-self: end;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .overview-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
    }

    .muted {
      margin: 0;
      color: #A4A9B6;
      font-size: 13px;
      font-weight: 600;
    }

    .body-diagram {
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
      display: grid;
      place-items: center;
    }

    .exercise-list {
      display: grid;
      gap: 8px;
    }

    .exercise-row {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 10px;
      align-items: center;
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
    }

    .execution-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .exercise-tabs {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .exercise-tabs button {
      min-height: 36px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #A4A9B6;
      font-size: 12px;
      font-weight: 700;
      padding: 0 10px;
      white-space: nowrap;
    }

    .exercise-tabs button.active {
      color: #E6E8EC;
      border-color: #5B8CFF;
      background: #1B202B;
    }

    .exercise-detail {
      display: grid;
      gap: 10px;
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
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
      border-radius: 10px;
    }

    .recommended-row {
      min-height: 42px;
      border: 1px solid #3DBB78;
      background: #11241a;
      color: #d7f3e3;
      font-weight: 700;
      text-align: left;
      padding: 0 12px;
    }

    .set-table {
      border: 1px solid #1B202B;
      display: grid;
      gap: 6px;
      padding: 8px;
      background: #121721;
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
      color: #A4A9B6;
      font-weight: 700;
    }

    .table-row input {
      min-height: 36px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 0 8px;
    }

    .check-btn {
      min-height: 36px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #A4A9B6;
      display: grid;
      place-items: center;
    }

    .check-btn.done {
      border-color: #3DBB78;
      color: #3DBB78;
      background: #11241a;
    }

    .previous-block {
      border-top: 1px solid #1B202B;
      padding-top: 8px;
      display: grid;
      gap: 4px;
    }

    .previous-row {
      margin: 0;
      font-size: 13px;
      color: #E6E8EC;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .stat-box {
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
      display: grid;
      gap: 4px;
    }

    .label {
      margin: 0;
      color: #A4A9B6;
      font-size: 12px;
      font-weight: 700;
    }

    .measurement-form {
      display: grid;
      gap: 6px;
      margin-top: 8px;
    }

    .measurement-form input,
    .measurement-form select,
    .sheet-stack input,
    .sheet-stack select {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 0 10px;
    }

    .progress-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .graph-card {
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
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
      border: 1px solid #1B202B;
      background: #11161f;
    }

    .graph.detail {
      height: 120px;
    }

    .graph polyline {
      fill: none;
      stroke: #5B8CFF;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .gym-fab {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(96px + env(safe-area-inset-bottom));
      width: 56px;
      height: 56px;
      border: 1px solid #1B202B;
      background: #5B8CFF;
      color: #0F1115;
      display: grid;
      place-items: center;
      z-index: 35;
      padding: 0;
    }

    .fab-icon {
      width: 24px;
      height: 24px;
    }

    .sheet-stack {
      display: grid;
      gap: 8px;
    }

    .sheet-card {
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .sheet-card.text-only {
      gap: 4px;
    }

    .sheet-card img {
      width: 52px;
      height: 52px;
    }

    .sheet-scroll-list {
      display: grid;
      gap: 8px;
      max-height: 46vh;
      overflow-y: auto;
    }

    .builder-day {
      display: grid;
      gap: 8px;
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
    }

    .builder-day h3 {
      margin: 0;
      font-size: 16px;
    }

    .builder-exercise {
      display: grid;
      gap: 6px;
    }

    .switch-row {
      display: flex;
      gap: 8px;
      align-items: center;
      color: #A4A9B6;
      font-size: 13px;
      font-weight: 700;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    @media (max-width: 420px) {
      .quick-actions {
        grid-template-columns: 1fr;
      }

      .table-head,
      .table-row {
        grid-template-columns: 24px 1fr 1fr 1fr 44px;
      }
    }
  `]
})
export class GymComponent implements OnInit {
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

  readonly activeSheet = signal<'none' | 'plans' | 'builder' | 'exercises' | 'help' | 'graphs' | 'graph-detail'>('none');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly currentExercise = computed<TrainingExecutionExercise | null>(() => {
    const session = this.activeSession();
    if (!session) {
      return null;
    }
    return session.exercises[this.activeExerciseIndex()] || null;
  });

  readonly filteredExerciseLibrary = computed(() => this.exercises().slice(0, 120));

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

  readonly customExerciseForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    equipment: ['dumbbell' as TrainingExercise['equipment'], Validators.required],
    primaryMuscle: ['chest', Validators.required],
    secondaryMuscles: ['triceps,front_delts'],
    images: ['https://dummyimage.com/640x360/1b202b/a4a9b6&text=Eigene+Uebung']
  });

  readonly graphForm = inject(FormBuilder).nonNullable.group({
    graphType: ['workout_count' as TrainingGraphType, Validators.required],
    exerciseId: [''],
    muscleGroup: ['']
  });

  readonly builderDays = signal<BuilderDayDraft[]>([]);

  private readonly trainingData = inject(TrainingDataService);

  ngOnInit(): void {
    this.syncBuilderDayCount();
    void this.loadTrackerData();
  }

  async activateProgressTab(): Promise<void> {
    this.activeTab.set('progress');
    await this.loadProgressData();
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

      this.widgets.set(widgets.sort((a, b) => a.position - b.position));
      this.personalStats.set(personalStats);
      await this.loadSeriesForWidgets();
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
          this.activeExerciseIndex.set(0);
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
  }

  async toggleSetComplete(setRow: TrainingExecutionSet): Promise<void> {
    const exercise = this.currentExercise();
    const session = this.activeSession();
    if (!exercise || !session) {
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

    await this.trainingData.upsertSetLog({
      sessionClientRef: session.sessionClientRef,
      exerciseSortOrder: exercise.sortOrder,
      setNumber: currentSet.setNumber,
      isWarmup: currentSet.isWarmup,
      weightKg: currentSet.weightKg,
      reps: currentSet.reps,
      durationSeconds: currentSet.durationSeconds,
      isCompleted: currentSet.isCompleted,
      clientRef: currentSet.clientRef
    });
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
  }

  async finishWorkout(): Promise<void> {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    this.errorMessage.set(null);

    try {
      await this.trainingData.completeSession(session.sessionClientRef);
      this.successMessage.set('Workout abgeschlossen.');
      this.activeSession.set(null);
      this.previousPerformance.set([]);
      await this.loadTrackerData(true);
      await this.loadProgressData(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout konnte nicht abgeschlossen werden'));
    }
  }

  openSheet(sheet: 'plans' | 'builder' | 'exercises' | 'help' | 'graphs' | 'graph-detail'): void {
    this.activeSheet.set(sheet);
  }

  closeSheet(): void {
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

  async saveCustomExercise(): Promise<void> {
    if (this.customExerciseForm.invalid) {
      return;
    }

    const value = this.customExerciseForm.getRawValue();

    try {
      await this.trainingData.createCustomExercise({
        name: value.name,
        equipment: value.equipment,
        type: value.equipment,
        primaryMuscle: value.primaryMuscle.trim().toLowerCase(),
        secondaryMuscles: value.secondaryMuscles
          .split(',')
          .map(item => item.trim().toLowerCase())
          .filter(Boolean),
        images: value.images
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      });

      this.customExerciseForm.patchValue({
        name: '',
        secondaryMuscles: '',
        images: 'https://dummyimage.com/640x360/1b202b/a4a9b6&text=Eigene+Uebung'
      });

      this.successMessage.set('Übung gespeichert.');
      this.exercises.set(await this.trainingData.getExercises(true));
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Übung konnte nicht gespeichert werden'));
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
      hip_flexors: 'Hueftbeuger',
      rectus_femoris: 'Rectus Femoris',
      teres_major: 'Teres Major',
      soleus: 'Soleus'
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
    return targets.includes(muscle) ? '#5B8CFF' : '#1B202B';
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
