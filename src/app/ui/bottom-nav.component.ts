import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  BookOpen,
  Dumbbell,
  House,
  LucideAngularModule,
  Plus,
  UserRound,
  Users
} from 'lucide-angular';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.rail-mode]': "mode() === 'rail'",
    '[class.bottom-mode]': "mode() === 'bottom'"
  },
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <nav class="bottom-nav" aria-label="Hauptnavigation">
      @if (mode() === 'bottom') {
        <div class="nav-strip">
          <a class="nav-link" routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.home"></lucide-icon></span>
            <span class="label">Heute</span>
          </a>
          <a class="nav-link" routerLink="/gym" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.gym"></lucide-icon></span>
            <span class="label">Gym</span>
          </a>
          <span class="fab-gap" aria-hidden="true"></span>
          <a class="nav-link" routerLink="/library" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.library"></lucide-icon></span>
            <span class="label">Bibliothek</span>
          </a>
          <a class="nav-link" routerLink="/community" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.community"></lucide-icon></span>
            <span class="label">Community</span>
          </a>
          <a class="nav-link" routerLink="/profile" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.profile"></lucide-icon></span>
            <span class="label">Profil</span>
          </a>
        </div>
        <a class="quick-fab" routerLink="/today" [queryParams]="{ quick: 'food' }" aria-label="Essen schnell loggen">
          <lucide-icon [img]="icons.plus" aria-hidden="true"></lucide-icon>
        </a>
      } @else {
        <div class="rail-list">
          <a class="nav-link" routerLink="/today" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.home"></lucide-icon></span>
            <span class="label">Heute</span>
          </a>
          <a class="nav-link" routerLink="/gym" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.gym"></lucide-icon></span>
            <span class="label">Gym</span>
          </a>
          <a class="nav-link quick-rail" routerLink="/today" [queryParams]="{ quick: 'food' }" aria-label="Essen schnell loggen">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.plus"></lucide-icon></span>
            <span class="label">Essen</span>
          </a>
          <a class="nav-link" routerLink="/library" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.library"></lucide-icon></span>
            <span class="label">Bibliothek</span>
          </a>
          <a class="nav-link" routerLink="/community" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.community"></lucide-icon></span>
            <span class="label">Community</span>
          </a>
          <a class="nav-link" routerLink="/profile" routerLinkActive="active">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.profile"></lucide-icon></span>
            <span class="label">Profil</span>
          </a>
        </div>
      }
    </nav>
  `,
  styles: [`
    :host {
      display: block;
    }

    .bottom-nav {
      position: relative;
      width: 100%;
      background: var(--m3-sys-color-surface);
      z-index: 30;
    }

    :host.bottom-mode .bottom-nav {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      width: 100%;
      max-width: 560px;
      padding: 0.2rem 0.5rem calc(0.65rem + env(safe-area-inset-bottom));
      border-top: 1px solid var(--m3-sys-color-outline-variant);
      box-shadow: 0 -2px 12px color-mix(in srgb, #000 26%, transparent);
    }

    :host.rail-mode .bottom-nav {
      position: static;
      background: transparent;
      border-top: none;
      box-shadow: none;
    }

    .nav-strip {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      align-items: end;
      gap: 0;
    }

    .rail-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 4px;
      align-content: start;
    }

    .nav-link {
      min-height: 62px;
      border: none;
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-decoration: none;
      color: var(--m3-sys-color-on-surface-variant);
      background: transparent;
      transition:
        background-color var(--motion-duration-short) var(--motion-easing-standard),
        color var(--motion-duration-short) var(--motion-easing-standard),
        transform var(--motion-duration-short) var(--motion-easing-standard);
    }

    :host.rail-mode .nav-link {
      min-height: 60px;
      border-radius: 12px;
      gap: 4px;
    }

    .fab-gap {
      display: block;
      height: 1px;
    }

    .icon-wrap {
      width: 34px;
      height: 30px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
      line-height: 1;
      transition:
        background-color var(--motion-duration-medium) var(--motion-easing-standard),
        color var(--motion-duration-short) var(--motion-easing-standard),
        transform var(--motion-duration-medium) var(--motion-easing-decelerate);
    }

    .icon-wrap lucide-icon {
      width: 18px;
      height: 18px;
    }

    .label {
      font-size: 11px;
      line-height: 14px;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    .quick-fab {
      position: absolute;
      left: 50%;
      bottom: calc(28px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: 58px;
      height: 58px;
      border-radius: 999px;
      background: var(--m3-sys-color-primary);
      color: var(--m3-sys-color-on-primary);
      box-shadow: var(--shadow-level-1);
      border: 4px solid var(--m3-sys-color-surface);
      display: grid;
      place-items: center;
      text-decoration: none;
      z-index: 1;
    }

    .quick-fab lucide-icon {
      width: 24px;
      height: 24px;
    }

    .quick-rail .icon-wrap {
      background: var(--m3-sys-color-primary-container);
      color: var(--m3-sys-color-on-primary-container);
    }

    .nav-link.active .icon-wrap {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
      transform: scale(1.02);
    }

    .nav-link.active .label {
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
      letter-spacing: 0.1px;
    }

    .nav-link:focus-visible,
    .quick-fab:focus-visible {
      outline: 2px solid var(--m3-sys-color-primary);
      outline-offset: -1px;
    }

    .nav-link:active,
    .quick-fab:active {
      transform: translateY(1px);
    }
  `]
})
export class BottomNavComponent {
  readonly mode = input<'bottom' | 'rail'>('bottom');
  readonly icons = {
    home: House,
    gym: Dumbbell,
    plus: Plus,
    library: BookOpen,
    community: Users,
    profile: UserRound
  };
}
