import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  async canActivate(_: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
    const isAuthenticated = await this.authService.isUserAuthenticated();
    if (isAuthenticated) {
      if (state.url.startsWith('/onboarding')) {
        return true;
      }

      const user = this.authService.user();
      if (!user) {
        return true;
      }

      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        return true;
      }

      if (!data?.onboarding_completed) {
        await this.router.navigate(['/onboarding']);
        return false;
      }

      return true;
    }

    await this.router.navigate(['/login']);
    return false;
  }
}
