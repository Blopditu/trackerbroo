import { Injectable } from '@angular/core';

type CacheSource = 'cache' | 'network' | 'stale';

interface CacheRecord<T> {
  value: T;
  expiresAt: number;
  updatedAt: number;
}

export interface CachedLoadResult<T> {
  value: T;
  source: CacheSource;
}

interface LoadOptions<T> {
  key: string;
  ttlMs: number;
  loader: () => Promise<T>;
  forceRefresh?: boolean;
  allowStaleOnError?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class QueryCacheService {
  private readonly prefix = 'trackerbroo:cache:v1:';
  private readonly inFlight = new Map<string, Promise<CachedLoadResult<unknown>>>();

  async getOrLoad<T>(options: LoadOptions<T>): Promise<CachedLoadResult<T>> {
    const forceRefresh = Boolean(options.forceRefresh);
    const allowStaleOnError = options.allowStaleOnError !== false;

    if (!forceRefresh) {
      const fresh = this.getFresh<T>(options.key);
      if (fresh !== null) {
        return { value: fresh, source: 'cache' };
      }
    }

    const existing = this.inFlight.get(options.key);
    if (existing) {
      return (await existing) as CachedLoadResult<T>;
    }

    const request = this.loadAndCache(options, allowStaleOnError);
    this.inFlight.set(options.key, request as Promise<CachedLoadResult<unknown>>);

    try {
      return await request;
    } finally {
      this.inFlight.delete(options.key);
    }
  }

  getFresh<T>(key: string): T | null {
    const entry = this.read<T>(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      return null;
    }
    return entry.value;
  }

  getStale<T>(key: string): T | null {
    const entry = this.read<T>(key);
    return entry?.value ?? null;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (!this.hasStorage()) {
      return;
    }

    const now = Date.now();
    const entry: CacheRecord<T> = {
      value,
      updatedAt: now,
      expiresAt: now + ttlMs,
    };

    try {
      localStorage.setItem(this.resolveKey(key), JSON.stringify(entry));
    } catch {
      // Cache writes are best-effort.
    }
  }

  invalidate(key: string): void {
    if (!this.hasStorage()) {
      return;
    }
    localStorage.removeItem(this.resolveKey(key));
  }

  invalidatePrefix(prefix: string): void {
    if (!this.hasStorage()) {
      return;
    }

    const fullPrefix = this.resolveKey(prefix);
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const currentKey = localStorage.key(i);
      if (currentKey?.startsWith(fullPrefix)) {
        keysToDelete.push(currentKey);
      }
    }

    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
  }

  private async loadAndCache<T>(
    options: LoadOptions<T>,
    allowStaleOnError: boolean,
  ): Promise<CachedLoadResult<T>> {
    try {
      const value = await options.loader();
      this.set(options.key, value, options.ttlMs);
      return { value, source: 'network' };
    } catch (error: unknown) {
      if (allowStaleOnError) {
        const stale = this.getStale<T>(options.key);
        if (stale !== null) {
          return { value: stale, source: 'stale' };
        }
      }
      throw error;
    }
  }

  private read<T>(key: string): CacheRecord<T> | null {
    if (!this.hasStorage()) {
      return null;
    }

    const raw = localStorage.getItem(this.resolveKey(key));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CacheRecord<T>;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !('value' in parsed) ||
        !('expiresAt' in parsed)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private resolveKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }
}
