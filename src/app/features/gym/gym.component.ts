import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BarChart3, Dumbbell, LucideAngularModule, User } from 'lucide-angular';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { GymFacadeService } from './gym-facade.service';
import { GymExecutionPanelComponent, GymSetInputChange } from './gym-execution-panel.component';
import { GymGraphDetailSheetComponent } from './gym-graph-detail-sheet.component';
import { GymPlanBuilderSheetComponent } from './gym-plan-builder-sheet.component';
import { GymProgressTabComponent } from './gym-progress-tab.component';
import { GymSessionHubSheetComponent } from './gym-session-hub-sheet.component';
import { GymSessionShareSheetComponent } from './gym-session-share-sheet.component';
import { GymTrackerTabComponent } from './gym-tracker-tab.component';

@Component({
  selector: 'app-gym',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [GymFacadeService],
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
    BottomSheetComponent,
    GymTrackerTabComponent,
    GymExecutionPanelComponent,
    GymProgressTabComponent,
    GymSessionHubSheetComponent,
    GymPlanBuilderSheetComponent,
    GymGraphDetailSheetComponent,
    GymSessionShareSheetComponent
  ],
  template: `
    <main class="page gym-page">
      @if (facade.errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ facade.errorMessage() }}</p>
      }

      @if (facade.successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ facade.successMessage() }}</p>
      }

      <header class="panel hero">
        <p class="title-font">Gym</p>
        <h1>Krafttracker</h1>
        <div class="hero-controls">
          <div class="gym-tabs" role="tablist" aria-label="Gym Ansicht">
            <button
              type="button"
              role="tab"
              class="gym-tab-btn"
              [class.active]="activeTab() === 'tracker'"
              [attr.aria-selected]="activeTab() === 'tracker'"
              [attr.tabindex]="activeTab() === 'tracker' ? 0 : -1"
              (click)="onHeroTabChange('tracker')"
            >
              <lucide-icon [img]="dumbbellIcon" class="icon" aria-hidden="true"></lucide-icon>
              Tracker
            </button>
            <button
              type="button"
              role="tab"
              class="gym-tab-btn"
              [class.active]="activeTab() === 'progress'"
              [attr.aria-selected]="activeTab() === 'progress'"
              [attr.tabindex]="activeTab() === 'progress' ? 0 : -1"
              (click)="onHeroTabChange('progress')"
            >
              <lucide-icon [img]="barChartIcon" class="icon" aria-hidden="true"></lucide-icon>
              Progress
            </button>
          </div>
          <button mat-icon-button type="button" class="hero-profile-btn" routerLink="/profile" aria-label="Profil öffnen">
            <lucide-icon [img]="userIcon" class="icon" aria-hidden="true"></lucide-icon>
          </button>
        </div>
      </header>

      @if (activeTab() === 'tracker' && !facade.activeSession()) {
        <app-gym-tracker-tab
          [dashboardWeek]="facade.dashboardWeek()"
          [selectedDate]="facade.selectedDate()"
          [selectedOverview]="facade.selectedOverview()"
          (prevWeek)="facade.goPrevWeek()"
          (nextWeek)="facade.goNextWeek()"
          (selectDate)="facade.onSelectDate($event)"
          (openWorkout)="facade.openWorkoutPreview($event)"
          (openSessionHub)="openSessionHub($event)"
          (startWorkout)="facade.startWorkout()"
        />
      }

      @if (activeTab() === 'tracker' && facade.activeSession()) {
        <app-gym-execution-panel
          [session]="facade.activeSession()"
          [activeExerciseIndex]="facade.activeExerciseIndex()"
          [currentExercise]="facade.currentExercise()"
          [previousPerformance]="facade.previousPerformance()"
          [currentExerciseSaveHint]="facade.currentExerciseSaveHint()"
          (selectExercise)="facade.setActiveExercise($event)"
          (setInput)="onSetInput($event)"
          (toggleSetComplete)="facade.toggleSetComplete($event)"
          (previousExercise)="facade.goToPreviousExercise()"
          (nextExercise)="facade.goToNextExercise()"
          (finishWorkout)="onFinishWorkout()"
        />
      }

      @if (activeTab() === 'progress') {
        <app-gym-progress-tab
          [personalStats]="facade.personalStats()"
          [activePlanStatLabel]="facade.activePlanStatLabel()"
          [latestBodyweightStatLabel]="facade.latestBodyweightStatLabel()"
          [measurementForm]="facade.measurementForm"
          [progressRangeDays]="facade.progressRangeDays()"
          [exercises]="facade.exercises()"
          [selectedProgressExerciseId]="facade.selectedProgressExerciseId()"
          [selectedProgressExercise]="facade.selectedProgressExercise()"
          [bestTenRmLabel]="facade.bestTenRmLabel()"
          [latestSessionVolumeLabel]="facade.latestSessionVolumeLabel()"
          [progressSessionCountLabel]="facade.progressSessionCountLabel()"
          [progressRangeLabel]="facade.progressRangeLabel()"
          [tenRmSeries]="facade.tenRmSeries()"
          [progressSessionRows]="facade.progressSessionRows()"
          (saveMeasurement)="facade.saveMeasurement(true)"
          (setProgressRange)="facade.setProgressRangeDays($event)"
          (selectExercise)="facade.onProgressExerciseChange($event)"
          (openProgressDetail)="openProgressDetail($event)"
        />
      }
    </main>

    <app-bottom-sheet [open]="activeSheet() === 'hub'" [title]="sessionHubTitle()" (closed)="closeSheet()">
      <app-gym-session-hub-sheet
        [tab]="sessionHubTab()"
        [plans]="facade.plans()"
        [activeExerciseFilterCount]="facade.activeExerciseFilterCount()"
        [exerciseEquipmentFilter]="facade.exerciseEquipmentFilter()"
        [exerciseMuscleFilter]="facade.exerciseMuscleFilter()"
        [exerciseEquipmentOptions]="facade.exerciseEquipmentOptions()"
        [exerciseMuscleOptions]="facade.exerciseMuscleOptions()"
        [filteredExerciseLibrary]="facade.filteredExerciseLibrary()"
        [exercisesCount]="facade.exercises().length"
        (tabChange)="sessionHubTab.set($event)"
        (startPlanBuilder)="startPlanBuilder()"
        (activatePlan)="facade.activatePlan($event)"
        (equipmentFilterChange)="facade.onExerciseEquipmentFilterChange($event)"
        (muscleFilterChange)="facade.onExerciseMuscleFilterChange($event)"
        (resetFilters)="facade.resetExerciseFilters()"
      />
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'builder'" [closeOnBackdrop]="false" title="Plan Builder" (closed)="closeSheet()">
      <app-gym-plan-builder-sheet
        [planMetaForm]="facade.planMetaForm"
        [frequencies]="facade.frequencies"
        [builderDays]="facade.builderDays()"
        [exercises]="facade.exercises()"
        (syncDayCount)="facade.syncBuilderDayCount()"
        (dayNameChange)="facade.setBuilderDayName($event.dayIndex, $event.value)"
        (dayMusclesChange)="facade.setBuilderDayMuscles($event.dayIndex, $event.value)"
        (exerciseChange)="facade.setBuilderExercise($event.dayIndex, $event.exerciseIndex, $event.field, $event.value)"
        (addExercise)="facade.addBuilderExercise($event)"
        (removeExercise)="facade.removeBuilderExercise($event.dayIndex, $event.exerciseIndex)"
        (addDay)="facade.addBuilderDay()"
        (savePlan)="onSavePlan()"
      />
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'session-share'" [closeOnBackdrop]="false" title="Workout teilen" (closed)="closeSheet()">
      <app-gym-session-share-sheet
        [suggestion]="facade.workoutShareSuggestion()"
        [note]="facade.workoutShareNote()"
        [photoName]="facade.workoutSharePhotoName()"
        [sharing]="facade.sharingWorkoutPost()"
        (noteChange)="facade.setWorkoutShareNote($event)"
        (photoChange)="facade.setWorkoutSharePhoto($event)"
        (submit)="submitSessionCommunityPost()"
        (skip)="skipSessionShare()"
      />
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graphs'" [closeOnBackdrop]="false" title="Graph hinzufuegen" (closed)="closeSheet()">
      <form class="sheet-stack" [formGroup]="facade.graphForm" (ngSubmit)="onAddGraphWidget()">
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Graph-Typ</mat-label>
          <mat-select id="graph-type" formControlName="graphType">
            <mat-option value="workout_count">Workouts pro Woche</mat-option>
            <mat-option value="exercise_10rm">Übung: 10RM-Verlauf</mat-option>
            <mat-option value="muscle_volume">Muskelgruppen-Volumen</mat-option>
            <mat-option value="bodyweight">Koerpergewicht</mat-option>
            <mat-option value="total_volume">Gesamtvolumen</mat-option>
          </mat-select>
        </mat-form-field>

        @if (facade.graphForm.value.graphType === 'exercise_10rm') {
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Übung</mat-label>
            <mat-select id="graph-exercise" formControlName="exerciseId">
              <mat-option value="">Bitte wählen</mat-option>
              @for (exercise of facade.exercises(); track exercise.id) {
                <mat-option [value]="exercise.id">{{ exercise.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (facade.graphForm.value.graphType === 'muscle_volume') {
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Muskelgruppe</mat-label>
            <input matInput id="graph-muscle" type="text" formControlName="muscleGroup" placeholder="z.B. quads">
          </mat-form-field>
        }

        <button mat-flat-button type="submit" class="action-btn" [disabled]="facade.graphForm.invalid">Graph hinzufügen</button>
      </form>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="activeSheet() === 'graph-detail'" [title]="facade.detailSheetTitle()" (closed)="closeSheet()">
      <app-gym-graph-detail-sheet
        [title]="facade.detailSheetTitle()"
        [hasDetailContext]="facade.hasDetailContext()"
        [detailFrom]="facade.detailFrom()"
        [detailTo]="facade.detailTo()"
        [detailSeries]="facade.detailSeries()"
        [detailChartPoints]="facade.detailChartPoints()"
        [selectedDetailPointDate]="facade.selectedDetailPointDate()"
        [selectedDetailPointSummary]="facade.selectedDetailPointSummary()"
        (dateChange)="facade.onDetailDateChange($event.value, $event.type)"
        (setRangeDays)="facade.setDetailRangeDays($event)"
        (reload)="facade.reloadDetailSeries()"
        (selectPoint)="facade.selectDetailPointDate($event)"
      />
    </app-bottom-sheet>
  `,
  styles: [`
    .hero h1 {
      margin: 0;
      font-size: clamp(1.95rem, 4vw, 2.4rem);
      line-height: 1.04;
    }

    .hero-controls {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
    }

    .gym-tabs {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 4px;
    }

    .gym-tab-btn {
      min-height: var(--touch-target);
      border-radius: 999px;
      border: 0;
      background: transparent;
      color: var(--m3-sys-color-on-surface-variant);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 700;
    }

    .gym-tab-btn.active {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    .plan-active-toggle input {
      width: 18px;
      height: 18px;
      accent-color: var(--m3-sys-color-primary);
      flex: 0 0 auto;
    }

    .hero-profile-btn {
      width: var(--touch-target);
      height: var(--touch-target);
      border-radius: 999px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
    }

    .quick-start-strip {
      display: grid;
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
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
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
      border-color: color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      background: var(--m3-sys-color-surface-container-high);
      box-shadow: inset 3px 0 0 color-mix(in srgb, var(--success-500) 88%, transparent);
    }

    .left,
    .right {
      display: grid;
      gap: 6px;
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

    .exercise-list {
      display: grid;
      gap: 10px;
    }

    .exercise-row {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 10px;
      align-items: center;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 65%, transparent);
      border-radius: 18px;
      background: color-mix(in srgb, var(--m3-sys-color-surface-container-high) 88%, var(--m3-sys-color-surface-container));
      padding: 12px;
    }

    .exercise-status {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 76%, transparent);
      background: var(--m3-sys-color-surface-container);
      color: var(--m3-sys-color-on-surface-variant);
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 700;
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

    .execution-actions .action-btn {
      width: 100%;
      min-width: 0;
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

    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .detail-pill {
      min-height: 32px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      background: var(--m3-sys-color-surface-container);
      color: var(--m3-sys-color-on-surface-variant);
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
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
      grid-template-columns: 30px 1fr 1fr 52px;
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
      min-width: 0;
      width: 100%;
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

    .progress-range {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      min-width: 170px;
    }

    .progress-range-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
      justify-content: center;
      width: 100%;
    }

    .progress-range-btn.active {
      border-color: transparent;
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    .section-copy {
      display: grid;
      gap: 4px;
      margin-bottom: 12px;
    }

    .section-copy h2 {
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .stat-box,
    .summary-card {
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 72%, transparent);
      border-radius: 18px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
      display: grid;
      gap: 6px;
    }

    .stat-box strong,
    .summary-card strong {
      font-size: 18px;
      line-height: 1.15;
    }

    .label {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
    }

    .measurement-panel .measurement-form {
      display: grid;
      gap: 10px;
    }

    .progress-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .graph-card {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
      display: grid;
      gap: 8px;
      cursor: pointer;
      width: 100%;
      text-align: left;
      color: var(--m3-sys-color-on-surface);
    }

    .main-graph-card {
      margin-top: 4px;
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

    .detail-dot {
      fill: var(--m3-sys-color-surface-container-highest);
      stroke: var(--m3-sys-color-primary);
      stroke-width: 0.8;
      cursor: pointer;
    }

    .detail-dot.active {
      fill: var(--m3-sys-color-primary);
      transform: scale(1.2);
      transform-origin: center;
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

    .hub-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 8px;
    }

    .hub-tab-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
      justify-content: center;
      width: 100%;
    }

    .hub-tab-btn.active {
      border-color: transparent;
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    .sheet-card img,
    .sheet-image-fallback {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      flex: 0 0 auto;
    }

    .sheet-card img {
      object-fit: cover;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container);
    }

    .sheet-image-fallback {
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 75%, transparent);
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      display: grid;
      place-items: center;
    }

    .sheet-image-fallback lucide-icon {
      width: 20px;
      height: 20px;
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

    @media (max-width: 640px) {
      .execution-head {
        align-items: flex-start;
      }

      .execution-head .mono-badge {
        flex-shrink: 0;
      }

      .exercise-detail {
        gap: 10px;
        padding: 12px;
      }

      .set-table {
        padding: 10px;
      }

      .table-head,
      .table-row {
        grid-template-columns: 24px minmax(0, 1.15fr) minmax(0, 0.85fr) 44px;
        gap: 6px;
      }

      .table-row input {
        padding-inline: 8px;
      }

      .execution-actions {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
      }

      .execution-actions .action-btn {
        min-height: var(--touch-target-compact);
        padding-inline: 14px;
      }

      .execution-actions .action-btn:last-child {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 420px) {
      .hero-controls {
        grid-template-columns: 1fr;
      }

      .hero-profile-btn {
        justify-self: end;
      }

      .quick-start-strip {
        grid-template-columns: 1fr;
      }

      .quick-actions {
        grid-template-columns: 1fr;
      }

      .execution-head {
        flex-direction: column;
      }

      .execution-head .mono-badge {
        align-self: flex-start;
      }

      .exercise-detail h3 {
        font-size: 17px;
        line-height: 1.15;
      }

      .detail-meta {
        gap: 6px;
      }

      .detail-pill {
        padding-inline: 10px;
      }

      .execution-actions {
        grid-template-columns: 1fr 1fr;
      }

      .progress-head {
        flex-direction: column;
        align-items: stretch;
      }

      .progress-range {
        min-width: 0;
      }

      .progress-summary {
        grid-template-columns: 1fr;
      }

      .hub-tabs {
        grid-template-columns: 1fr;
      }

      .table-head,
      .table-row {
        grid-template-columns: 20px minmax(0, 1fr) minmax(0, 72px) 40px;
        gap: 6px;
      }

      .table-head {
        font-size: 11px;
      }

      .table-row input {
        font-size: 16px;
      }

      .execution-actions .action-btn {
        font-size: 13px;
        padding-inline: 12px;
      }

      .execution-actions .action-btn:last-child {
        grid-column: 1 / -1;
      }
    }
  `]
})
export class GymComponent implements OnInit, OnDestroy {
  readonly facade = inject(GymFacadeService);

