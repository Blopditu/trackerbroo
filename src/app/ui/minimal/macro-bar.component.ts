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
      color: #A4A9B6;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .label-row strong {
      color: #E6E8EC;
      font-size: 13px;
      font-weight: 600;
    }

    .bar {
      height: 6px;
      background: #1B202B;
      overflow: hidden;
      border-radius: 2px;
    }

    .fill {
      height: 100%;
      transition: width 180ms ease;
    }
  `]
})
export class MacroBarComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly unit = input('g');
  readonly color = input('#5B8CFF');

  readonly progress = computed(() => Math.max(0, Math.min((this.value() / Math.max(this.target(), 1)) * 100, 100)));
}
