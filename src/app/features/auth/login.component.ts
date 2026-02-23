import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>🍎 Protein Tracker</h1>
        <p>Track macros with friends!</p>
        <div class="auth-options">
          <button type="button" class="google-btn" (click)="signInWithGoogle()">
            <span>🔵</span> Continue with Google
          </button>
          <div class="divider">
            <span>or</span>
          </div>
        </div>
        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <input
            type="email"
            [(ngModel)]="email"
            name="email"
            placeholder="Enter your email"
            required
            email
          >
          <button type="submit" [disabled]="!loginForm.valid || loading">
            {{ loading ? 'Sending...' : 'Send Magic Link' }}
          </button>
        </form>
        <p>
          @if (message) {
            {{ message }}
          }
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
    }
    .login-card {
      background: white;
      padding: 2rem;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .auth-options {
      margin-bottom: 1.5rem;
    }
    .google-btn {
      width: 100%;
      padding: 1rem;
      background: white;
      color: #333;
      border: 2px solid #ddd;
      border-radius: 10px;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .google-btn:hover {
      background: #f8f9fa;
      border-color: #ccc;
    }
    .divider {
      position: relative;
      text-align: center;
      margin: 1rem 0;
    }
    .divider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: #ddd;
    }
    .divider span {
      background: white;
      padding: 0 1rem;
      color: #666;
      font-size: 0.9rem;
    }
    input {
      width: 100%;
      padding: 1rem;
      border: 2px solid #eee;
      border-radius: 10px;
      margin-bottom: 1rem;
      font-size: 1rem;
    }
    button {
      width: 100%;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
    // Handle auth callback
    this.route.fragment.subscribe(fragment => {
      if (fragment && fragment.includes('access_token')) {
        // Auth callback - user will be automatically logged in by the auth service
        // Redirect to main app after a short delay to ensure auth state is updated
        setTimeout(() => {
          if (this.authService.user()) {
            this.router.navigate(['/today']);
          }
        }, 100);
      }
    });

    // If user is already authenticated, redirect to main app
    if (this.authService.user()) {
      this.router.navigate(['/today']);
    }
  }

  async onSubmit() {
    this.loading = true;
    this.message = '';
    try {
      await this.authService.signIn(this.email);
      this.message = 'Check your email for the magic link!';
    } catch (error: any) {
      this.message = error.message;
    } finally {
      this.loading = false;
    }
  }

  async signInWithGoogle() {
    try {
      await this.authService.signInWithGoogle();
    } catch (error: any) {
      this.message = error.message;
    }
  }
}