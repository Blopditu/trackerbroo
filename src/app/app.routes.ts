import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';

export type AppShellVariant = 'app' | 'auth' | 'onboarding';
export type AppNavKey = 'today' | 'gym' | 'library' | 'community' | 'profile' | 'insights' | null;

export interface AppRouteData {
  shell: AppShellVariant;
  title: string;
  nav: AppNavKey;
  accentLabel?: string;
}

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    data: {
      shell: 'auth',
      title: 'Anmelden',
      nav: null,
      accentLabel: 'Tracker Broo'
    } satisfies AppRouteData
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent),
    data: {
      shell: 'auth',
      title: 'Authentifizierung',
      nav: null,
      accentLabel: 'Tracker Broo'
    } satisfies AppRouteData
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'onboarding',
      title: 'Setup',
      nav: null,
      accentLabel: 'Konstanz'
    } satisfies AppRouteData
  },
  {
    path: 'group',
    redirectTo: 'community',
    pathMatch: 'full'
  },
  {
    path: 'today',
    loadComponent: () => import('./features/today/today.component').then(m => m.TodayComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Heute',
      nav: 'today',
      accentLabel: 'Broo Board'
    } satisfies AppRouteData
  },
  {
    path: 'library',
    loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Bibliothek',
      nav: 'library',
      accentLabel: 'Zutaten'
    } satisfies AppRouteData
  },
  {
    path: 'gym',
    loadComponent: () => import('./features/gym/gym.component').then(m => m.GymComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Gym',
      nav: 'gym',
      accentLabel: 'Workout'
    } satisfies AppRouteData
  },
  {
    path: 'dashboard',
    redirectTo: 'insights',
    pathMatch: 'full'
  },
  {
    path: 'insights',
    loadComponent: () => import('./features/insights/insights.component').then(m => m.InsightsComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Insights',
      nav: 'insights',
      accentLabel: 'Verläufe'
    } satisfies AppRouteData
  },
  {
    path: 'community',
    loadComponent: () => import('./features/community/community.component').then(m => m.CommunityComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Community',
      nav: 'community',
      accentLabel: 'Feed'
    } satisfies AppRouteData
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard],
    data: {
      shell: 'app',
      title: 'Profil',
      nav: 'profile',
      accentLabel: 'Einstellungen'
    } satisfies AppRouteData
  },
  {
    path: '',
    redirectTo: '/today',
    pathMatch: 'full'
  }
];
