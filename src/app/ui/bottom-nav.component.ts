import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Dumbbell, House, Library, LucideAngularModule, User, Users } from 'lucide-angular';

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
      <a routerLink="/gym" routerLinkActive="active">
        <lucide-icon [img]="icons.dumbbell" class="nav-icon" aria-hidden="true"></lucide-icon>
        <span>Gym</span>
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
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.3rem;
      padding: 0.4rem 0.65rem calc(0.75rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container);
      z-index: 27;
    }

    a {
      min-height: 52px;
      border: 1px solid transparent;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      text-decoration: none;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 700;
      font-size: 0.82rem;
      line-height: 1;
      background: var(--m3-sys-color-surface-container-high);
    }

    .nav-icon {
      width: 16px;
      height: 16px;
      display: block;
      flex: 0 0 16px;
    }

    a.active {
      color: var(--m3-sys-color-on-secondary-container);
      border-color: var(--m3-sys-color-secondary-container);
      background: var(--m3-sys-color-secondary-container);
    }
  `]
})
export class BottomNavComponent {
  readonly icons = {
    house: House,
    dumbbell: Dumbbell,
    library: Library,
    users: Users,
    user: User
  };
}
