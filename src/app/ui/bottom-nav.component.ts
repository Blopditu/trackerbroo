import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bottom-nav" aria-label="Primary">
      <a routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <span>Today</span>
      </a>
      <a routerLink="/library" routerLinkActive="active">
        <span>Library</span>
      </a>
      <a routerLink="/dashboard" routerLinkActive="active">
        <span>Stats</span>
      </a>
      <a routerLink="/community" routerLinkActive="active">
        <span>Community</span>
      </a>
      <a routerLink="/profile" routerLinkActive="active">
        <span>Profile</span>
      </a>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      width: min(100%, 480px);
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.3rem;
      padding: 0.45rem 0.65rem calc(0.7rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--border-strong);
      background: var(--bg-shell);
      z-index: 27;
    }

    a {
      min-height: 52px;
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      text-decoration: none;
      color: var(--ink-500);
      font-weight: 700;
      font-size: 0.7rem;
      background: var(--bg-surface-2);
    }

    a.active {
      color: var(--ink-900);
      border-color: var(--accent-500);
      background: var(--accent-soft);
    }
  `]
})
export class BottomNavComponent {}
