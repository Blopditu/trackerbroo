import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'group',
    redirectTo: 'community',
    pathMatch: 'full'
  },
  {
    path: 'today',
    loadComponent: () => import('./features/today/today.component').then(m => m.TodayComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'library',
    loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'gym',
    loadComponent: () => import('./features/gym/gym.component').then(m => m.GymComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'dashboard',
    redirectTo: 'insights',
    pathMatch: 'full'
  },
  {
    path: 'insights',
    loadComponent: () => import('./features/insights/insights.component').then(m => m.InsightsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'community',
    loadComponent: () => import('./features/community/community.component').then(m => m.CommunityComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: '/today',
    pathMatch: 'full'
  }
];
