import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page login-page">
      <section class="panel hero" aria-labelledby="login-title">
        <p class="title-font crest">Shinobi Nutrition Log</p>
        <h1 id="login-title">Enter The Village</h1>
        <p class="subtitle">Track macros with your squad using a manga-inspired dashboard.</p>
      </section>

      <section class="panel auth-panel" aria-label="Sign in">
        <button type="button" class="action-btn ghost provider" (click)="signInWithGoogle()">
          <span aria-hidden="true">🌀</span>
          Continue with Google
        </button>

        <div class="divider" role="separator" aria-label="or">or</div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <label for="email" class="sr-only">Email</label>
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
            {{ loading ? 'Sending Scroll...' : 'Send Magic Link' }}
          </button>
        </form>

        @if (message) {
          <p class="message" aria-live="polite">{{ message }}</p>
        }
      </section>
    </main>
  `,
  styles: [`
    .login-page {
      display: grid;
      gap: 0.9rem;
      min-height: calc(100vh - 88px);
      align-content: center;
    }

    .hero {
      text-align: center;
      background: linear-gradient(145deg, #fff4d4 0%, #f1d8a6 100%);
    }

    .crest {
      color: #8a3d14;
      font-size: 1.1rem;
    }

    h1 {
      font-size: 2.1rem;
      margin-top: 0.25rem;
    }

    .subtitle {
      margin: 0.35rem 0 0;
      color: #3b2a1f;
      font-weight: 700;
    }

    .auth-panel {
      display: grid;
      gap: 0.8rem;
    }

    .provider {
      width: 100%;
    }

    form {
      display: grid;
      gap: 0.65rem;
    }

    .divider {
      text-align: center;
      font-weight: 800;
      color: #6f3f1f;
    }

    .message {
      margin: 0;
      padding: 0.6rem 0.7rem;
      border: 2px solid #2f1f15;
      border-radius: 10px;
      background: #ffe9bc;
      font-weight: 700;
      color: #5a2f14;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  loading = false;
  message = '';

  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.route.fragment.subscribe(fragment => {
      if (fragment && fragment.includes('access_token')) {
        setTimeout(() => {
          if (this.authService.user()) {
            this.router.navigate(['/today']);
          }
        }, 100);
      }
    });

    if (this.authService.user()) {
      this.router.navigate(['/today']);
    }
  }

  async onSubmit() {
    this.loading = true;
    this.message = '';
    try {
      await this.authService.signIn(this.email);
      this.message = 'Check your email for the magic link.';
    } catch (error: unknown) {
      this.message = error instanceof Error ? error.message : 'Sign-in failed.';
    } finally {
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch (error: unknown) {
      this.message = error instanceof Error ? error.message : 'Google sign-in failed.';
    }
  }
}
