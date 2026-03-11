import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatToolbarModule],
  template: `
    <mat-toolbar class="top-bar" role="banner">
      <h1 class="title">Tracker Broo</h1>
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
      justify-content: flex-start;
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

    :host-context(.layout-medium) .top-bar {
      padding-left: 104px;
    }

    :host-context(.layout-expanded) .top-bar {
      padding-left: 116px;
    }
  `]
})
export class TopBarComponent {}
