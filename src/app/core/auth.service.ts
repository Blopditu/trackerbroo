import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { User } from './types';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  user = signal<User | null>(null);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.user.set({
          id: session.user.id,
          email: session.user.email || ''
        });
      } else {
        this.user.set(null);
      }
    });

    // Check for existing session
    this.supabaseService.client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.user.set({
          id: session.user.id,
          email: session.user.email || ''
        });
      }
    });
  }

  async signIn(email: string) {
    const { error } = await this.supabaseService.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
  }

  async signInWithGoogle() {
    const { error } = await this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.supabaseService.client.auth.signOut();
    if (error) throw error;
    this.router.navigate(['/login']);
  }

  get isAuthenticated() {
    return this.user() !== null;
  }
}