import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { formatAppError } from '../../core/error-format';

@Component({
  selector: 'app-auth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  template: `
    <main class="page auth-callback-page">
      <section class="panel auth-callback-panel" aria-live="polite">
        <h1>Anmeldung wird abgeschlossen</h1>
        <p [class.error]="isError()">{{ message() }}</p>
        @if (isError()) {
          <button mat-flat-button type="button" class="action-btn" (click)="goToLogin()">
            Zur Anmeldung
          </button>
        }
      </section>
    </main>
  `,
  styles: [`
    .auth-callback-page {
      min-height: calc(100vh - 180px);
      align-content: center;
    }

    .auth-callback-panel {
      display: grid;
      gap: 0.8rem;
      text-align: left;
    }

    h1 {
      font-size: 1.5rem;
      line-height: 1.15;
      margin: 0;
    }

    p {
      margin: 0;
      color: var(--ink-500);
    }

    .error {
      color: var(--danger-400);
    }
  `]
})
export class AuthCallbackComponent {
  readonly message = signal('Bitte kurz warten ...');
  readonly isError = signal(false);

  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private hasCompleted = false;

  constructor() {
    void this.completeOAuthSignIn();
  }

  async goToLogin(): Promise<void> {
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  private async completeOAuthSignIn(): Promise<void> {
    if (this.hasCompleted || typeof window === 'undefined') {
      return;
    }
    this.hasCompleted = true;

    try {
      const query = new URLSearchParams(window.location.search);
      const providerError = query.get('error_description') || query.get('error');
      if (providerError) {
        throw new Error(providerError);
      }

      const authCode = query.get('code');
      if (authCode) {
        const { error } = await this.supabaseService.client.auth.exchangeCodeForSession(authCode);
        if (error) {
          throw error;
        }
      }

      await this.authService.restoreSession();
      if (!this.authService.user()) {
        throw new Error('Keine Session nach OAuth-Callback gefunden.');
      }

      await this.router.navigate(['/today'], { replaceUrl: true });
    } catch (error: unknown) {
      this.isError.set(true);
      this.message.set(formatAppError(error, 'Google-Anmeldung konnte nicht abgeschlossen werden'));
    }
  }
}
