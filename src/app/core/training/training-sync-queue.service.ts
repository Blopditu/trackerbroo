import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth.service';
import { SupabaseService } from '../supabase.service';
import { TrainingGraphConfig, TrainingMeasurementType } from '../types';

export interface QueueStartSessionPayload {
  planDayId: string;
  sessionDate: string;
  clientRef: string;
}

export interface QueueUpsertSetPayload {
  sessionClientRef: string;
  exerciseSortOrder: number;
  setNumber: number;
  isWarmup: boolean;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  isCompleted: boolean;
  clientRef: string;
}

export interface QueueCompleteSessionPayload {
  sessionClientRef: string;
}

export interface QueueUpsertMeasurementPayload {
  type: TrainingMeasurementType;
  value: number;
  measuredOn: string;
}

export interface QueueSaveGraphConfigsPayload {
  configs: Array<{
    id?: string;
    graph_type: TrainingGraphConfig['graph_type'];
    exercise_id: string | null;
    muscle_group: string | null;
    position: number;
    settings: Record<string, unknown>;
  }>;
}

type QueueAction =
  | 'start_session'
  | 'upsert_set'
  | 'complete_session'
  | 'upsert_measurement'
  | 'save_graph_configs';

interface QueueItem {
  id: string;
  action: QueueAction;
  createdAt: string;
  payload:
    | QueueStartSessionPayload
    | QueueUpsertSetPayload
    | QueueCompleteSessionPayload
    | QueueUpsertMeasurementPayload
    | QueueSaveGraphConfigsPayload;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingSyncQueueService {
  readonly pendingCount = signal(0);

  private readonly storageKey = 'trackerbroo:training:sync-queue:v1';
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private flushing = false;

  constructor() {
    this.syncPendingCount();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleConnectivityEvent);
      window.addEventListener('visibilitychange', this.handleConnectivityEvent);
      void this.flush();
    }
  }

  enqueue(action: QueueAction, payload: QueueItem['payload']): void {
    const current = this.readQueue();
    current.push({
      id: `${action}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      action,
      createdAt: new Date().toISOString(),
      payload
    });
    this.writeQueue(current);
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.isOnline()) {
      return;
    }

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.flushing = true;
    try {
      const queue = this.readQueue();
      const pending: QueueItem[] = [];

      for (const item of queue) {
        try {
          await this.execute(item, user.id);
        } catch {
          pending.push(item);
        }
      }

      this.writeQueue(pending);
    } finally {
      this.flushing = false;
    }
  }

  clear(): void {
    this.writeQueue([]);
  }

  private async execute(item: QueueItem, userId: string): Promise<void> {
    if (item.action === 'start_session') {
      const payload = item.payload as QueueStartSessionPayload;
      const { error } = await this.supabaseService.client.rpc('training_start_session', {
        p_plan_day_id: payload.planDayId,
        p_session_date: payload.sessionDate,
        p_client_ref: payload.clientRef
      });
      if (error) {
        throw error;
      }
      return;
    }

    if (item.action === 'upsert_set') {
      const payload = item.payload as QueueUpsertSetPayload;
      const { error } = await this.supabaseService.client.rpc('training_upsert_set_log_by_client', {
        p_session_client_ref: payload.sessionClientRef,
        p_exercise_sort_order: payload.exerciseSortOrder,
        p_set_number: payload.setNumber,
        p_is_warmup: payload.isWarmup,
        p_weight_kg: payload.weightKg,
        p_reps: payload.reps,
        p_duration_seconds: payload.durationSeconds,
        p_is_completed: payload.isCompleted,
        p_client_ref: payload.clientRef
      });
      if (error) {
        throw error;
      }
      return;
    }

    if (item.action === 'complete_session') {
      const payload = item.payload as QueueCompleteSessionPayload;
      const { error } = await this.supabaseService.client.rpc('training_complete_session_by_client', {
        p_session_client_ref: payload.sessionClientRef
      });
      if (error) {
        throw error;
      }
      return;
    }

    if (item.action === 'upsert_measurement') {
      const payload = item.payload as QueueUpsertMeasurementPayload;
      const { error } = await this.supabaseService.client.from('training_measurements').upsert(
        {
          user_id: userId,
          type: payload.type,
          value: payload.value,
          measured_on: payload.measuredOn
        },
        { onConflict: 'user_id,type,measured_on' }
      );

      if (error) {
        throw error;
      }

      if (payload.type === 'weight') {
        const { error: weightError } = await this.supabaseService.client.from('weight_logs').upsert(
          {
            user_id: userId,
            logged_on: payload.measuredOn,
            weight_kg: payload.value,
            note: null
          },
          { onConflict: 'user_id,logged_on' }
        );

        if (weightError) {
          throw weightError;
        }
      }

      return;
    }

    const payload = item.payload as QueueSaveGraphConfigsPayload;

    const { error: deleteError } = await this.supabaseService.client
      .from('training_graph_configs')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    if (payload.configs.length === 0) {
      return;
    }

    const insertPayload = payload.configs.map(config => ({
      id: config.id,
      user_id: userId,
      graph_type: config.graph_type,
      exercise_id: config.exercise_id,
      muscle_group: config.muscle_group,
      position: config.position,
      settings: config.settings
    }));

    const { error: insertError } = await this.supabaseService.client
      .from('training_graph_configs')
      .insert(insertPayload);

    if (insertError) {
      throw insertError;
    }
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private readonly handleConnectivityEvent = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void this.flush();
  };

  private readQueue(): QueueItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as QueueItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeQueue(items: QueueItem[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.syncPendingCount();
  }

  private syncPendingCount(): void {
    this.pendingCount.set(this.readQueue().length);
  }
}
