import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bottom-nav" aria-label="Primary">
      <a routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <span class="icon" aria-hidden="true">🍜</span>
        <span>Today</span>
      </a>
      <a routerLink="/library" routerLinkActive="active">
        <span class="icon" aria-hidden="true">📚</span>
        <span>Library</span>
      </a>
      <a routerLink="/dashboard" routerLinkActive="active">
        <span class="icon" aria-hidden="true">📜</span>
        <span>Stats</span>
      </a>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(100%, 480px);
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      padding: 0.55rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom));
      border-top: 3px solid #2f1f15;
      background: linear-gradient(180deg, #7f4e2a 0%, #593117 100%);
      box-shadow: 0 -6px 14px rgba(0, 0, 0, 0.25);
      z-index: 15;
    }

    a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      min-height: 52px;
      border-radius: 12px;
      border: 2px solid #2f1f15;
      text-decoration: none;
      color: #ffe5b5;
      background: linear-gradient(180deg, #9a6438 0%, #7a4a26 100%);
      font-size: 0.78rem;
      font-weight: 800;
      transition: transform 0.15s ease, background 0.15s ease;
    }

    a.active {
      background: linear-gradient(180deg, #f78a1d 0%, #e1680e 100%);
      color: #ffffff;
      transform: translateY(-1px);
    }

    .icon {
      font-size: 1.1rem;
      line-height: 1;
    }
  `]
})
export class BottomNavComponent {}
