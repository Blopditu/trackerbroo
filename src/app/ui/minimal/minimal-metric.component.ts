import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-minimal-metric',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <article class="metric" [class.metric-accent]="accent()">
      <span>{{ label() }}</span>
      <strong>{{ value() }}</strong>
    </article>
  `,
  styles: [`
    .metric {
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--bg-surface-2);
      padding: 0.45rem;
      display: grid;
      gap: 0.1rem;
    }

    .metric span {
      font-size: var(--text-xs);
      color: var(--ink-500);
      font-weight: 700;
    }

    .metric strong {
      font-size: 0.95rem;
      line-height: 1.1;
    }

    .metric-accent {
      border-color: var(--accent-500);
      background: var(--accent-soft);
    }
  `]
})
export class MinimalMetricComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly accent = input(false);
}
