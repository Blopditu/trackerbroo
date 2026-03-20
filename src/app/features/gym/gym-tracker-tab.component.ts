import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule, Check, ChevronLeft, ChevronRight, Play } from 'lucide-angular';
import { TrainingDashboardDay, TrainingDashboardWeek, TrainingPlanOverview } from '../../core/training/training-data.service';
import { equipmentLabel } from './gym-view-utils';

@Component({
  selector: 'app-gym-tracker-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule],
  styleUrl: './gym-tracker-tab.component.css',
  template: `
    @if (selectedOverview()) {
      <section class="panel quick-start-strip session-launch-card" aria-label="Schnellstart">
        <div class="quick-start-copy">
          <p class="eyebrow">Heute bereit</p>
          <strong>{{ selectedOverview()!.dayName }}</strong>
          <p class="muted">{{ selectedOverview()!.planName }} • {{ selectedOverview()!.totalExercises }} Übungen • {{ selectedOverview()!.totalSets }} Sätze</p>
          <div class="launch-preview">
            @for (exercise of previewExercises(); track exercise.dayExerciseId) {
              <span class="launch-preview-pill">{{ exercise.name }}</span>
            }
          </div>
        </div>
        <button mat-flat-button type="button" class="action-btn launch-btn" (click)="startWorkout.emit()">
          <lucide-icon [img]="playIcon" class="icon" aria-hidden="true"></lucide-icon>
          Session starten
        </button>
      </section>
    }

    <section class="panel">
      <div class="week-nav">
        <button mat-icon-button type="button" class="week-btn" (click)="prevWeek.emit()" aria-label="Vorherige Woche">
          <lucide-icon [img]="chevronLeftIcon" aria-hidden="true"></lucide-icon>
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
              (click)="selectDate.emit(day.iso)"
            >
              {{ day.label }}
            </button>
          }
        </div>
        <button mat-icon-button type="button" class="week-btn" (click)="nextWeek.emit()" aria-label="Nächste Woche">
          <lucide-icon [img]="chevronRightIcon" aria-hidden="true"></lucide-icon>
        </button>
      </div>
    </section>

    <section class="panel">
      @if (dashboardWeek()?.activePlan) {
        <div class="active-plan-head">
          <div>
            <p class="eyebrow">Aktiver Plan</p>
            <h2>{{ dashboardWeek()!.activePlan!.name }}</h2>
            <p class="muted">Woche {{ dashboardWeek()!.activePlan!.weekNumber }} • Öffne den passenden Tag und starte direkt</p>
          </div>
          <span class="mono-badge">{{ dashboardWeek()!.activePlan!.durationWeeks }} Wochen</span>
        </div>

        <div class="workout-days">
          @for (workout of dashboardWeek()?.workoutDays || []; track workout.dayId) {
            <button type="button" class="workout-day" [class.completed]="workout.completed" (click)="openWorkout.emit(workout)">
              <div class="left">
                <strong>{{ workout.dayNumber }} {{ workout.name }}</strong>
                <p class="muted">{{ workout.exerciseCount }} Übungen • {{ workout.completed ? 'Bereits geloggt' : 'Sofort bereit' }}</p>
              </div>
              <div class="right">
                <span>{{ workout.completed ? 'Erledigt' : 'Öffnen' }}</span>
                @if (workout.completed) {
                  <lucide-icon [img]="checkIcon" class="check-icon" aria-hidden="true"></lucide-icon>
                }
              </div>
            </button>
          }
        </div>
      } @else {
        <p class="muted">Noch kein Trainingsplan aktiv. Erstelle deinen ersten Plan.</p>
      }

      <div class="quick-actions">
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openSessionHub.emit('plans')">Pläne</button>
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openSessionHub.emit('exercises')">Übungen</button>
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openSessionHub.emit('help')">Hilfe</button>
      </div>
    </section>

    @if (selectedOverview()) {
      <section class="panel">
        <div class="overview-head">
          <div>
            <p class="eyebrow">Workout im Überblick</p>
            <h2>{{ selectedOverview()!.dayName }}</h2>
            <p class="muted">{{ selectedOverview()!.planName }} • Woche {{ selectedOverview()!.weekNumber }}</p>
            <p class="muted">{{ selectedOverview()!.totalExercises }} Übungen • {{ selectedOverview()!.totalSets }} Sätze</p>
          </div>
          <button mat-flat-button type="button" class="action-btn" (click)="startWorkout.emit()">
            <lucide-icon [img]="playIcon" class="icon" aria-hidden="true"></lucide-icon>
            Start
          </button>
        </div>

        <div class="exercise-list">
          @for (exercise of selectedOverview()?.exercises || []; track exercise.dayExerciseId; let exerciseIndex = $index) {
            <article class="exercise-row">
              <span class="exercise-status" aria-hidden="true">{{ exerciseIndex + 1 }}</span>
              <div>
                <strong>{{ exercise.name }}</strong>
                <p class="muted">{{ equipmentLabel(exercise.equipment) }} • {{ exercise.sets }} x {{ exercise.targetReps ? exercise.targetReps : (exercise.targetSeconds + 's') }}</p>
              </div>
            </article>
          }
        </div>
      </section>
    }
  `
})
export class GymTrackerTabComponent {
  readonly dashboardWeek = input<TrainingDashboardWeek | null>(null);
  readonly selectedDate = input.required<string>();
  readonly selectedOverview = input<TrainingPlanOverview | null>(null);

  readonly prevWeek = output<void>();
  readonly nextWeek = output<void>();
  readonly selectDate = output<string>();
  readonly openWorkout = output<TrainingDashboardDay>();
  readonly openSessionHub = output<'plans' | 'exercises' | 'help'>();
  readonly startWorkout = output<void>();

  readonly chevronLeftIcon = ChevronLeft;
  readonly chevronRightIcon = ChevronRight;
  readonly checkIcon = Check;
  readonly playIcon = Play;
  readonly equipmentLabel = equipmentLabel;

  previewExercises(): TrainingPlanOverview['exercises'] {
    return this.selectedOverview()?.exercises.slice(0, 4) ?? [];
  }
}
