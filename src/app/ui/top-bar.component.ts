import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <p class="brand">Tracker Broo</p>
      <p class="tagline">Community & Konsistenz</p>
    </header>
  `,
  styles: [`
    .top-bar {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(100%, 480px);
      height: 66px;
      display: grid;
      grid-template-columns: 1fr;
      align-items: center;
      gap: 0.1rem;
      padding: 0.6rem 0.75rem;
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
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0 0.6rem;
      font-weight: 800;
      font-size: 0.78rem;
      justify-self: center;
    }

    .tagline {
      margin: 0;
      color: var(--ink-500);
      font-size: 0.78rem;
      font-weight: 700;
      text-align: center;
    }
  `]
})
export class TopBarComponent {}
