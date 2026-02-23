import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bottom-nav">
      <a routerLink="/today" routerLinkActive="active">
        <div class="nav-item">
          <span>📅</span>
          <span>Today</span>
        </div>
      </a>
      <a routerLink="/library" routerLinkActive="active">
        <div class="nav-item">
          <span>📚</span>
          <span>Library</span>
        </div>
      </a>
      <a routerLink="/dashboard" routerLinkActive="active">
        <div class="nav-item">
          <span>📊</span>
          <span>Dashboard</span>
        </div>
      </a>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: space-around;
      padding: 0.5rem;
      box-shadow: 0 -2px 4px rgba(0,0,0,0.1);
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: #666;
      padding: 0.5rem;
      border-radius: 10px;
    }
    .nav-item span {
      font-size: 0.8rem;
    }
    .active .nav-item {
      background: #667eea;
      color: white;
    }
  `]
})
export class BottomNavComponent {}