import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';

export type HabitState = 'empty' | 'complete' | 'missed';

@Component({
  selector: 'app-habit-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <article class="heatmap-card">
      <div class="top">
        <div class="copy">
          <span class="name">{{ label() }}</span>
          <span class="window">{{ windowLabel() }}</span>
        </div>
      </div>

      <div class="heatmap" role="list" aria-label="{{ label() }} Heatmap">
        @for (state of states(); track $index) {
          <span
            role="listitem"
            class="cell"
            [style.--index]="$index"
            [style.--accent]="accentColor()"
            [class.complete]="state === 'complete'"
            [class.missed]="state === 'missed'"
          ></span>
        }
      </div>

      <div class="footer">
        <span class="count">{{ recentCompleteCount() }}/{{ targetPerWeek() }} diese Woche</span>
        <lucide-icon [img]="chevronRightIcon" class="footer-icon" aria-hidden="true"></lucide-icon>
      </div>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .heatmap-card {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 12px;
        min-height: 0;
        aspect-ratio: 1 / 0.96;
        border-radius: 18px;
        background: rgba(20, 22, 21, 0.9);
        padding: 12px;
      }

      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .copy {
        display: grid;
        gap: 3px;
      }

      .name {
        font-size: 15px;
        line-height: 1.08;
        letter-spacing: -0.03em;
        text-transform: none;
        color: var(--ui-ink);
        font-weight: 700;
      }

      .window {
        font-size: 11px;
        color: var(--ui-ink-muted);
        font-weight: 600;
      }

      .heatmap {
        display: grid;
        grid-template-columns: repeat(10, minmax(0, 1fr));
        gap: 4px;
        align-items: center;
        align-content: center;
      }

      .cell {
        display: block;
        width: 100%;
        aspect-ratio: 1;
        min-height: 9px;
        border-radius: 3px;
        background: rgba(57, 60, 58, 0.72);
        opacity: 0;
        transform: translateY(3px);
        animation: cell-in var(--motion-duration-medium) var(--motion-easing-decelerate) both;
        animation-delay: calc(var(--index, 0) * 18ms);
      }

      .cell.complete {
        background: var(--accent, var(--ui-primary));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, var(--ui-primary)) 35%, transparent);
      }

      .cell.missed {
        background: color-mix(in srgb, var(--ui-error) 68%, rgba(57, 60, 58, 0.72));
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding-top: 8px;
        border-top: 1px solid color-mix(in srgb, var(--ui-outline) 28%, transparent);
      }

      .count {
        font-size: 12px;
        color: var(--ui-ink-muted);
        font-weight: 600;
      }

      .footer-icon {
        width: 15px;
        height: 15px;
        color: var(--ui-ink-muted);
        flex: 0 0 auto;
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

      @media (max-width: 360px) {
        .heatmap-card {
          padding: 10px;
        }

        .heatmap {
          gap: 3px;
        }

        .cell {
          min-height: 8px;
        }
      }
    `,
  ],
})
export class HabitGridComponent {
  readonly label = input.required<string>();
  readonly states = input.required<HabitState[]>();
  readonly targetPerWeek = input.required<number>();
  readonly windowLabel = input('Letzte 30 Tage');
  readonly accentColor = input('var(--ui-primary)');
  readonly chevronRightIcon = ChevronRight;

  readonly recentCompleteCount = computed(
    () =>
      this.states()
        .slice(-7)
        .filter((state) => state === 'complete').length,
  );
}
