import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-minimal-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <section class="panel min-section">
      @if (title()) {
        <div class="min-head">
          <h2>{{ title() }}</h2>
          @if (badge()) {
            <span class="mono-badge">{{ badge() }}</span>
          }
        </div>
      }
      <ng-content />
    </section>
  `,
  styles: [`
    .min-section {
      display: grid;
      gap: 0.55rem;
      padding: 0.85rem;
    }

    .min-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }

    h2 {
      margin: 0;
      font-size: var(--text-sm);
      font-weight: 800;
      color: var(--ink-700);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  `]
})
export class MinimalSectionComponent {
  readonly title = input<string>('');
  readonly badge = input<string>('');
}
