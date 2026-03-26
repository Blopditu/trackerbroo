import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  TrainingGraphDataPoint,
  TrainingPersonalStats,
} from '../../core/training/training-data.service';
import { TrainingExercise } from '../../core/types';
import { ExerciseProgressRow, equipmentLabel, muscleLabel, toLinePoints } from './gym-view-utils';

@Component({
  selector: 'app-gym-progress-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  styleUrl: './gym-progress-tab.component.css',
  template: `
    <section class="panel progress-feature-card">
      <div class="section-copy">
        <p class="eyebrow">Übungs-Progress</p>
        <h2>Bewegung wählen, Trend lesen, weitertrainieren</h2>
        <p class="muted">
          Konzentriere dich auf eine Übung und lies sofort, ob dein stärkster Satz und dein Volumen
          steigen.
        </p>
      </div>

      <div class="progress-head">
        <mat-form-field
          class="m3-field progress-exercise-field"
          appearance="outline"
          subscriptSizing="dynamic"
        >
          <mat-label>Übung</mat-label>
          <mat-select
            id="progress-exercise"
            [value]="selectedProgressExerciseId()"
            (valueChange)="selectExercise.emit($event)"
          >
            <mat-option value="">Bitte wählen</mat-option>
            @for (exercise of exercises(); track exercise.id) {
              <mat-option [value]="exercise.id">{{ exercise.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="progress-range" role="group" aria-label="Zeitraum für Progress">
          <button
            mat-flat-button
            type="button"
            class="progress-range-btn"
            [class.active]="progressRangeDays() === 7"
            (click)="setProgressRange.emit(7)"
          >
            7 Tage
          </button>
          <button
            mat-flat-button
            type="button"
            class="progress-range-btn"
            [class.active]="progressRangeDays() === 30"
            (click)="setProgressRange.emit(30)"
          >
            30 Tage
          </button>
        </div>
      </div>

      @if (selectedProgressExercise()) {
        <div class="progress-exercise-meta">
          <p class="muted">
            {{ equipmentLabel(selectedProgressExercise()!.equipment) }} •
            {{ muscleLabel(selectedProgressExercise()!.primary_muscle) }}
          </p>
          <p class="muted">
            Tippe auf einen Graphen, um die Detailansicht für diese Übung zu öffnen.
          </p>
        </div>
      }

      <div class="progress-summary">
        <article class="summary-card">
          <p class="label">Stärkster Satz</p>
          <strong>{{ bestTenRmLabel() }}</strong>
        </article>
        <article class="summary-card">
          <p class="label">Volumen zuletzt</p>
          <strong>{{ latestSessionVolumeLabel() }}</strong>
        </article>
        <article class="summary-card">
          <p class="label">Einheiten</p>
          <strong>{{ progressSessionCountLabel() }}</strong>
        </article>
      </div>

      <div class="progress-graph-grid">
        <button
          type="button"
          class="graph-card main-graph-card"
          (click)="openProgressDetail.emit('10rm')"
          aria-label="Leistungstrend im Detail öffnen"
        >
          <div class="graph-head">
            <strong>Leistungstrend</strong>
            <span class="muted">Stärkster Satz pro Einheit • {{ progressRangeLabel() }}</span>
          </div>
          @if (tenRmSeries().length > 0) {
            <svg
              class="graph"
              viewBox="0 0 100 34"
              preserveAspectRatio="none"
              aria-label="Leistungstrend"
            >
              <polyline [attr.points]="toLinePoints(tenRmSeries())"></polyline>
            </svg>
          } @else {
            <p class="muted">Sobald du diese Übung loggst, entsteht hier dein Leistungsverlauf.</p>
          }
        </button>

        <button
          type="button"
          class="graph-card main-graph-card graph-card-volume"
          (click)="openProgressDetail.emit('volume')"
          aria-label="Volumentrend im Detail öffnen"
        >
          <div class="graph-head">
            <strong>Volumentrend</strong>
            <span class="muted">Gesamte Arbeit pro Einheit • {{ progressRangeLabel() }}</span>
          </div>
          @if (exerciseVolumeSeries().length > 0) {
            <svg
              class="graph"
              viewBox="0 0 100 34"
              preserveAspectRatio="none"
              aria-label="Volumentrend"
            >
              <polyline [attr.points]="toLinePoints(exerciseVolumeSeries())"></polyline>
            </svg>
          } @else {
            <p class="muted">
              Nach deinen ersten Einträgen siehst du hier, wie sich dein Arbeitsvolumen entwickelt.
            </p>
          }
        </button>
      </div>

      @if (progressSessionRows().length > 0) {
        <div class="previous-block previous-block-structured">
          <p class="muted">Letzte Einheiten ({{ progressRangeLabel() }})</p>
          @for (row of progressSessionRows(); track row.date) {
            <article class="session-history-row">
              <strong>{{ row.date }}</strong>
              <span>Stärkster Satz {{ row.tenRm }}</span>
              <span>Volumen {{ row.volume }}</span>
            </article>
          }
        </div>
      } @else if (selectedProgressExercise()) {
        <p class="muted">Sobald du diese Übung loggst, erscheinen hier die letzten Einheiten.</p>
      }
    </section>

    <section class="panel stats-card">
      <div class="section-copy">
        <h2>Trainingsstand</h2>
        <p class="muted">
          Rhythmus, aktiver Plan und aktuelles Körpergewicht bleiben kompakt im Blick.
        </p>
      </div>
      <div class="stats-grid">
        <article class="stat-box">
          <p class="label">Einheiten</p>
          <strong>{{ personalStats()?.totalWorkouts || 0 }}</strong>
        </article>
        <article class="stat-box">
          <p class="label">Serie</p>
          <strong>{{ personalStats()?.currentStreakWeeks || 0 }} Wochen</strong>
        </article>
        <article class="stat-box">
          <p class="label">Aktiver Plan</p>
          <strong>{{ activePlanStatLabel() }}</strong>
        </article>
        <article class="stat-box">
          <p class="label">Letztes Gewicht</p>
          <strong>{{ latestBodyweightStatLabel() }}</strong>
        </article>
      </div>
    </section>

    <section class="panel measurement-panel">
      <div class="section-copy">
        <h2>Messwert eintragen</h2>
        <p class="muted">
          Gewicht oder Umfang kurz nachtragen, ohne den eigentlichen Trainingsverlauf zu überladen.
        </p>
      </div>
      <form
        class="measurement-form"
        [formGroup]="measurementForm()"
        (ngSubmit)="saveMeasurement.emit()"
      >
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
          <input
            matInput
            id="measure-value"
            type="number"
            min="0"
            step="0.1"
            formControlName="value"
          />
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Datum</mat-label>
          <input matInput id="measure-date" type="date" formControlName="measuredOn" />
        </mat-form-field>

        <button
          mat-flat-button
          type="submit"
          class="action-btn"
          [disabled]="measurementForm().invalid"
        >
          Wert speichern
        </button>
      </form>
    </section>
  `,
})
export class GymProgressTabComponent {
  readonly personalStats = input<TrainingPersonalStats | null>(null);
  readonly activePlanStatLabel = input.required<string>();
  readonly latestBodyweightStatLabel = input.required<string>();
  readonly measurementForm = input.required<FormGroup>();
  readonly progressRangeDays = input.required<7 | 30>();
  readonly exercises = input.required<TrainingExercise[]>();
  readonly selectedProgressExerciseId = input.required<string>();
  readonly selectedProgressExercise = input<TrainingExercise | null>(null);
  readonly bestTenRmLabel = input.required<string>();
  readonly latestSessionVolumeLabel = input.required<string>();
  readonly progressSessionCountLabel = input.required<string>();
  readonly progressRangeLabel = input.required<string>();
  readonly tenRmSeries = input.required<TrainingGraphDataPoint[]>();
  readonly exerciseVolumeSeries = input.required<TrainingGraphDataPoint[]>();
  readonly progressSessionRows = input.required<ExerciseProgressRow[]>();

  readonly saveMeasurement = output<void>();
  readonly setProgressRange = output<7 | 30>();
  readonly selectExercise = output<string>();
  readonly openProgressDetail = output<'10rm' | 'volume'>();

  readonly equipmentLabel = equipmentLabel;
  readonly muscleLabel = muscleLabel;
  readonly toLinePoints = toLinePoints;
}
