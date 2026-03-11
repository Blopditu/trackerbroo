import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Dumbbell, House, Library, LucideAngularModule, User, Users } from 'lucide-angular';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.rail-mode]': "mode() === 'rail'",
    '[class.bottom-mode]': "mode() === 'bottom'"
  },
  imports: [CommonModule, RouterModule, LucideAngularModule, MatRippleModule],
  template: `
    <nav class="bottom-nav" aria-label="Hauptnavigation">
      <a matRipple routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <span class="icon-wrap">
          <lucide-icon [img]="icons.house" class="nav-icon" aria-hidden="true"></lucide-icon>
        </span>
        <span class="label">Heute</span>
      </a>
      <a matRipple routerLink="/gym" routerLinkActive="active">
        <span class="icon-wrap">
          <lucide-icon [img]="icons.dumbbell" class="nav-icon" aria-hidden="true"></lucide-icon>
        </span>
        <span class="label">Gym</span>
      </a>
      <a matRipple routerLink="/library" routerLinkActive="active">
        <span class="icon-wrap">
          <lucide-icon [img]="icons.library" class="nav-icon" aria-hidden="true"></lucide-icon>
        </span>
        <span class="label">Bibliothek</span>
      </a>
      <a matRipple routerLink="/community" routerLinkActive="active">
        <span class="icon-wrap">
          <lucide-icon [img]="icons.users" class="nav-icon" aria-hidden="true"></lucide-icon>
        </span>
        <span class="label">Community</span>
      </a>
      <a matRipple routerLink="/profile" routerLinkActive="active">
        <span class="icon-wrap">
          <lucide-icon [img]="icons.user" class="nav-icon" aria-hidden="true"></lucide-icon>
        </span>
        <span class="label">Profil</span>
      </a>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }

    .bottom-nav {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0;
      padding: 0.35rem 0.5rem;
      background: var(--m3-sys-color-surface);
      z-index: 27;
    }

    :host.bottom-mode .bottom-nav {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      width: 100%;
      max-width: 100%;
      padding: 0.35rem 0.5rem calc(0.75rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--m3-sys-color-outline-variant);
    }

    :host.rail-mode .bottom-nav {
      position: static;
      display: grid;
      grid-template-columns: 1fr;
      align-content: start;
      padding: 0;
      gap: 4px;
      background: transparent;
      border-top: none;
    }

    a {
      min-height: 72px;
      border: none;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-decoration: none;
      color: var(--m3-sys-color-on-surface-variant);
      background: transparent;
      transition: background-color 150ms ease, color 150ms ease;
    }

    :host.rail-mode a {
      min-height: 64px;
      border-radius: 12px;
      gap: 4px;
    }

    .icon-wrap {
      width: 64px;
      height: 32px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
      transition: background-color 150ms ease, color 150ms ease;
    }

    :host.rail-mode .icon-wrap {
      width: 56px;
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      display: block;
      flex: 0 0 20px;
    }

    .label {
      font-size: 12px;
      line-height: 16px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }

    a.active .icon-wrap {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    a.active .label {
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
      letter-spacing: 0.1px;
    }

    a:focus-visible {
      outline: 2px solid var(--m3-sys-color-primary);
      outline-offset: -1px;
    }
  `]
})
export class BottomNavComponent {
  readonly mode = input<'bottom' | 'rail'>('bottom');

  readonly icons = {
    house: House,
    dumbbell: Dumbbell,
    library: Library,
    users: Users,
    user: User
  };
}
