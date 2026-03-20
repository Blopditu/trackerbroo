import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChartNoAxesCombined, LucideAngularModule, UserRound } from 'lucide-angular';
import { AppNavKey, AppShellVariant } from '../app.routes';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <header
      class="fixed inset-x-0 top-0 z-30 border-b border-shell-border bg-shell/88 backdrop-blur-xl"
      [class.border-transparent]="shellVariant() === 'onboarding'"
    >
      <div class="mx-auto flex h-18 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6 xl:px-8">
        <div class="min-w-0 flex-1">
          <p class="text-[0.65rem] font-extrabold uppercase tracking-[0.28em] text-shell-accent">{{ accentLabel() }}</p>
          <div class="flex min-w-0 items-center gap-3">
            <h1 class="truncate text-[1.35rem] font-extrabold tracking-[-0.04em] text-shell-ink sm:text-[1.6rem]">
              {{ title() }}
            </h1>
            @if (activeNav() === 'insights') {
              <span class="hidden rounded-full border border-shell-border bg-shell-card px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-shell-ink-muted sm:inline-flex">
                Trends
              </span>
            }
          </div>
        </div>

        @if (shellVariant() === 'app') {
          <div class="flex shrink-0 items-center gap-2">
            <a
              routerLink="/insights"
              class="hidden min-h-11 items-center gap-2 rounded-full border border-shell-border bg-shell-card px-4 text-xs font-bold uppercase tracking-[0.18em] text-shell-ink-muted transition hover:border-shell-accent hover:text-shell-ink md:inline-flex"
            >
              <lucide-icon [img]="icons.trends" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              Insights
            </a>
            <a
              routerLink="/profile"
              class="grid h-11 w-11 place-items-center rounded-full border border-shell-border bg-shell-card text-shell-accent transition hover:border-shell-accent hover:bg-shell-card-strong"
              aria-label="Profil öffnen"
            >
              <lucide-icon [img]="icons.bell" class="h-4 w-4" aria-hidden="true"></lucide-icon>
            </a>
          </div>
        }
      </div>
    </header>
  `
})
export class TopBarComponent {
  readonly title = input.required<string>();
  readonly accentLabel = input('Tracker Broo');
  readonly shellVariant = input<AppShellVariant>('app');
  readonly activeNav = input<AppNavKey>(null);

  readonly icons = {
    bell: UserRound,
    trends: ChartNoAxesCombined
  };
}
