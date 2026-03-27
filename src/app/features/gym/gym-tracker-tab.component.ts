import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
  ChevronRight as ChevronRightSmall,
} from 'lucide-angular';
import {
  TrainingDashboardDay,
  TrainingDashboardWeek,
  TrainingPlanOverview,
} from '../../core/training/training-data.service';
import { equipmentLabel } from './gym-view-utils';

@Component({
  selector: 'app-gym-tracker-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule],
  styleUrl: './gym-tracker-tab.component.css',
  template: `
    <section class="tracker-week-card">
      <div class="tracker-week-head">
        <p class="eyebrow">Training Woche {{ activeWeekNumber() }}</p>
        <span class="tracker-week-progress">{{ completionLabel() }}</span>
      </div>

      <div class="tracker-week-nav">
        <button
          mat-icon-button
          type="button"
          class="week-btn"
          (click)="prevWeek.emit()"
          aria-label="Vorherige Woche"
        >
          <lucide-icon [img]="chevronLeftIcon" aria-hidden="true"></lucide-icon>
        </button>

        <div class="tracker-week-row" role="tablist" aria-label="Wochentage">
          @for (day of dashboardWeek()?.days || []; track day.iso; let index = $index) {
            <button
              mat-button
              type="button"
              role="tab"
              class="tracker-day"
              [class.active]="selectedDate() === day.iso"
              [class.today]="day.isToday"
              [attr.aria-selected]="selectedDate() === day.iso"
              [attr.tabindex]="selectedDate() === day.iso ? 0 : -1"
              (click)="selectDate.emit(day.iso)"
            >
              <span>{{ day.label }}</span>
              <strong>{{ dayNumber(index) }}</strong>
            </button>
          }
        </div>

        <button
          mat-icon-button
          type="button"
          class="week-btn"
          (click)="nextWeek.emit()"
          aria-label="Nächste Woche"
        >
          <lucide-icon [img]="chevronRightIcon" aria-hidden="true"></lucide-icon>
        </button>
      </div>
    </section>

    @if (!dashboardWeek()?.activePlan) {
      <section class="panel tracker-empty-card">
        <p class="eyebrow">Kein aktiver Plan</p>
        <h2>Gym zuerst strukturieren</h2>
        <p class="muted">
          Lege einen Plan an oder aktiviere einen bestehenden Split, damit der Workout-Flow direkt
          startklar ist.
        </p>
        <button
          mat-flat-button
          type="button"
          class="action-btn"
          (click)="openSessionHub.emit('plans')"
        >
          Pläne öffnen
        </button>
      </section>
    } @else if (selectedWorkoutDay() && selectedOverview()) {
      <section class="panel tracker-plan-card">
        <div class="tracker-plan-copy">
          <p class="eyebrow">Aktiver Plan</p>
          <h2>{{ dashboardWeek()!.activePlan!.name }}</h2>
          <p class="muted">
            {{ selectedOverview()!.dayName }} • Woche {{ dashboardWeek()!.activePlan!.weekNumber }}
          </p>
          @if (resumeAvailable()) {
            <p class="tracker-session-note">Workout pausiert. Du kannst genau hier weitermachen.</p>
          }
        </div>

        <div class="tracker-plan-stats" aria-label="Workout Überblick">
          <article class="tracker-plan-stat">
            <span>Übungen</span>
            <strong>{{ selectedOverview()!.totalExercises }}</strong>
          </article>
          <article class="tracker-plan-stat">
            <span>Sätze</span>
            <strong>{{ selectedOverview()!.totalSets }}</strong>
          </article>
        </div>

        <button
          mat-flat-button
          type="button"
          class="action-btn tracker-start-btn"
          (click)="resumeAvailable() ? resumeWorkout.emit() : startWorkout.emit()"
        >
          <span>{{ resumeAvailable() ? 'Workout fortsetzen' : 'Workout starten' }}</span>
          <lucide-icon
            [img]="resumeAvailable() ? resumeIcon : playIcon"
            class="icon"
            aria-hidden="true"
          ></lucide-icon>
        </button>
      </section>

      <section class="tracker-preview-block">
        <div class="tracker-preview-head">
          <div>
            <h2>Vorschau: {{ selectedOverview()!.dayName }}</h2>
            <p class="muted">{{ selectedOverview()!.planName }} • {{ musclePreviewLabel() }}</p>
          </div>
          <button
            mat-flat-button
            type="button"
            class="tracker-edit-btn"
            (click)="openSessionHub.emit('plans')"
          >
            Plan bearbeiten
          </button>
        </div>

        <div class="exercise-list">
          @for (exercise of selectedOverview()?.exercises || []; track exercise.dayExerciseId) {
            <article class="exercise-row">
              <div class="exercise-thumb" aria-hidden="true">
                @if (exercise.images.length > 0 && exercise.images[0]) {
                  <img [src]="exercise.images[0]" alt="" loading="lazy" />
                } @else {
                  <span>{{ exerciseInitial(exercise.name) }}</span>
                }
              </div>
              <div class="exercise-copy">
                <strong>{{ exercise.name }}</strong>
                <p class="muted">
                  {{ equipmentLabel(exercise.equipment) }} • {{ exercise.sets }} Sätze •
                  {{ targetSummary(exercise) }}
                </p>
              </div>
              <lucide-icon
                [img]="chevronRightSmallIcon"
                class="exercise-row-chevron"
                aria-hidden="true"
              ></lucide-icon>
            </article>
          }
        </div>
      </section>
    } @else {
      <section class="panel tracker-rest-card">
        <p class="eyebrow">Ausgewählter Tag</p>
        <h2>{{ selectedDateLabel() }}</h2>
        <p class="muted">
          Für diesen Tag ist kein Workout geplant. Wähle einen anderen Trainingstag oder passe den
          Split im Plan-Hub an.
        </p>
        <button mat-flat-button type="button" class="action-btn ghost" (click)="openSessionHub.emit('plans')">
          Pläne öffnen
        </button>
      </section>
    }
  `,
})
export class GymTrackerTabComponent {
  readonly dashboardWeek = input<TrainingDashboardWeek | null>(null);
  readonly selectedDate = input.required<string>();
  readonly selectedWorkoutDay = input<TrainingDashboardDay | null>(null);
  readonly selectedOverview = input<TrainingPlanOverview | null>(null);
  readonly resumeAvailable = input(false);

