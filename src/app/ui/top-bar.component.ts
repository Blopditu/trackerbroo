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
      class="fixed inset-x-0 top-0 z-30"
    >
      <div
        class="mx-auto mt-3 flex h-[4.6rem] w-[calc(100%-1rem)] max-w-[1240px] items-center gap-4 rounded-[1.9rem] bg-[linear-gradient(180deg,rgba(27,30,28,0.96),rgba(13,15,14,0.92))] px-5 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:mt-4 sm:w-[calc(100%-2rem)] sm:px-6 xl:px-8"
      >
        <div class="min-w-0 flex-1">
          @if (accentLabel()) {
            <p class="text-[0.6rem] font-extrabold uppercase tracking-[0.32em] text-shell-accent/92">{{ accentLabel() }}</p>
          }
          <div class="flex min-w-0 items-center gap-2.5">
            <h1 class="truncate text-[1.34rem] font-semibold tracking-[-0.055em] text-shell-ink sm:text-[1.62rem]">
              {{ title() }}
            </h1>
          </div>
        </div>

        @if (shellVariant() === 'app') {
          <div class="flex shrink-0 items-center gap-2.5">
            <a
              routerLink="/insights"
              class="hidden min-h-11 items-center gap-2 rounded-full bg-shell-muted px-4 text-[0.64rem] font-extrabold uppercase tracking-[0.24em] text-shell-ink-muted transition hover:bg-shell-card-strong hover:text-shell-ink md:inline-flex"
            >
              <lucide-icon [img]="icons.trends" class="h-4 w-4" aria-hidden="true"></lucide-icon>
              Insights
            </a>
            <a
              routerLink="/profile"
              class="grid h-12 w-12 place-items-center rounded-full bg-[radial-gradient(circle_at_top,rgba(0,228,117,0.12),transparent_70%),linear-gradient(180deg,rgba(27,30,28,0.98),rgba(19,22,20,0.94))] text-shell-accent transition hover:bg-shell-card-strong"
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
