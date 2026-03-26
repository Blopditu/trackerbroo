import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { User } from './types';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly onboardingCompleted = signal<boolean | null>(null);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private restoreSessionPromise: Promise<void> | null = null;

  constructor() {
    this.supabaseService.client.auth.onAuthStateChange((_, session) => {
      this.applySession(session);
    });
    void this.restoreSession();
  }

  async signIn(email: string) {
    const callbackUrl = this.getAuthCallbackUrl();
    const { error } = await this.supabaseService.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });
    if (error) throw error;
  }

  async signInWithGoogle() {
    const callbackUrl = this.getAuthCallbackUrl();
    const { error } = await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();
    if (error) throw error;
    const userId = this.user()?.id;
    if (userId && typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.onboardingStorageKey(userId));
    }
    this.onboardingCompleted.set(null);
    this.router.navigate(['/login']);
  }

  async restoreSession(): Promise<void> {
    if (this.restoreSessionPromise) {
      await this.restoreSessionPromise;
      return;
    }

    this.restoreSessionPromise = this.supabaseService.client.auth
      .getSession()
      .then(({ data: { session } }) => {
        this.applySession(session);
      })
      .finally(() => {
        this.restoreSessionPromise = null;
      });

    await this.restoreSessionPromise;
  }

  async isUserAuthenticated(): Promise<boolean> {
    if (!this.user()) {
      await this.restoreSession();
    }
    return this.user() !== null;
  }

  get isAuthenticated() {
    return this.user() !== null;
  }

  setOnboardingCompleted(value: boolean | null): void {
    this.onboardingCompleted.set(value);
    const userId = this.user()?.id;
    if (!userId || typeof localStorage === 'undefined') {
      return;
    }

    if (value === null) {
      localStorage.removeItem(this.onboardingStorageKey(userId));
      return;
    }

    localStorage.setItem(this.onboardingStorageKey(userId), value ? '1' : '0');
  }

  private applySession(session: { user?: { id: string; email?: string | null } } | null): void {
    if (!session?.user) {
      this.user.set(null);
      this.onboardingCompleted.set(null);
      return;
    }

    this.user.set({
      id: session.user.id,
      email: session.user.email || '',
    });

    this.onboardingCompleted.set(this.readOnboardingFlag(session.user.id));
  }

  private getAuthCallbackUrl(): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'http://localhost:4200/auth/callback';
    }

    const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
    const normalizedBaseHref = baseHref.startsWith('/') ? baseHref : `/${baseHref}`;
    const appBaseUrl = new URL(normalizedBaseHref, window.location.origin);

    return new URL('auth/callback', appBaseUrl).toString();
  }

  private readOnboardingFlag(userId: string): boolean | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawValue = localStorage.getItem(this.onboardingStorageKey(userId));
    if (rawValue === '1') {
      return true;
    }
    if (rawValue === '0') {
      return false;
    }
    return null;
  }

  private onboardingStorageKey(userId: string): string {
    return `trackerbroo:onboarding:${userId}`;
  }
}