  readonly prevWeek = output<void>();
  readonly nextWeek = output<void>();
  readonly selectDate = output<string>();
  readonly openSessionHub = output<'plans' | 'exercises' | 'help'>();
  readonly startWorkout = output<void>();
  readonly resumeWorkout = output<void>();

  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly playIcon = Play;
  readonly resumeIcon = RotateCcw;
  readonly chevronRightSmallIcon = ChevronRightSmall;
  readonly equipmentLabel = equipmentLabel;

  activeWeekNumber(): number {
    return this.dashboardWeek()?.activePlan?.weekNumber ?? 0;
  }

  completionLabel(): string {
    const workoutDays = this.dashboardWeek()?.workoutDays ?? [];
    if (workoutDays.length === 0) {
      return 'Kein Split aktiv';
    }

    const completed = workoutDays.filter((day) => day.completed).length;
    return `${Math.round((completed / workoutDays.length) * 100)}% abgeschlossen`;
  }

  dayNumber(index: number): number {
    return index + 1;
  }

  selectedDateLabel(): string {
    return this.dashboardWeek()?.days.find((day) => day.iso === this.selectedDate())?.label || '--';
  }

  musclePreviewLabel(): string {
    const overview = this.selectedOverview();
    if (!overview || overview.targetMuscles.length === 0) {
      return `${overview?.totalExercises ?? 0} Übungen`;
    }

    return overview.targetMuscles.slice(0, 2).join(' • ');
  }

  targetSummary(exercise: TrainingPlanOverview['exercises'][number]): string {
    return exercise.targetReps ? `${exercise.targetReps} Wdh` : `${exercise.targetSeconds ?? 0}s`;
  }

  exerciseInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }
}
