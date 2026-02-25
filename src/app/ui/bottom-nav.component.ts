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
        <span class="icon" aria-hidden="true">▣</span>
        <span>Today</span>
      </a>
      <a routerLink="/library" routerLinkActive="active">
        <span class="icon" aria-hidden="true">▤</span>
        <span>Library</span>
      </a>
      <a routerLink="/dashboard" routerLinkActive="active">
        <span class="icon" aria-hidden="true">▥</span>
        <span>Stats</span>
      </a>
      <a routerLink="/community" routerLinkActive="active">
        <span class="icon" aria-hidden="true">▦</span>
        <span>Community</span>
      </a>
      <a routerLink="/profile" routerLinkActive="active">
        <span class="icon" aria-hidden="true">▧</span>
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
      border-top: 2px solid #1f2937;
      background: linear-gradient(180deg, #f8fbff 0%, #e9f2ff 100%);
      z-index: 27;
    }

    a {
      min-height: 52px;
      border: 2px solid #1f2937;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      text-decoration: none;
      color: #334155;
      font-weight: 700;
      font-size: 0.68rem;
      background: #fff;
      box-shadow: 0 2px 0 #1f2937;
    }

    a.active {
      background: linear-gradient(180deg, #0ea5e9, #0284c7);
      color: #fff;
      transform: translateY(-1px);
    }

    .icon {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1;
    }
  `]
})
export class BottomNavComponent {}
