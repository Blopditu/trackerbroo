import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-macro-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="label-row">
      <span>{{ label() }}</span>
      <strong>{{ value() }} / {{ target() }}{{ unit() }}</strong>
    </div>
    <div class="bar">
      <div class="fill" [style.width.%]="progress()" [style.background]="color()"></div>
    </div>
  `,
  styles: [`
    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
      margin-bottom: 4px;
    }

    .label-row strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 13px;
      font-weight: 600;
    }

    .bar {
      height: 8px;
      background: var(--m3-sys-color-surface-container-highest);
      overflow: hidden;
      border-radius: 999px;
    }

    .fill {
      height: 100%;
      border-radius: 999px;
      transition: width var(--motion-duration-medium) var(--motion-easing-decelerate);
    }
  `]
})
export class MacroBarComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly unit = input('g');
  readonly color = input('var(--m3-sys-color-primary)');

  readonly progress = computed(() => Math.max(0, Math.min((this.value() / Math.max(this.target(), 1)) * 100, 100)));
}
