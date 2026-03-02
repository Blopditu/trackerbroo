import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { House, Library, LucideAngularModule, User, Users } from 'lucide-angular';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <nav class="bottom-nav" aria-label="Hauptnavigation">
      <a routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <lucide-icon [img]="icons.house" class="nav-icon" aria-hidden="true"></lucide-icon>
        <span>Heute</span>
      </a>
      <a routerLink="/library" routerLinkActive="active">
        <lucide-icon [img]="icons.library" class="nav-icon" aria-hidden="true"></lucide-icon>
        <span>Bibliothek</span>
      </a>
      <a routerLink="/community" routerLinkActive="active">
        <lucide-icon [img]="icons.users" class="nav-icon" aria-hidden="true"></lucide-icon>
        <span>Community</span>
      </a>
      <a routerLink="/profile" routerLinkActive="active">
        <lucide-icon [img]="icons.user" class="nav-icon" aria-hidden="true"></lucide-icon>
        <span>Profil</span>
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      text-decoration: none;
      color: var(--ink-500);
      font-weight: 700;
      font-size: 0.7rem;
      line-height: 1;
      background: var(--bg-surface-2);
    }

    .nav-icon {
      width: 16px;
      height: 16px;
      display: block;
      flex: 0 0 16px;
    }

    a.active {
      color: var(--ink-900);
      border-color: var(--accent-500);
      background: var(--accent-soft);
    }
  `]
})
export class BottomNavComponent {
  readonly icons = {
    house: House,
    library: Library,
    users: Users,
    user: User
  };
}