  readonly activeTab = signal<'tracker' | 'progress'>('tracker');
  readonly activeSheet = signal<'none' | 'hub' | 'builder' | 'graphs' | 'graph-detail' | 'session-share'>('none');
  readonly sessionHubTab = signal<'plans' | 'exercises' | 'help'>('plans');

  readonly dumbbellIcon = Dumbbell;
  readonly barChartIcon = BarChart3;
  readonly userIcon = User;

  ngOnInit(): void {
    this.facade.init();
  }

  ngOnDestroy(): void {
    this.facade.destroy();
  }

  async onHeroTabChange(value: 'tracker' | 'progress'): Promise<void> {
    if (value === 'progress') {
      this.activeTab.set('progress');
      await this.facade.activateProgressTab();
      return;
    }
    this.activeTab.set('tracker');
  }

  openSessionHub(tab: 'plans' | 'exercises' | 'help'): void {
    this.sessionHubTab.set(tab);
    this.activeSheet.set('hub');
  }

  startPlanBuilder(): void {
    this.facade.syncBuilderDayCount();
    this.activeSheet.set('builder');
  }

  sessionHubTitle(): string {
    const tab = this.sessionHubTab();
    if (tab === 'plans') {
      return 'Session-Hub: Pläne';
    }
    if (tab === 'exercises') {
      return 'Session-Hub: Übungen';
    }
    return 'Session Hub: Hilfe';
  }

