import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, UserRound } from 'lucide-angular';
import { AppNavKey, AppShellVariant } from '../app.routes';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <header
      class="fixed inset-x-0 top-0 z-30 bg-[linear-gradient(180deg,rgba(11,12,12,0.92),rgba(11,12,12,0.84))] backdrop-blur-md"
    >
      <div
        class="mx-auto flex h-[3.55rem] w-full max-w-[1240px] items-end gap-3 px-4 pb-2 sm:px-6 xl:px-8"
      >
        <div class="min-w-0 flex-1">
          @if (accentLabel()) {
            <p
              class="text-[0.53rem] font-extrabold uppercase tracking-[0.24em] text-shell-accent/82"
            >
              {{ accentLabel() }}
            </p>
          }
          <div class="flex min-w-0 items-center gap-2">
            <h1
              class="truncate text-[1.08rem] font-semibold tracking-[-0.04em] text-shell-ink sm:text-[1.3rem]"
            >
              {{ title() }}
            </h1>
          </div>
        </div>

        @if (shellVariant() === 'app') {
          <div class="flex shrink-0 items-center gap-2">
            <a
              routerLink="/profile"
              class="grid h-8 w-8 place-items-center rounded-full text-shell-accent/84 transition hover:bg-shell-card/50 hover:text-shell-ink"
              aria-label="Profil öffnen"
            >
              <lucide-icon
                [img]="icons.bell"
                class="h-[0.95rem] w-[0.95rem]"
                aria-hidden="true"
              ></lucide-icon>
            </a>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopBarComponent {
  readonly title = input.required<string>();
  readonly accentLabel = input('Tracker Broo');
  readonly shellVariant = input<AppShellVariant>('app');
  readonly activeNav = input<AppNavKey>(null);

  readonly icons = {
    bell: UserRound,
  };
}
