import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DetailChartPoint, toLinePoints } from './gym-view-utils';
import { TrainingGraphDataPoint } from '../../core/training/training-data.service';

@Component({
  selector: 'app-gym-graph-detail-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  styles: [`
    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .progress-range {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
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

    @media (max-width: 420px) {
      .grid-two {
        grid-template-columns: 1fr;
      }
    }
  `],
  template: `
    @if (hasDetailContext()) {
      <div class="sheet-stack">
        <strong>{{ title() }}</strong>
        <div class="grid-two">
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Von</mat-label>
            <input matInput id="detail-from" type="date" [value]="detailFrom()" (input)="dateChange.emit({ type: 'from', value: valueOf($event) })">
          </mat-form-field>
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Bis</mat-label>
            <input matInput id="detail-to" type="date" [value]="detailTo()" (input)="dateChange.emit({ type: 'to', value: valueOf($event) })">
          </mat-form-field>
        </div>
        <div class="progress-range" role="group" aria-label="Zeitraum für Detailgraph">
          <button mat-flat-button type="button" class="progress-range-btn" (click)="setRangeDays.emit(30)">30 Tage</button>
          <button mat-flat-button type="button" class="progress-range-btn" (click)="setRangeDays.emit(90)">90 Tage</button>
          <button mat-flat-button type="button" class="progress-range-btn" (click)="setRangeDays.emit(365)">365 Tage</button>
        </div>
        <button mat-flat-button type="button" class="action-btn ghost" (click)="reload.emit()">Neu laden</button>

        @if (detailSeries().length > 0) {
          <svg class="graph detail" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Detailgraph">
            <polyline [attr.points]="toLinePoints(detailSeries())"></polyline>
            @for (point of detailChartPoints(); track point.date) {
              <circle
                class="detail-dot"
                [class.active]="selectedDetailPointDate() === point.date"
                [attr.cx]="point.x"
                [attr.cy]="point.y"
                r="2"
                tabindex="0"
                role="button"
                [attr.aria-label]="detailPointLabel(point)"
                (click)="selectPoint.emit(point.date)"
                (keydown)="onPointKeydown($event, point.date)"
              ></circle>
            }
          </svg>
          <p class="muted">{{ selectedDetailPointSummary() }}</p>
        } @else {
          <p class="muted">Keine Daten für den gewählten Zeitraum.</p>
        }
      </div>
    }
  `
})
export class GymGraphDetailSheetComponent {
  readonly title = input.required<string>();
  readonly hasDetailContext = input.required<boolean>();
  readonly detailFrom = input.required<string>();
  readonly detailTo = input.required<string>();
  readonly detailSeries = input.required<TrainingGraphDataPoint[]>();
  readonly detailChartPoints = input.required<DetailChartPoint[]>();
  readonly selectedDetailPointDate = input<string | null>(null);
  readonly selectedDetailPointSummary = input.required<string>();

  readonly dateChange = output<{ type: 'from' | 'to'; value: string }>();
  readonly setRangeDays = output<30 | 90 | 365>();
  readonly reload = output<void>();
  readonly selectPoint = output<string>();

  readonly toLinePoints = toLinePoints;

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  detailPointLabel(point: DetailChartPoint): string {
    return `${point.date}: ${Number(point.value).toFixed(1)}`;
  }

  onPointKeydown(event: KeyboardEvent, pointDate: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectPoint.emit(pointDate);
    }
  }
}
