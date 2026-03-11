import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <p class="brand">Tracker Broo</p>
    </header>
  `,
  styles: [`
    .top-bar {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(100%, 480px);
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.4rem 0.75rem;
      background: var(--m3-sys-color-surface);
      border-bottom: 1px solid var(--m3-sys-color-outline-variant);
      z-index: 28;
      text-align: center;
    }

    .brand {
      margin: 0;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0 0.7rem;
      font-weight: 800;
      font-size: 0.76rem;
      justify-self: center;
    }
  `]
})
export class TopBarComponent {}
