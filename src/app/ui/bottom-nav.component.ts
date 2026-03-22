import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
import { AppNavKey } from '../app.routes';

type NavMode = 'rail' | 'bottom';

interface NavItem {
  key: Exclude<AppNavKey, null>;
  label: string;
  route: string;
  icon: typeof House;
}

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <nav [class]="containerClasses()" aria-label="Hauptnavigation">
      @if (mode() === 'bottom') {
        <div class="grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-end gap-0 rounded-[1.55rem] bg-[linear-gradient(180deg,rgba(20,22,21,0.92),rgba(10,11,11,0.94))] px-2 py-2 shadow-[0_-8px_18px_rgba(0,0,0,0.22)] backdrop-blur-lg">
          @for (item of mobileLeadingItems(); track item.key) {
            <a [routerLink]="item.route" [class]="linkClasses(item.key)">
              <lucide-icon [img]="item.icon" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              <span>{{ item.label }}</span>
            </a>
          }

          <div class="flex justify-center px-1">
            <a
              routerLink="/today"
              [queryParams]="{ quick: 'menu' }"
              class="grid h-[3.2rem] w-[3.2rem] -translate-y-2 place-items-center rounded-full bg-[linear-gradient(180deg,#17ef85,#00d86f)] text-[#03140a] shadow-[0_10px_20px_rgba(0,228,117,0.16)] transition active:translate-y-[calc(-0.5rem+1px)]"
              aria-label="Schnelllog öffnen"
            >
              <lucide-icon [img]="icons.plus" class="h-[1rem] w-[1rem]" aria-hidden="true"></lucide-icon>
            </a>
          </div>

          @for (item of mobileTrailingItems(); track item.key) {
            <a [routerLink]="item.route" [class]="linkClasses(item.key)">
              <lucide-icon [img]="item.icon" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </div>
      } @else {
        <div class="flex h-full flex-col gap-3 rounded-[1.7rem] bg-[linear-gradient(180deg,rgba(21,23,22,0.94),rgba(10,11,11,0.92))] p-3 shadow-[0_16px_38px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div class="px-2 pt-2">
            <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.32em] text-shell-accent">Stoic Coach</p>
          </div>

          <div class="grid gap-2">
            @for (item of allItems(); track item.key) {
              <a [routerLink]="item.route" [class]="railLinkClasses(item.key)">
                <span class="grid h-10 w-10 place-items-center rounded-full bg-current/0 transition">
                  <lucide-icon [img]="item.icon" class="h-4 w-4" aria-hidden="true"></lucide-icon>
                </span>
                <span class="min-w-0 truncate">{{ item.label }}</span>
              </a>
            }
          </div>

          <div class="mt-auto pt-2">
            <a
              routerLink="/today"
              [queryParams]="{ quick: 'menu' }"
              class="flex min-h-12 items-center justify-center gap-2 rounded-[1.1rem] bg-[linear-gradient(180deg,#19ff8d,#00d96f)] px-4 text-sm font-extrabold uppercase tracking-[0.18em] text-[#04170b] shadow-[0_0_18px_rgba(0,228,117,0.16)]"
              aria-label="Schnelllog öffnen"
            >
              <lucide-icon [img]="icons.plus" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              Log
            </a>
          </div>
        </div>
      }
    </nav>
  `
})
export class BottomNavComponent {
  readonly mode = input<NavMode>('bottom');
  readonly activeNav = input<AppNavKey>(null);

  readonly icons = {
    plus: Plus
  };

  private readonly items: NavItem[] = [
    { key: 'today', label: 'Heute', route: '/today', icon: House },
    { key: 'gym', label: 'Gym', route: '/gym', icon: Dumbbell },
    { key: 'library', label: 'Bib', route: '/library', icon: BookOpen },
    { key: 'community', label: 'Feed', route: '/community', icon: Users },
    { key: 'profile', label: 'Profil', route: '/profile', icon: UserRound }
  ];

  readonly mobileItems = computed(() => this.items.filter(item => item.key !== 'library'));
  readonly mobileLeadingItems = computed(() => this.mobileItems().slice(0, 2));
  readonly mobileTrailingItems = computed(() => this.mobileItems().slice(2));
  readonly allItems = computed(() => this.items);

  containerClasses(): string {
    if (this.mode() === 'rail') {
      return 'sticky top-[4.65rem] h-[calc(100vh-5.9rem)]';
    }
    return 'fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[36rem] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]';
  }

  linkClasses(key: AppNavKey): string {
    const active = this.activeNav() === key;
    return [
      'flex',
      'min-h-12',
      'min-w-0',
      'flex-col',
      'items-center',
      'justify-center',
      'gap-1',
      'rounded-[1rem]',
      'px-1',
      'text-[0.54rem]',
      'font-extrabold',
      'uppercase',
      'tracking-[0.14em]',
      'transition',
      active
        ? 'text-shell-accent'
        : 'text-shell-ink-muted hover:text-shell-ink'
    ].join(' ');
  }

  railLinkClasses(key: AppNavKey): string {
    const active = this.activeNav() === key;
    return [
      'flex',
      'min-h-12',
      'items-center',
      'gap-3',
      'rounded-[1.1rem]',
      'px-3',
      'text-sm',
      'font-bold',
      'transition',
      active
        ? 'bg-[linear-gradient(180deg,rgba(20,35,27,0.86),rgba(18,24,21,0.92))] text-shell-accent'
        : 'text-shell-ink-muted hover:bg-shell-card hover:text-shell-ink'
    ].join(' ');
  }
}
