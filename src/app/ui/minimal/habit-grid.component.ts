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
      <span class="count">{{ completeCount() }}/{{ targetPerWeek() }} diese Woche</span>
    </div>

    <div class="days" role="list" aria-label="{{ label() }} Wochenraster">
      @for (day of dayLabels(); track day) {
        <span class="day-label">{{ day }}</span>
      }
      @for (state of states(); track $index) {
        <span
          role="listitem"
          class="cell"
          [style.--index]="$index"
          [class.complete]="state === 'complete'"
          [class.missed]="state === 'missed'"
        ></span>
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
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 700;
    }

    .count {
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .days {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }

    .day-label {
      font-size: 11px;
      color: color-mix(in srgb, var(--m3-sys-color-on-surface-variant) 72%, transparent);
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
      background: var(--m3-sys-color-surface-container-highest);
      border-radius: 999px;
      opacity: 0;
      transform: translateY(3px);
      animation: cell-in var(--motion-duration-medium) var(--motion-easing-decelerate) both;
      animation-delay: calc(var(--index, 0) * 24ms);
    }

    .cell.complete {
      background: var(--success-500);
    }

    .cell.missed {
      background: var(--m3-sys-color-error);
    }

    @keyframes cell-in {
      from {
        opacity: 0;
        transform: translateY(3px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class HabitGridComponent {
  readonly label = input.required<string>();
  readonly states = input.required<HabitState[]>();
  readonly targetPerWeek = input.required<number>();

  readonly dayLabels = input(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);

  readonly completeCount = computed(() => this.states().filter(state => state === 'complete').length);
}
