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
    <main class="page login-page">
      @if (message) {
        <p class="toast" [class.error]="isError" [class.success]="!isError" role="status" aria-live="polite" aria-atomic="true">{{ message }}</p>
      }

      <section class="panel halftone hero" aria-labelledby="login-title">
        <p class="title-font crest">Tracker Broo</p>
        <h1 id="login-title">Konstanz isch key!</h1>
      </section>

      <section class="panel auth-panel" aria-label="Anmelden">
        <button mat-flat-button type="button" class="action-btn provider google-btn" (click)="signInWithGoogle()" [disabled]="loading">
          <span class="google-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.7 3.8-5.5 3.8-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.8 14.7 2 12 2 6.9 2 2.8 6.5 2.8 12s4.1 10 9.2 10c5.3 0 8.8-3.8 8.8-9.1 0-.6-.1-1.1-.2-1.6H12Z"/>
              <path fill="#34A853" d="M2.8 12c0 2 0.7 3.8 1.9 5.2l3.1-2.4c-.8-.8-1.2-1.8-1.2-2.9s.4-2.2 1.2-2.9L4.7 6.6C3.5 8.1 2.8 10 2.8 12Z"/>
              <path fill="#FBBC05" d="M12 22c2.7 0 4.9-.9 6.6-2.5l-3.2-2.6c-.9.6-2 1-3.4 1-2.5 0-4.6-1.7-5.3-4l-3.2 2.4C5 19.8 8.2 22 12 22Z"/>
              <path fill="#4285F4" d="M18.6 19.5c1.9-1.8 3-4.3 3-7.6 0-.7-.1-1.2-.2-1.7H12v3.9h5.5c-.2 1.1-.8 2-1.7 2.8l2.8 2.6Z"/>
            </svg>
          </span>
          <span>{{ loading ? 'Google wird geöffnet …' : 'Mit Google anmelden' }}</span>
        </button>
      </section>
    </main>
  `,
  styles: [`
    .login-page {
      min-height: calc(100vh - 180px);
      align-content: center;
    }

    .hero {
      display: grid;
      gap: 0.35rem;
      text-align: left;
    }

    .crest {
      color: var(--accent-500);
      font-size: 1rem;
      text-transform: none;
    }

    h1 {
      margin: 0;
      font-size: 1.95rem;
      line-height: 1.1;
    }

    .auth-panel {
      display: grid;
    }

    .provider {
      width: 100%;
      min-height: 56px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-align: center;
    }

    .google-btn {
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      border: 1px solid var(--border-strong);
    }

    .google-mark {
      width: 22px;
      height: 22px;
      border-radius: 999px;
      background: #fff;
      display: inline-grid;
      place-items: center;
      flex: 0 0 auto;
    }

    .google-mark svg {
      width: 16px;
      height: 16px;
    }
  `]
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
