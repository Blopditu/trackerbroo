import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { BottomNavComponent } from './ui/bottom-nav.component';
import { TopBarComponent } from './ui/top-bar.component';
import { PwaInstallService } from './core/pwa-install.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, BottomNavComponent, TopBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnDestroy {
  protected readonly title = signal('proteintracker');

  private readonly router = inject(Router);
  readonly pwaInstall = inject(PwaInstallService);
  private readonly currentRoute = signal('/');
  private readonly isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private readonly isKeyboardOpen = signal(false);
  private routeSubscription: Subscription | null = null;
  private viewportBaseHeight = 0;

  // Use computed signal to determine if nav should be shown
  showNav = computed(() => !this.currentRoute().includes('/login') && !this.currentRoute().includes('/onboarding'));
  showTopBar = computed(() => !this.currentRoute().includes('/login') && !this.currentRoute().includes('/onboarding'));
  showOfflineBanner = computed(() => !this.isOnline() && this.showTopBar());
  showInstallBanner = computed(() => this.showNav() && this.pwaInstall.canPrompt() && !this.isKeyboardOpen());

  constructor() {
    this.routeSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
      });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineStatus);
      window.addEventListener('offline', this.handleOnlineStatus);
      this.setupMobileViewportHandlers();
    }
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineStatus);
      window.removeEventListener('offline', this.handleOnlineStatus);
      window.visualViewport?.removeEventListener('resize', this.handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', this.handleViewportChange);
      window.removeEventListener('focusin', this.handleViewportChange);
      window.removeEventListener('focusout', this.handleViewportChange);
    }
  }

  private readonly handleOnlineStatus = (): void => {
    this.isOnline.set(typeof navigator === 'undefined' ? true : navigator.onLine);
  };

  async installApp(): Promise<void> {
    await this.pwaInstall.promptInstall();
  }

  dismissInstallBanner(): void {
    this.pwaInstall.dismiss();
  }

  protected keyboardOpen(): boolean {
    return this.isKeyboardOpen();
  }

  private setupMobileViewportHandlers(): void {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return;
    }

    this.viewportBaseHeight = visualViewport.height;
    visualViewport.addEventListener('resize', this.handleViewportChange);
    visualViewport.addEventListener('scroll', this.handleViewportChange);
    window.addEventListener('focusin', this.handleViewportChange);
    window.addEventListener('focusout', this.handleViewportChange);
  }

  private readonly handleViewportChange = (): void => {
    if (typeof window === 'undefined') {
      return;
    }

    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return;
    }

    const isPhoneWidth = window.innerWidth <= 900;
    const currentHeight = visualViewport.height;
    const activeElement = document.activeElement;
    const activeIsInput =
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLTextAreaElement
      || activeElement instanceof HTMLSelectElement
      || (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    if (currentHeight > this.viewportBaseHeight - 40) {
      this.viewportBaseHeight = Math.max(this.viewportBaseHeight, currentHeight);
    }

    const heightDelta = this.viewportBaseHeight - currentHeight;
    const keyboardOpen = isPhoneWidth && activeIsInput && heightDelta > 130;

    this.isKeyboardOpen.set(keyboardOpen);
  };
}
