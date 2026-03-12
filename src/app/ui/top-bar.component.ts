import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="top-bar" role="banner">
      <h1 class="title">Tracker Broo</h1>
      <a class="insight-link" routerLink="/insights" aria-label="Insights öffnen">
        <span class="insight-dot" aria-hidden="true"></span>
        <span>Insights</span>
      </a>
    </header>
  `,
  styles: [`
    .top-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 clamp(16px, 4vw, 32px);
      background: var(--m3-sys-color-surface);
      border-bottom: 1px solid var(--m3-sys-color-outline-variant);
      z-index: 28;
      backdrop-filter: blur(6px);
    }

    .title {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-family: var(--font-display);
      font-size: 1.375rem;
      line-height: 1.75rem;
      font-weight: 600;
      letter-spacing: 0;
    }

    .insight-link {
      min-height: 40px;
      border-radius: 999px;
      color: var(--m3-sys-color-on-surface-variant);
      border: 1px solid var(--m3-sys-color-outline-variant);
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
      background: color-mix(in srgb, var(--m3-sys-color-surface-container-high) 86%, transparent);
    }

    .insight-link:hover {
      color: var(--m3-sys-color-on-surface);
      border-color: var(--m3-sys-color-primary);
    }

    .insight-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--m3-sys-color-primary);
    }

    :host-context(.layout-medium) .top-bar {
      padding-left: 104px;
    }

    :host-context(.layout-expanded) .top-bar {
      padding-left: 116px;
    }
  `]
})
export class TopBarComponent {}
