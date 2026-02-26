import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="hero-wrap" aria-label="Protein progress">
      <svg viewBox="0 0 120 120" class="ring" role="img" aria-label="{{ value() }} of {{ target() }} grams">
        <circle class="track" cx="60" cy="60" r="50"></circle>
        <circle class="progress" cx="60" cy="60" r="50" [style.stroke]="accentColor()" [style.stroke-dashoffset]="dashOffset()"></circle>
      </svg>

      <div class="center">
        <strong>{{ value() }}</strong>
        <span>/{{ target() }}g</span>
      </div>
    </div>

    <p class="left">{{ leftText() }}</p>
  `,
  styles: [`
    .hero-wrap {
      position: relative;
      width: 180px;
      height: 180px;
      margin: 0 auto;
    }

    .ring {
      width: 180px;
      height: 180px;
      transform: rotate(-90deg);
    }

    .track,
    .progress {
      fill: none;
      stroke-width: 9;
    }

    .track {
      stroke: #1B202B;
    }

    .progress {
      stroke-linecap: round;
      stroke-dasharray: 314.16;
      transition: stroke-dashoffset 180ms ease;
    }

    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      color: #E6E8EC;
    }

    .center strong {
      font-size: 42px;
      line-height: 1;
      font-weight: 700;
    }

    .center span {
      margin-top: 4px;
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    .left {
      margin: 8px 0 0;
      text-align: center;
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }
  `]
})
export class HeroRingComponent {
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly accentColor = input('#5B8CFF');

  readonly dashOffset = computed(() => {
    const circumference = 2 * Math.PI * 50;
    const ratio = Math.max(0, Math.min(this.value() / Math.max(this.target(), 1), 1));
    return circumference * (1 - ratio);
  });

  readonly leftText = computed(() => {
    const left = Math.max(this.target() - this.value(), 0);
    return left > 0 ? `${left}g left today` : 'Goal reached today';
  });
}
