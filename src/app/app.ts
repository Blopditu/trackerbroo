import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { BottomNavComponent } from './ui/bottom-nav.component';
import { TopBarComponent } from './ui/top-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, BottomNavComponent, TopBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  protected readonly title = signal('proteintracker');

  private readonly router = inject(Router);
  private readonly currentRoute = signal('/');
  private readonly isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private routeSubscription: Subscription | null = null;

  // Use computed signal to determine if nav should be shown
  showNav = computed(() => !this.currentRoute().includes('/login') && !this.currentRoute().includes('/onboarding'));
  showTopBar = computed(() => !this.currentRoute().includes('/login') && !this.currentRoute().includes('/onboarding'));
  showOfflineBanner = computed(() => !this.isOnline() && this.showTopBar());

  constructor() {
    this.routeSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
      });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineStatus);
      window.addEventListener('offline', this.handleOnlineStatus);
    }
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineStatus);
      window.removeEventListener('offline', this.handleOnlineStatus);
    }
  }

  private readonly handleOnlineStatus = (): void => {
    this.isOnline.set(typeof navigator === 'undefined' ? true : navigator.onLine);
  };
}
