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
        <a class="quick-fab" routerLink="/today" [queryParams]="{ quick: 'menu' }" aria-label="Schnelllog öffnen">
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
          <a class="nav-link quick-rail" routerLink="/today" [queryParams]="{ quick: 'menu' }" aria-label="Schnelllog öffnen">
            <span class="icon-wrap" aria-hidden="true"><lucide-icon [img]="icons.plus"></lucide-icon></span>
            <span class="label">Loggen</span>
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
      padding:
        0.28rem
        max(0.4rem, env(safe-area-inset-right))
        calc(0.72rem + env(safe-area-inset-bottom))
        max(0.4rem, env(safe-area-inset-left));
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
      align-items: stretch;
      gap: 0;
    }

    .rail-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 4px;
      align-content: start;
    }

    .nav-link {
      position: relative;
      min-height: 68px;
      width: 100%;
      min-width: 0;
      max-width: none;
      border: none;
      border-radius: 18px;
      display: grid;
      grid-auto-rows: min-content;
      justify-items: center;
      align-content: center;
      gap: 0.18rem;
      padding: 0.35rem 0.2rem 0.12rem;
      justify-self: stretch;
      text-decoration: none;
      color: var(--m3-sys-color-on-surface-variant);
      background: transparent;
      transition:
        background-color var(--motion-duration-short) var(--motion-easing-standard),
        color var(--motion-duration-short) var(--motion-easing-standard),
        transform var(--motion-duration-short) var(--motion-easing-standard);
    }

    :host.bottom-mode .nav-link {
      min-height: 72px;
    }

    :host.bottom-mode .nav-link::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 6px;
      width: min(76px, calc(100% - 10px));
      height: 54px;
      border-radius: 20px;
      background: var(--m3-sys-color-secondary-container);
      opacity: 0;
      transform: translateX(-50%) scale(0.94);
      transition:
        opacity var(--motion-duration-short) var(--motion-easing-standard),
        transform var(--motion-duration-medium) var(--motion-easing-emphasized);
      pointer-events: none;
    }

    :host.rail-mode .nav-link {
      min-height: 60px;
      width: auto;
      max-width: 82px;
      border-radius: 12px;
      gap: 4px;
      justify-self: center;
    }

    .fab-gap {
      display: block;
      width: 100%;
      min-width: 0;
      height: 100%;
    }

    .icon-wrap {
      position: relative;
      z-index: 1;
      width: 40px;
      height: 40px;
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
      width: 20px;
      height: 20px;
    }

    .label {
      position: relative;
      z-index: 1;
      width: 100%;
      min-height: 24px;
      font-size: 11px;
      line-height: 1.08;
      font-weight: 500;
      letter-spacing: 0.1px;
      text-align: center;
      text-wrap: balance;
      max-width: none;
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }

    .quick-fab {
      position: absolute;
      left: 50%;
      bottom: calc(31px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: 60px;
      height: 60px;
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

    :host.bottom-mode .nav-link.active::before {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }

    :host.bottom-mode .nav-link.active {
      color: var(--m3-sys-color-on-secondary-container);
    }

    :host.rail-mode .nav-link.active .icon-wrap {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
      transform: none;
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
