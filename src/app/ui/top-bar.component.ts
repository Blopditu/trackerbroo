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
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.4rem 0.75rem;
      background: var(--bg-shell);
      border-bottom: 1px solid var(--border-strong);
      z-index: 28;
      text-align: center;
    }

    .brand {
      margin: 0;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: var(--bg-surface-2);
      color: var(--ink-700);
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
