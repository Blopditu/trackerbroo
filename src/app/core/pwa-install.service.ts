import { Injectable, computed, signal } from '@angular/core';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly isStandalone = signal(this.getStandaloneState());
  readonly dismissed = signal(this.getDismissedState());

  readonly canPrompt = computed(() => {
    return !this.dismissed() && !this.isStandalone() && this.deferredPrompt() !== null;
  });

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', this.onAppInstalled);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => {
      this.isStandalone.set(this.getStandaloneState());
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onDisplayModeChange);
    } else {
      mediaQuery.addListener(onDisplayModeChange);
    }
  }

  async promptInstall(): Promise<InstallOutcome> {
    const event = this.deferredPrompt();
    if (!event) {
      return 'unavailable';
    }

    await event.prompt();
    const { outcome } = await event.userChoice;
    this.deferredPrompt.set(null);

    if (outcome === 'accepted') {
      this.dismissed.set(false);
      this.saveDismissedState(false);
    }

    return outcome;
  }

  dismiss(): void {
    this.dismissed.set(true);
    this.saveDismissedState(true);
  }

  resetDismissed(): void {
    this.dismissed.set(false);
    this.saveDismissedState(false);
  }

  private readonly onBeforeInstallPrompt = (event: BeforeInstallPromptEvent): void => {
    event.preventDefault();
    this.deferredPrompt.set(event);
    this.isStandalone.set(this.getStandaloneState());
  };

  private readonly onAppInstalled = (): void => {
    this.deferredPrompt.set(null);
    this.dismissed.set(false);
    this.saveDismissedState(false);
    this.isStandalone.set(true);
  };

  private getStandaloneState(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const iosStandalone =
      typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === 'boolean'
        ? Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
        : false;

    return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
  }

  private getDismissedState(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    try {
      return localStorage.getItem('pwa-install-dismissed') === '1';
    } catch {
      return false;
    }
  }

  private saveDismissedState(value: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      if (value) {
        localStorage.setItem('pwa-install-dismissed', '1');
      } else {
        localStorage.removeItem('pwa-install-dismissed');
      }
    } catch {
      // ignore storage errors in private mode
    }
  }
}
