import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { User } from './types';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly user = signal<User | null>(null);
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
        emailRedirectTo: callbackUrl
      }
    });
    if (error) throw error;
  }

  async signInWithGoogle() {
    const callbackUrl = this.getAuthCallbackUrl();
    const { error } = await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl
      }
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();
    if (error) throw error;
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

  private applySession(session: { user?: { id: string; email?: string | null } } | null): void {
    if (!session?.user) {
      this.user.set(null);
      return;
    }

    this.user.set({
      id: session.user.id,
      email: session.user.email || ''
    });
  }

  private getAuthCallbackUrl(): string {
    const baseUrl =
      typeof document !== 'undefined'
        ? document.baseURI
        : typeof window !== 'undefined'
          ? `${window.location.origin}/`
          : 'http://localhost:4200/';

    return new URL('auth/callback', baseUrl).toString();
  }
}
