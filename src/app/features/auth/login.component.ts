import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page login-page">
      @if (message) {
        <p class="toast" [class.error]="isError" [class.success]="!isError" aria-live="polite">{{ message }}</p>
      }

      <section class="panel halftone hero" aria-labelledby="login-title">
        <p class="title-font crest">TRACKER BROO</p>
        <h1 id="login-title">Train Together. Eat Better.</h1>
        <div class="hero-note">
          <div class="mascot" aria-hidden="true">◉</div>
          <p class="manga-bubble">Your squad log for protein, gym check-ins, and consistency streaks.</p>
        </div>
      </section>

      <section class="panel auth-panel" aria-label="Sign in">
        <button type="button" class="action-btn ghost provider" (click)="signInWithGoogle()" [disabled]="loading">
          Sign in with Google
        </button>

        <div class="divider" role="separator" aria-label="or">or</div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm" class="stack">
          <label for="email" class="label">Email</label>
          <input
            id="email"
            type="email"
            [(ngModel)]="email"
            name="email"
            placeholder="name@village.com"
            required
            email
            autocomplete="email"
          >

          <button type="submit" class="action-btn" [disabled]="!loginForm.valid || loading">
            {{ loading ? 'Sending link...' : 'Send Magic Link' }}
          </button>
        </form>
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
      gap: 0.65rem;
      text-align: left;
    }

    .crest {
      color: #0369a1;
      font-size: 1rem;
    }

    h1 {
      font-size: 1.8rem;
      line-height: 1.1;
    }

    .hero-note {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.55rem;
      align-items: center;
    }

    .auth-panel {
      display: grid;
      gap: 0.8rem;
    }

    .provider {
      width: 100%;
    }

    .divider {
      text-align: center;
      color: var(--ink-500);
      font-weight: 700;
      font-size: var(--text-sm);
    }

    .stack {
      display: grid;
      gap: 0.6rem;
    }

    .label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  loading = false;
  message = '';
  isError = false;

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.fragment.subscribe(fragment => {
      if (fragment && fragment.includes('access_token')) {
        setTimeout(() => {
          if (this.authService.user()) {
            void this.router.navigate(['/today']);
          }
        }, 100);
      }
    });

    if (this.authService.user()) {
      void this.router.navigate(['/today']);
    }
  }

  async onSubmit() {
    this.loading = true;
    this.message = '';
    this.isError = false;
    try {
      await this.authService.signIn(this.email);
      this.message = 'Check your email for the magic link.';
    } catch (error: unknown) {
      this.isError = true;
      this.message = error instanceof Error ? error.message : 'Sign-in failed.';
    } finally {
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    this.isError = false;
    this.message = '';
    try {
      await this.authService.signInWithGoogle();
    } catch (error: unknown) {
      this.isError = true;
      this.message = error instanceof Error ? error.message : 'Google sign-in failed.';
    }
  }
}
