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
        <div class="grid grid-cols-6 gap-1 rounded-[2rem] border border-shell-border bg-shell-elevated/96 p-2 shadow-[0_-16px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          @for (item of leadingItems(); track item.key) {
            <a [routerLink]="item.route" [class]="linkClasses(item.key)">
              <lucide-icon [img]="item.icon" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              <span>{{ item.label }}</span>
            </a>
          }

          <a
            routerLink="/today"
            [queryParams]="{ quick: 'menu' }"
            class="grid h-14 place-items-center rounded-full bg-shell-accent text-[#05200f] shadow-[0_0_30px_rgba(0,228,117,0.35)] transition active:translate-y-px"
            aria-label="Schnelllog öffnen"
          >
            <lucide-icon [img]="icons.plus" class="h-5 w-5" aria-hidden="true"></lucide-icon>
          </a>

          @for (item of trailingItems(); track item.key) {
            <a [routerLink]="item.route" [class]="linkClasses(item.key)">
              <lucide-icon [img]="item.icon" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </div>
      } @else {
        <div class="flex h-full flex-col gap-3 rounded-[2rem] border border-shell-border bg-shell-elevated/88 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div class="px-2 pt-2">
            <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.3em] text-shell-accent">Stoic</p>
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
              class="flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] bg-shell-accent px-4 text-sm font-extrabold uppercase tracking-[0.18em] text-[#05200f] shadow-[0_0_30px_rgba(0,228,117,0.24)]"
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
    { key: 'library', label: 'Bibliothek', route: '/library', icon: BookOpen },
    { key: 'community', label: 'Community', route: '/community', icon: Users },
    { key: 'profile', label: 'Profil', route: '/profile', icon: UserRound }
  ];

  readonly leadingItems = computed(() => this.items.slice(0, 2));
  readonly trailingItems = computed(() => this.items.slice(2));
  readonly allItems = computed(() => this.items);

  containerClasses(): string {
    if (this.mode() === 'rail') {
      return 'sticky top-[5.25rem] h-[calc(100vh-6.75rem)]';
    }
    return 'fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[36rem] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]';
  }

  linkClasses(key: AppNavKey): string {
    const active = this.activeNav() === key;
    return [
      'flex',
      'min-h-14',
      'min-w-0',
      'flex-col',
      'items-center',
      'justify-center',
      'gap-1',
      'rounded-[1.25rem]',
      'px-1',
      'text-[0.62rem]',
      'font-extrabold',
      'uppercase',
      'tracking-[0.18em]',
      'transition',
      active
        ? 'bg-shell-accent-muted text-shell-accent'
        : 'text-shell-ink-muted hover:bg-shell-card hover:text-shell-ink'
    ].join(' ');
  }

  railLinkClasses(key: AppNavKey): string {
    const active = this.activeNav() === key;
    return [
      'flex',
      'min-h-14',
      'items-center',
      'gap-3',
      'rounded-[1.25rem]',
      'px-3',
      'text-sm',
      'font-bold',
      'transition',
      active
        ? 'bg-shell-accent-muted text-shell-accent'
        : 'text-shell-ink-muted hover:bg-shell-card hover:text-shell-ink'
    ].join(' ');
  }
}