  closeSheet(): void {
    if (this.activeSheet() === 'session-share') {
      this.facade.resetWorkoutShareState();
    }
    if (this.activeSheet() === 'graph-detail') {
      this.facade.clearDetailSelection();
    }
    this.activeSheet.set('none');
  }

  onSetInput(change: GymSetInputChange): void {
    this.facade.onSetInput(change.setRow, change.field, change.value);
  }

  async onFinishWorkout(): Promise<void> {
    const completed = await this.facade.finishWorkout(false);
    if (completed) {
      this.activeSheet.set('session-share');
    }
  }

  async onSavePlan(): Promise<void> {
    const saved = await this.facade.savePlan();
    if (saved) {
      this.sessionHubTab.set('plans');
      this.activeSheet.set('hub');
    }
  }

  async onAddGraphWidget(): Promise<void> {
    const added = await this.facade.addGraphWidget(this.activeTab() === 'progress');
    if (added) {
      this.activeSheet.set('none');
    }
  }

  async openProgressDetail(kind: '10rm' | 'volume'): Promise<void> {
    this.activeSheet.set('graph-detail');
    await this.facade.openProgressDetail(kind);
  }

  async submitSessionCommunityPost(): Promise<void> {
    const shared = await this.facade.submitSessionCommunityPost();
    if (shared) {
      this.activeSheet.set('none');
    }
  }

  skipSessionShare(): void {
    this.facade.resetWorkoutShareState();
    this.activeSheet.set('none');
  }
}
