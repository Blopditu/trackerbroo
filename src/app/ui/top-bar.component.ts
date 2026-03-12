import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ChartLine } from 'lucide-angular';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatButtonModule, LucideAngularModule],
  template: `
    <mat-toolbar class="top-bar" role="banner">
      <h1 class="title">Tracker Broo</h1>
      <a mat-button class="insight-link" routerLink="/insights" aria-label="Insights öffnen">
        <lucide-icon [img]="icons.chartLine" class="insight-icon" aria-hidden="true"></lucide-icon>
        <span>Insights</span>
      </a>
    </mat-toolbar>
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
      transition: padding var(--motion-duration-medium) var(--motion-easing-standard);
    }

    .title {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-family: var(--font-display);
      font-size: 1.375rem;
      line-height: 1.75rem;
      font-weight: 600;
      letter-spacing: 0;
      transition: letter-spacing var(--motion-duration-medium) var(--motion-easing-standard);
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

    .insight-icon {
      width: 16px;
      height: 16px;
    }

    :host-context(.layout-medium) .top-bar {
      padding-left: 104px;
    }

    :host-context(.layout-expanded) .top-bar {
      padding-left: 116px;
    }
  `]
})
export class TopBarComponent {
  readonly icons = {
    chartLine: ChartLine
  };
}
