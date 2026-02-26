import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type HabitState = 'empty' | 'complete' | 'missed';

@Component({
  selector: 'app-habit-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="top">
      <span class="name">{{ label() }}</span>
      <span class="count">{{ completeCount() }}/{{ targetPerWeek() }} this week</span>
    </div>

    <div class="days" role="list" aria-label="{{ label() }} weekly grid">
      @for (day of dayLabels(); track day) {
        <span class="day-label">{{ day }}</span>
      }
      @for (state of states(); track $index) {
        <span role="listitem" class="cell" [class.complete]="state === 'complete'" [class.missed]="state === 'missed'"></span>
      }
    </div>
  `,
  styles: [`
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .name {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #A4A9B6;
      font-weight: 700;
    }

    .count {
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    .days {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }

    .day-label {
      font-size: 11px;
      color: #6E7483;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .cell {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      min-height: 10px;
      max-height: 12px;
      background: #1B202B;
    }

    .cell.complete {
      background: #3DBB78;
    }

    .cell.missed {
      background: #E35D5D;
    }
  `]
})
export class HabitGridComponent {
  readonly label = input.required<string>();
  readonly states = input.required<HabitState[]>();
  readonly targetPerWeek = input.required<number>();

  readonly dayLabels = input(['M', 'T', 'W', 'T', 'F', 'S', 'S']);

  readonly completeCount = computed(() => this.states().filter(state => state === 'complete').length);
}
