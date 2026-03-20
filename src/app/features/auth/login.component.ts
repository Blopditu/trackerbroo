import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { formatAppError } from '../../core/error-format';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule],
  template: `
    <main class="min-h-[calc(100vh-4.5rem)] px-4 py-6 sm:px-6 lg:px-8">
      @if (message) {
        <p
          class="mx-auto mb-4 w-full max-w-md rounded-2xl border px-4 py-3 text-sm font-bold"
          [class.border-rose-400]="isError"
          [class.bg-rose-500]="isError"
          [class.text-white]="isError"
          [class.border-shell-border]="!isError"
          [class.bg-shell-card]="!isError"
          [class.text-shell-ink]="!isError"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ message }}
        </p>
      }

      <section class="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,28rem)]">
        <div class="rounded-[2rem] border border-shell-border bg-shell-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:p-8 lg:p-10">
          <div class="flex items-center gap-4">
            <div class="grid h-16 w-16 place-items-center rounded-[1.35rem] bg-shell-accent-muted text-[1.7rem] font-extrabold tracking-[-0.08em] text-shell-accent">
              TB
            </div>
            <div>
              <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-shell-accent">Tracker Broo</p>
              <p class="mt-1 text-sm font-semibold text-shell-ink-muted">Disziplin statt Dopamin</p>
            </div>
          </div>

          <div class="mt-8 space-y-4">
            <h1 id="login-title" class="max-w-[10ch] text-4xl font-extrabold tracking-[-0.06em] text-shell-ink sm:text-5xl">
              Konstanz isch key.
            </h1>
            <p class="max-w-xl text-base font-medium leading-7 text-shell-ink-muted">
              Ein ruhiger Ort für Gym, Protein und Fortschritt. Weniger Reibung, mehr Routine.
            </p>
          </div>

          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <article class="rounded-[1.5rem] border border-shell-border bg-shell-card-strong p-4">
              <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-ink-muted">Heute</p>
              <p class="mt-3 text-xl font-extrabold tracking-[-0.04em] text-shell-ink">Schnell loggen</p>
            </article>
            <article class="rounded-[1.5rem] border border-shell-border bg-shell-card-strong p-4">
              <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-ink-muted">Gym</p>
              <p class="mt-3 text-xl font-extrabold tracking-[-0.04em] text-shell-ink">Aktive Einheiten</p>
            </article>
            <article class="rounded-[1.5rem] border border-shell-border bg-shell-card-strong p-4">
              <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-ink-muted">Insights</p>
              <p class="mt-3 text-xl font-extrabold tracking-[-0.04em] text-shell-ink">Klare Verläufe</p>
            </article>
          </div>
        </div>

        <section
          class="rounded-[2rem] border border-shell-border bg-shell-card p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:p-8"
          aria-labelledby="login-title"
        >
          <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-shell-accent">Google Login</p>
          <h2 class="mt-4 text-3xl font-extrabold tracking-[-0.06em] text-shell-ink">Anmelden</h2>
          <p class="mt-2 text-sm leading-6 text-shell-ink-muted">
            Der Login bleibt bewusst einfach: Google rein, direkt zum Tracking.
          </p>

          <div class="mt-8 rounded-[1.5rem] border border-shell-border bg-shell-card-strong p-5">
            <button
              mat-flat-button
              type="button"
              class="flex min-h-14 w-full items-center justify-center gap-3 rounded-[1.15rem] bg-shell-accent px-5 text-sm font-extrabold uppercase tracking-[0.18em] text-[#05200f] shadow-[0_12px_30px_rgba(0,228,117,0.25)]"
              (click)="signInWithGoogle()"
              [disabled]="loading"
            >
              <span class="grid h-8 w-8 place-items-center rounded-full bg-white" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="h-4 w-4" focusable="false">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.8 14.7 2 12 2 6.9 2 2.8 6.5 2.8 12s4.1 10 9.2 10c5.3 0 8.8-3.8 8.8-9.1 0-.6-.1-1.1-.2-1.6H12Z"/>
                  <path fill="#34A853" d="M2.8 12c0 2 0.7 3.8 1.9 5.2l3.1-2.4c-.8-.8-1.2-1.8-1.2-2.9s.4-2.2 1.2-2.9L4.7 6.6C3.5 8.1 2.8 10 2.8 12Z"/>
                  <path fill="#FBBC05" d="M12 22c2.7 0 4.9-.9 6.6-2.5l-3.2-2.6c-.9.6-2 1-3.4 1-2.5 0-4.6-1.7-5.3-4l-3.2 2.4C5 19.8 8.2 22 12 22Z"/>
                  <path fill="#4285F4" d="M18.6 19.5c1.9-1.8 3-4.3 3-7.6 0-.7-.1-1.2-.2-1.7H12v3.9h5.5c-.2 1.1-.8 2-1.7 2.8l2.8 2.6Z"/>
                </svg>
              </span>
              <span>{{ loading ? 'Google wird geöffnet …' : 'Mit Google anmelden' }}</span>
            </button>

            <div class="mt-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-shell-ink-muted">
              <span class="h-px flex-1 bg-shell-border"></span>
              Nur ein Schritt
              <span class="h-px flex-1 bg-shell-border"></span>
            </div>

            <p class="mt-5 text-sm leading-6 text-shell-ink-muted">
              Nach dem Login landest du direkt in deinem Tagesflow. Passwort- und E-Mail-Flows bleiben bewusst ausserhalb des Scopes.
            </p>
          </div>
        </section>
      </section>
    </main>
  `
})
export class LoginComponent implements OnInit {
  loading = false;
  message = '';
  isError = false;

  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      if (this.authService.user()) {
        void this.router.navigate(['/today']);
      }
    });
  }

  ngOnInit() {
    void this.authService.restoreSession();
  }

  async signInWithGoogle() {
    this.loading = true;
    this.isError = false;
    this.message = '';
    try {
      await this.authService.signInWithGoogle();
    } catch (error: unknown) {
      this.isError = true;
      this.message = formatAppError(error, 'Google-Anmeldung fehlgeschlagen');
    } finally {
      this.loading = false;
    }
  }
}
