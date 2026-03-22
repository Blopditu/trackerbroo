import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="hero-wrap" [class.goal-reached]="value() >= target()" aria-label="Proteinfortschritt">
      <svg viewBox="0 0 120 120" class="ring" role="img" aria-label="{{ value() }} von {{ target() }} Gramm">
        <circle class="track" cx="60" cy="60" r="50"></circle>
        <circle class="progress" cx="60" cy="60" r="50" [style.stroke]="accentColor()" [style.stroke-dashoffset]="dashOffset()"></circle>
      </svg>

      <div class="center">
        <strong>{{ value() }}</strong>
        <span>/{{ target() }}g</span>
      </div>
    </div>

    @if (showLeftText()) {
      <p class="left">{{ leftText() }}</p>
    }
  `,
  styles: [`
    :host {
      display: block;
      border: 0;
      outline: 0;
      box-shadow: none;
    }

    .hero-wrap {
      position: relative;
      width: 180px;
      height: 180px;
      margin: 0 auto;
      border: 0;
      outline: 0;
      box-shadow: none;
      transition: transform var(--motion-duration-medium) var(--motion-easing-standard);
    }

    .ring {
      width: 180px;
      height: 180px;
      border: 0;
      outline: 0;
      box-shadow: none;
      transform: rotate(-90deg);
    }

    .track,
    .progress {
      fill: none;
      stroke-width: 9;
    }

    .track {
      stroke: var(--m3-sys-color-surface-container-highest);
    }

    .progress {
      stroke-linecap: round;
      stroke-dasharray: 314.16;
      transition:
        stroke-dashoffset var(--motion-duration-medium) var(--motion-easing-decelerate),
        stroke var(--motion-duration-short) var(--motion-easing-standard);
    }

    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      color: var(--m3-sys-color-on-surface);
    }

    .center strong {
      font-size: 42px;
      line-height: 1;
      font-weight: 700;
      transition: transform var(--motion-duration-short) var(--motion-easing-standard);
    }

    .center span {
      margin-top: 4px;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .left {
      margin: 8px 0 0;
      text-align: center;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .hero-wrap.goal-reached {
      transform: scale(1.015);
    }

    .hero-wrap.goal-reached .center strong {
      transform: translateY(-1px);
    }
  `]
})
export class HeroRingComponent {
  readonly value = input.required<number>();
  readonly target = input.required<number>();
  readonly accentColor = input('var(--m3-sys-color-primary)');
  readonly showLeftText = input(true);

  readonly dashOffset = computed(() => {
    const circumference = 2 * Math.PI * 50;
    const ratio = Math.max(0, Math.min(this.value() / Math.max(this.target(), 1), 1));
    return circumference * (1 - ratio);
  });

  readonly leftText = computed(() => {
    const left = Math.max(this.target() - this.value(), 0);
    return left > 0 ? `Heute noch ${left}g offen` : 'Tagesziel erreicht';
  });
}
