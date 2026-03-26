import { Injectable, computed, signal } from '@angular/core';

export type JourneyKey = 'food_log' | 'weight_log' | 'graph_check';
export type JourneyOutcome = 'success' | 'cancelled' | 'failed';

interface JourneyEvent {
  id: string;
  key: JourneyKey;
  type: 'start' | 'complete';
  timestamp: string;
  duration_ms?: number;
  outcome?: JourneyOutcome;
  context?: Record<string, unknown>;
}

interface ActiveJourney {
  id: string;
  key: JourneyKey;
  startedAtMs: number;
  context?: Record<string, unknown>;
}

export interface JourneyMetric {
  key: JourneyKey;
  samples: number;
  medianMs: number | null;
  p75Ms: number | null;
  completionRate: number;
}

@Injectable({
  providedIn: 'root',
})
export class InteractionTelemetryService {
  private readonly storageKey = 'trackerbroo:telemetry:v1';
  private readonly maxEvents = 800;
  private readonly revision = signal(0);
  private readonly activeJourneys = new Map<string, ActiveJourney>();

  readonly updatedAt = computed(() => this.revision());

  startJourney(key: JourneyKey, context?: Record<string, unknown>): string {
    const id = this.createId(key);
    const start = {
      id,
      key,
      startedAtMs: Date.now(),
      context,
    } satisfies ActiveJourney;

    this.activeJourneys.set(id, start);
    this.pushEvent({
      id,
      key,
      type: 'start',
      timestamp: new Date(start.startedAtMs).toISOString(),
      context,
    });

    return id;
  }

  startJourneyIfMissing(key: JourneyKey, context?: Record<string, unknown>): string {
    const existing = [...this.activeJourneys.values()].find((item) => item.key === key);
    if (existing) {
      return existing.id;
    }
    return this.startJourney(key, context);
  }

  completeJourney(
    id: string,
    outcome: JourneyOutcome = 'success',
    context?: Record<string, unknown>,
  ): void {
    const journey = this.activeJourneys.get(id);
    if (!journey) {
      return;
    }

    const finishedAt = Date.now();
    const durationMs = Math.max(0, finishedAt - journey.startedAtMs);

    this.activeJourneys.delete(id);
    this.pushEvent({
      id,
      key: journey.key,
      type: 'complete',
      timestamp: new Date(finishedAt).toISOString(),
      duration_ms: durationMs,
      outcome,
      context: { ...(journey.context || {}), ...(context || {}) },
    });
  }

  cancelJourney(id: string, context?: Record<string, unknown>): void {
    this.completeJourney(id, 'cancelled', context);
  }

  failJourney(id: string, context?: Record<string, unknown>): void {
    this.completeJourney(id, 'failed', context);
  }

  getJourneyMetrics(days = 30): JourneyMetric[] {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const events = this.readEvents().filter((event) => Date.parse(event.timestamp) >= sinceMs);

    const keys: JourneyKey[] = ['food_log', 'weight_log', 'graph_check'];
    return keys.map((key) => {
      const starts = events.filter((event) => event.key === key && event.type === 'start').length;
      const completes = events.filter((event) => event.key === key && event.type === 'complete');
      const successDurations = completes
        .filter((event) => event.outcome === 'success' && Number.isFinite(event.duration_ms))
        .map((event) => Number(event.duration_ms || 0));

      return {
        key,
        samples: successDurations.length,
        medianMs: this.percentile(successDurations, 50),
        p75Ms: this.percentile(successDurations, 75),
        completionRate: starts === 0 ? 0 : Number((completes.length / starts).toFixed(2)),
      } satisfies JourneyMetric;
    });
  }

  private createId(key: JourneyKey): string {
    const random = Math.random().toString(36).slice(2, 8);
    return `${key}_${Date.now()}_${random}`;
  }

  private percentile(values: number[], pct: number): number | null {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.max(
      0,
      Math.min(sorted.length - 1, Math.round((pct / 100) * (sorted.length - 1))),
    );
    return Math.round(sorted[rank]);
  }

  private pushEvent(event: JourneyEvent): void {
    const current = this.readEvents();
    const next = [...current, event].slice(-this.maxEvents);
    this.writeEvents(next);
  }

  private readEvents(): JourneyEvent[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as JourneyEvent[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(this.isJourneyEvent);
    } catch {
      return [];
    }
  }

  private writeEvents(events: JourneyEvent[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(events));
    this.revision.update((value) => value + 1);
  }

  private isJourneyEvent(value: unknown): value is JourneyEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Partial<JourneyEvent>;
    return (
      typeof item.id === 'string' &&
      typeof item.key === 'string' &&
      (item.type === 'start' || item.type === 'complete') &&
      typeof item.timestamp === 'string'
    );
  }
}
