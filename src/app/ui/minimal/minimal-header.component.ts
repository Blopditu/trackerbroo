import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-minimal-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <header class="panel halftone min-header">
      @if (eyebrow()) {
        <p class="min-eyebrow">{{ eyebrow() }}</p>
      }
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p class="min-subtitle">{{ subtitle() }}</p>
      }
      <ng-content />
    </header>
  `,
  styles: [`
    .min-header {
      display: grid;
      gap: 0.45rem;
      padding: 0.85rem;
    }

    .min-eyebrow {
      margin: 0;
      font-size: var(--text-xs);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ink-500);
      font-weight: 800;
    }

    h1 {
      margin: 0;
      font-size: 1.45rem;
      line-height: 1.1;
    }

    .min-subtitle {
      margin: 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 700;
    }
  `]
})
export class MinimalHeaderComponent {
  readonly eyebrow = input<string>('');
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
