import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const THEME_SEED_STORAGE_KEY = 'trackerbroo:theme-seed';
const THEME_MODE_STORAGE_KEY = 'trackerbroo:theme-mode';
const DEFAULT_THEME_SEED = '#78b457';

export type ThemeMode = 'system' | 'light' | 'dark';

type DynamicRole = {
  getArgb: (scheme: unknown) => number;
};

type MaterialColorUtilitiesModule = {
  Hct: { fromInt: (argb: number) => unknown };
  SchemeTonalSpot: new (sourceColorHct: unknown, isDark: boolean, contrastLevel: number) => unknown;
  MaterialDynamicColors: unknown;
  argbFromHex: (hex: string) => number;
  hexFromArgb: (argb: number) => string;
};

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly currentSeed = signal(DEFAULT_THEME_SEED);
  private readonly currentMode = signal<ThemeMode>('system');
  private materialUtilsPromise: Promise<MaterialColorUtilitiesModule> | null = null;
  private applyRequestId = 0;
  private mediaQueryListenerBound = false;

  private readonly roleMap: Record<string, string> = {
    '--m3-sys-color-primary': 'primary',
    '--m3-sys-color-on-primary': 'onPrimary',
    '--m3-sys-color-primary-container': 'primaryContainer',
    '--m3-sys-color-on-primary-container': 'onPrimaryContainer',
    '--m3-sys-color-secondary': 'secondary',
    '--m3-sys-color-on-secondary': 'onSecondary',
    '--m3-sys-color-secondary-container': 'secondaryContainer',
    '--m3-sys-color-on-secondary-container': 'onSecondaryContainer',
    '--m3-sys-color-tertiary': 'tertiary',
    '--m3-sys-color-on-tertiary': 'onTertiary',
    '--m3-sys-color-tertiary-container': 'tertiaryContainer',
    '--m3-sys-color-on-tertiary-container': 'onTertiaryContainer',
    '--m3-sys-color-error': 'error',
    '--m3-sys-color-on-error': 'onError',
    '--m3-sys-color-error-container': 'errorContainer',
    '--m3-sys-color-on-error-container': 'onErrorContainer',
    '--m3-sys-color-background': 'background',
    '--m3-sys-color-on-background': 'onBackground',
    '--m3-sys-color-surface': 'surface',
    '--m3-sys-color-on-surface': 'onSurface',
    '--m3-sys-color-surface-variant': 'surfaceVariant',
    '--m3-sys-color-on-surface-variant': 'onSurfaceVariant',
    '--m3-sys-color-outline': 'outline',
    '--m3-sys-color-outline-variant': 'outlineVariant',
    '--m3-sys-color-surface-container-lowest': 'surfaceContainerLowest',
    '--m3-sys-color-surface-container-low': 'surfaceContainerLow',
    '--m3-sys-color-surface-container': 'surfaceContainer',
    '--m3-sys-color-surface-container-high': 'surfaceContainerHigh',
    '--m3-sys-color-surface-container-highest': 'surfaceContainerHighest',
    '--m3-sys-color-surface-tint': 'surfaceTint',
  };

  initialize(): void {
    this.applyMode(this.readStoredMode(), { persistLocal: false });
    const storedSeed = this.readStoredSeed();
    this.applySeed(storedSeed ?? DEFAULT_THEME_SEED, { persistLocal: false });
    this.bindSystemPreferenceListener();
  }

  getDefaultSeed(): string {
    return DEFAULT_THEME_SEED;
  }

  getCurrentSeed(): string {
    return this.currentSeed();
  }

  getCurrentMode(): ThemeMode {
    return this.currentMode();
  }

  applySeed(seed: string | null | undefined, options?: { persistLocal?: boolean }): string {
    const normalizedSeed = this.normalizeSeed(seed) || DEFAULT_THEME_SEED;
    this.currentSeed.set(normalizedSeed);

    if (options?.persistLocal !== false) {
      this.persistSeed(normalizedSeed);
    }

    const root = this.document?.documentElement;
    if (!root) {
      return normalizedSeed;
    }

    const requestId = this.applyRequestId + 1;
    this.applyRequestId = requestId;
    void this.applySeedToRoot(normalizedSeed, requestId);

    return normalizedSeed;
  }

  applyMode(mode: ThemeMode | null | undefined, options?: { persistLocal?: boolean }): ThemeMode {
    const normalizedMode = this.normalizeMode(mode);
    this.currentMode.set(normalizedMode);

    if (options?.persistLocal !== false && typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_MODE_STORAGE_KEY, normalizedMode);
    }

    this.syncRootThemeMode();
    this.applySeed(this.currentSeed(), { persistLocal: false });

    return normalizedMode;
  }

  readStoredSeed(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawSeed = localStorage.getItem(THEME_SEED_STORAGE_KEY);
    return this.normalizeSeed(rawSeed);
  }

  readStoredMode(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }

    return this.normalizeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY));
  }

  private persistSeed(seed: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(THEME_SEED_STORAGE_KEY, seed);
  }

  private async applySeedToRoot(seed: string, requestId: number): Promise<void> {
    try {
      const materialUtils = await this.ensureMaterialUtils();
      if (requestId !== this.applyRequestId) {
        return;
      }

      const root = this.document?.documentElement;
      if (!root) {
        return;
      }

      const sourceColor = materialUtils.argbFromHex(seed);
      const sourceHct = materialUtils.Hct.fromInt(sourceColor);
      const isDark = this.resolveActiveTheme() === 'dark';
      const scheme = new materialUtils.SchemeTonalSpot(sourceHct, isDark, 0);
      const dynamicColors = materialUtils.MaterialDynamicColors as Record<string, DynamicRole>;
      const style = root.style;

      for (const [cssVar, roleName] of Object.entries(this.roleMap)) {
        const role = dynamicColors[roleName];
        if (!role) {
          continue;
        }

        style.setProperty(cssVar, materialUtils.hexFromArgb(role.getArgb(scheme)));
      }

      this.updateBrowserChrome(
        style.getPropertyValue('--m3-sys-color-surface').trim() ||
          materialUtils.hexFromArgb(dynamicColors['surface'].getArgb(scheme)),
      );
    } catch {
      // Keep fallback CSS vars when dynamic color utilities fail to load.
    }
  }

  private ensureMaterialUtils(): Promise<MaterialColorUtilitiesModule> {
    if (!this.materialUtilsPromise) {
      this.materialUtilsPromise =
        import('@material/material-color-utilities') as unknown as Promise<MaterialColorUtilitiesModule>;
    }
    return this.materialUtilsPromise;
  }

  private resolveActiveTheme(): 'light' | 'dark' {
    const mode = this.currentMode();
    if (mode === 'light' || mode === 'dark') {
      return mode;
    }
    return this.isDarkModePreferred() ? 'dark' : 'light';
  }

  private isDarkModePreferred(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private syncRootThemeMode(): void {
    const root = this.document?.documentElement;
    if (!root) {
      return;
    }

    const resolvedTheme = this.resolveActiveTheme();
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    this.updateBrowserChrome(root.style.getPropertyValue('--m3-sys-color-surface').trim());
  }

  private updateBrowserChrome(themeColor: string): void {
    if (!themeColor) {
      return;
    }

    const metaTheme = this.document?.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeColor);
    }

    const appleStatusBar = this.document?.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    if (appleStatusBar) {
      appleStatusBar.setAttribute(
        'content',
        this.resolveActiveTheme() === 'dark' ? 'black-translucent' : 'default',
      );
    }
  }

  private normalizeMode(mode: string | null | undefined): ThemeMode {
    return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
  }

  private bindSystemPreferenceListener(): void {
    if (
      this.mediaQueryListenerBound ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (this.currentMode() !== 'system') {
        return;
      }
      this.syncRootThemeMode();
      this.applySeed(this.currentSeed(), { persistLocal: false });
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onChange);
    }

    this.mediaQueryListenerBound = true;
  }

  private normalizeSeed(seed: string | null | undefined): string | null {
    if (!seed || typeof seed !== 'string') {
      return null;
    }

    const trimmed = seed.trim();
    if (!trimmed) {
      return null;
    }

    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const validHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash);
    if (!validHex) {
      return null;
    }

    if (withHash.length === 4) {
      const r = withHash[1];
      const g = withHash[2];
      const b = withHash[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }

    return withHash.toLowerCase();
  }
}
