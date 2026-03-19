import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TrainingExercise } from '../../core/types';
import { BuilderDayDraft } from './gym-builder-helpers';

export interface BuilderExerciseChange {
  dayIndex: number;
  exerciseIndex: number;
  field: 'exerciseId' | 'sets' | 'targetReps';
  value: string;
}

@Component({
  selector: 'app-gym-plan-builder-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  styles: [`
    .builder-day h3 {
      margin: 0;
      font-size: 16px;
    }
  `],
  template: `
    <form class="sheet-stack" [formGroup]="planMetaForm()" (ngSubmit)="savePlan.emit()">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Plan Name</mat-label>
        <input matInput id="plan-name" type="text" formControlName="name">
      </mat-form-field>

      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Frequenz</mat-label>
        <mat-select id="plan-days" formControlName="daysPerWeek" (valueChange)="syncDayCount.emit()">
          @for (freq of frequencies(); track freq) {
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

      <label class="switch-row plan-active-toggle">
        <input type="checkbox" formControlName="isActive">
        <span>Als aktiven Plan setzen</span>
      </label>

      @for (day of builderDays(); track $index; let dayIndex = $index) {
        <section class="list-card builder-day">
          <h3>Day {{ dayIndex + 1 }}</h3>
          <input type="text" [value]="day.name" (input)="dayNameChange.emit({ dayIndex, value: valueOf($event) })" placeholder="Day Name">
          <input
            type="text"
            [value]="day.targetMuscles"
            (input)="dayMusclesChange.emit({ dayIndex, value: valueOf($event) })"
            placeholder="Zielmuskeln (Komma-getrennt)"
          >

          @for (exercise of day.exercises; track $index; let exerciseIndex = $index) {
            <div class="sheet-stack builder-exercise">
              <select
                [value]="exercise.exerciseId"
                (change)="exerciseChange.emit({ dayIndex, exerciseIndex, field: 'exerciseId', value: valueOf($event) })"
              >
                @for (option of exercises(); track option.id) {
                  <option [value]="option.id">{{ option.name }}</option>
                }
              </select>
              <input
                type="number"
                min="1"
                [value]="exercise.sets"
                (input)="exerciseChange.emit({ dayIndex, exerciseIndex, field: 'sets', value: valueOf($event) })"
              >
              <input
                type="number"
                min="1"
                [value]="exercise.targetReps ?? ''"
                (input)="exerciseChange.emit({ dayIndex, exerciseIndex, field: 'targetReps', value: valueOf($event) })"
                placeholder="Wdh"
              >
              <button mat-flat-button type="button" class="action-btn ghost" (click)="removeExercise.emit({ dayIndex, exerciseIndex })">
                Entfernen
              </button>
            </div>
          }

          <button mat-flat-button type="button" class="action-btn ghost" (click)="addExercise.emit(dayIndex)">Übung hinzufügen</button>
        </section>
      }

      <button mat-flat-button type="button" class="action-btn ghost" [disabled]="builderDays().length >= 7" (click)="addDay.emit()">
        Tag hinzufuegen
      </button>
      <button mat-flat-button type="submit" class="action-btn" [disabled]="planMetaForm().invalid || builderDays().length === 0">
        Plan speichern
      </button>
    </form>
  `
})
export class GymPlanBuilderSheetComponent {
  readonly planMetaForm = input.required<FormGroup>();
  readonly frequencies = input.required<number[]>();
  readonly builderDays = input.required<BuilderDayDraft[]>();
  readonly exercises = input.required<TrainingExercise[]>();

  readonly syncDayCount = output<void>();
  readonly dayNameChange = output<{ dayIndex: number; value: string }>();
  readonly dayMusclesChange = output<{ dayIndex: number; value: string }>();
  readonly exerciseChange = output<BuilderExerciseChange>();
  readonly addExercise = output<number>();
  readonly removeExercise = output<{ dayIndex: number; exerciseIndex: number }>();
  readonly addDay = output<void>();
  readonly savePlan = output<void>();

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
