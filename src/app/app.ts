import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { RouterOutlet, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { BottomNavComponent } from './ui/bottom-nav.component';
import { TopBarComponent } from './ui/top-bar.component';
import { AuthService } from './core/auth.service';
import { SupabaseService } from './core/supabase.service';
import { ThemeService } from './core/theme.service';
import { AppNavKey, AppRouteData, AppShellVariant } from './app.routes';
import { AppChromeService } from './core/app-chrome.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, CommonModule, BottomNavComponent, TopBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly themeService = inject(ThemeService);
  private readonly chromeService = inject(AppChromeService);
  private readonly currentRoute = signal('/');
  private readonly currentRouteData = signal<AppRouteData>({
    shell: 'app',
    title: 'Heute',
    nav: 'today',
    accentLabel: 'Broo Board',
  });
  private readonly isKeyboardOpen = signal(false);
  private readonly viewportWidth = signal(typeof window === 'undefined' ? 390 : window.innerWidth);
  private routeSubscription: Subscription | null = null;
  private viewportBaseHeight = 0;
  private themeLoadRequestId = 0;
  private lastThemeUserId: string | null = null;

  // Use computed signal to determine if nav should be shown
  readonly shellVariant = computed<AppShellVariant>(() => this.currentRouteData().shell);
  readonly showNav = computed(
    () => this.shellVariant() === 'app' && !this.chromeService.suppressAppChrome(),
  );
  readonly showTopBar = computed(
    () => this.shellVariant() !== 'auth' && !this.chromeService.suppressAppChrome(),
  );
  readonly chromeSuppressed = computed(() => this.chromeService.suppressAppChrome());
  readonly currentTitle = computed(() => this.currentRouteData().title);
  readonly currentAccentLabel = computed(
    () => this.currentRouteData().accentLabel ?? 'Tracker Broo',
  );
  readonly currentNavKey = computed<AppNavKey>(() => this.currentRouteData().nav);
  readonly layoutMode = computed<'compact' | 'medium' | 'expanded'>(() => {
    const width = this.viewportWidth();
    if (width >= 1200) {
      return 'expanded';
    }
    if (width >= 840) {
      return 'medium';
    }
    return 'compact';
  });
  readonly isCompact = computed(() => this.layoutMode() === 'compact');
  readonly isMedium = computed(() => this.layoutMode() === 'medium');
  readonly isExpanded = computed(() => this.layoutMode() === 'expanded');

  constructor() {
    this.themeService.initialize();

    effect(() => {
      const userId = this.authService.user()?.id || null;
      void this.syncThemeForUser(userId);
    });

    this.routeSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.currentRoute.set(event.url);
        this.currentRouteData.set(this.readRouteData());
      });

    this.currentRouteData.set(this.readRouteData());

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize, { passive: true });
      this.setupMobileViewportHandlers();
    }
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    if (typeof window !== 'undefined') {
      window.visualViewport?.removeEventListener('resize', this.handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', this.handleViewportChange);
      window.removeEventListener('focusin', this.handleViewportChange);
      window.removeEventListener('focusout', this.handleViewportChange);
      window.removeEventListener('resize', this.handleWindowResize);
    }
  }

  private readonly handleWindowResize = (): void => {
    this.viewportWidth.set(window.innerWidth);
  };

  protected keyboardOpen(): boolean {
    return this.isKeyboardOpen();
  }

  protected route(): string {
    return this.currentRoute();
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

    this.viewportWidth.set(window.innerWidth);

    const isPhoneWidth = this.isCompact();
    const currentHeight = visualViewport.height;
    const activeElement = document.activeElement;
    const activeIsInput =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    if (currentHeight > this.viewportBaseHeight - 40) {
      this.viewportBaseHeight = Math.max(this.viewportBaseHeight, currentHeight);
    }

    const heightDelta = this.viewportBaseHeight - currentHeight;
    const keyboardOpen = isPhoneWidth && activeIsInput && heightDelta > 130;

    this.isKeyboardOpen.set(keyboardOpen);
  };

  private async syncThemeForUser(userId: string | null): Promise<void> {
    const requestId = this.themeLoadRequestId + 1;
    this.themeLoadRequestId = requestId;

    if (!userId) {
      this.lastThemeUserId = null;
      const seed = this.themeService.readStoredSeed() || this.themeService.getDefaultSeed();
      this.themeService.applySeed(seed, { persistLocal: true });
      return;
    }

    if (this.lastThemeUserId === userId) {
      return;
    }

    this.lastThemeUserId = userId;

    try {
      const { data } = await this.supabaseService.client
        .from('profiles')
        .select('theme_seed_color')
        .eq('user_id', userId)
        .maybeSingle();

      if (requestId !== this.themeLoadRequestId) {
        return;
      }

      const profileSeed = (data as { theme_seed_color?: string | null } | null)?.theme_seed_color;
      const resolvedSeed =
        profileSeed || this.themeService.readStoredSeed() || this.themeService.getDefaultSeed();
      this.themeService.applySeed(resolvedSeed, { persistLocal: true });
    } catch {
      if (requestId !== this.themeLoadRequestId) {
        return;
      }
      const fallbackSeed = this.themeService.readStoredSeed() || this.themeService.getDefaultSeed();
      this.themeService.applySeed(fallbackSeed, { persistLocal: true });
    }
  }

  private readRouteData(): AppRouteData {
    let snapshot: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;

    while (snapshot?.firstChild) {
      snapshot = snapshot.firstChild;
    }

    const data = snapshot?.data as Partial<AppRouteData> | undefined;
    return {
      shell: data?.shell ?? 'app',
      title: data?.title ?? 'Tracker Broo',
      nav: data?.nav ?? null,
      accentLabel: data?.accentLabel ?? 'Tracker Broo',
    };
  }
}
