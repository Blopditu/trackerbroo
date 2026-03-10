import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { QueryCacheService } from '../query-cache.service';
import { SupabaseService } from '../supabase.service';
import {
  TrainingExercise,
  TrainingGraphConfig,
  TrainingGraphType,
  TrainingMeasurementType,
  TrainingPlan
} from '../types';
import {
  QueueSaveGraphConfigsPayload,
  TrainingSyncQueueService
} from './training-sync-queue.service';
import { addDays, newClientRef, startOfIsoWeek, toIsoDate } from './training-utils';

interface DashboardSnapshotRow {
  plan_id: string;
  plan_name: string;
  duration_weeks: number;
  start_date: string | null;
  week_number: number | null;
  day_id: string;
  day_number: number;
  day_name: string;
  exercise_count: number;
  exercise_thumbnails: string[];
  completed: boolean;
  current_session_client_ref: string | null;
}

interface PlanDayExerciseJoinedRow {
  id: string;
  sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  sort_order: number;
  exercise: TrainingExercise;
}

interface SessionRow {
  id: string;
  plan_day_id: string;
  session_date: string;
  status: string;
  client_ref: string;
}

interface SessionExerciseRow {
  id: string;
  exercise_id: string;
  exercise_name: string;
  equipment: string;
  primary_muscle: string;
  secondary_muscles: string[];
  images: string[];
  type: string;
  planned_sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  sort_order: number;
}

interface SetLogRow {
  id: string;
  session_exercise_id: string;
  set_number: number;
  is_warmup: boolean;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  volume: number;
  estimated_10rm: number | null;
  is_completed: boolean;
  client_ref: string | null;
}

export interface TrainingWeekDay {
  iso: string;
  label: string;
  isToday: boolean;
}

export interface TrainingDashboardDay {
  dayId: string;
  dayNumber: number;
  name: string;
  exerciseCount: number;
  thumbnails: string[];
  completed: boolean;
  currentSessionClientRef: string | null;
}

export interface TrainingDashboardWeek {
  weekStart: string;
  weekEnd: string;
  days: TrainingWeekDay[];
  activePlan: {
    id: string;
    name: string;
    durationWeeks: number;
    startDate: string | null;
    weekNumber: number;
  } | null;
  workoutDays: TrainingDashboardDay[];
}

export interface TrainingPlanOverviewExercise {
  dayExerciseId: string;
  exerciseId: string;
  name: string;
  equipment: string;
  images: string[];
  sets: number;
  targetReps: number | null;
  targetSeconds: number | null;
  sortOrder: number;
  primaryMuscle: string;
  secondaryMuscles: string[];
}

export interface TrainingPlanOverview {
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  weekNumber: number;
  totalExercises: number;
  totalSets: number;
  targetMuscles: string[];
  exercises: TrainingPlanOverviewExercise[];
}

export interface TrainingExecutionSet {
  id: string;
  setNumber: number;
  isWarmup: boolean;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  estimated10Rm: number | null;
  volume: number;
  isCompleted: boolean;
  clientRef: string;
}

export interface TrainingExecutionExercise {
  sessionExerciseId: string;
  exerciseId: string;
  sortOrder: number;
  name: string;
  equipment: string;
  images: string[];
  targetReps: number | null;
  targetSeconds: number | null;
  plannedSets: number;
  primaryMuscle: string;
  secondaryMuscles: string[];
  sets: TrainingExecutionSet[];
}

export interface TrainingExecutionSession {
  sessionId: string | null;
  sessionClientRef: string;
  sessionDate: string;
  planDayId: string;
  status: 'in_progress' | 'completed' | 'aborted';
  exercises: TrainingExecutionExercise[];
}

export interface TrainingGraphDataPoint {
  point_date: string;
  point_value: number;
}

export interface ProgressSeriesQuery {
  graphType: TrainingGraphType;
  from?: string;
  to?: string;
  exerciseId?: string | null;
  muscleGroup?: string | null;
}

export interface TrainingPersonalStats {
  totalWorkouts: number;
  currentStreakWeeks: number;
  gymName: string | null;
  latestBodyweight: number | null;
}

export interface SavePlanInput {
  id?: string;
  name: string;
  daysPerWeek: number;
  durationWeeks: number;
  startDate: string | null;
  isActive: boolean;
  days: Array<{
    name: string;
    targetMuscles: string[];
    exercises: Array<{
      exerciseId: string;
      sets: number;
      targetReps: number | null;
      targetSeconds: number | null;
    }>;
  }>;
}

export interface UpsertSetLogInput {
  sessionClientRef: string;
  exerciseSortOrder: number;
  setNumber: number;
  isWarmup: boolean;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  isCompleted: boolean;
  clientRef?: string;
}

export interface UpsertMeasurementInput {
  type: TrainingMeasurementType;
  value: number;
  measuredOn: string;
}

@Injectable({
  providedIn: 'root'
})
export class TrainingDataService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly queryCache = inject(QueryCacheService);
  private readonly syncQueue = inject(TrainingSyncQueueService);

  private readonly dashboardTtlMs = 1000 * 60 * 5;
  private readonly planOverviewTtlMs = 1000 * 60 * 10;
  private readonly exerciseTtlMs = 1000 * 60 * 30;
  private readonly progressTtlMs = 1000 * 60 * 10;

  async getDashboardWeek(date: string, forceRefresh = false): Promise<TrainingDashboardWeek> {
    const user = this.requireUser();
    const weekStartDate = startOfIsoWeek(new Date(`${date}T00:00:00`));
    const weekStart = toIsoDate(weekStartDate);
    const cacheKey = `training:dashboard:${user.id}:${weekStart}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.dashboardTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: () => this.fetchDashboardWeek(weekStart)
    });

    return value;
  }

  async getPlanOverview(planDayId: string, forceRefresh = false): Promise<TrainingPlanOverview> {
    const user = this.requireUser();
    const cacheKey = `training:plan-overview:${user.id}:${planDayId}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.planOverviewTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: () => this.fetchPlanOverview(planDayId)
    });

    return value;
  }

  async startSession(planDayId: string, date: string): Promise<TrainingExecutionSession> {
    const clientRef = newClientRef('session');

    if (this.isOnline()) {
      const { error } = await this.supabaseService.client.rpc('training_start_session', {
        p_plan_day_id: planDayId,
        p_session_date: date,
        p_client_ref: clientRef
      });

      if (!error) {
        const online = await this.getSessionByClientRef(clientRef);
        if (online) {
          this.invalidateTrainingCaches(this.requireUser().id);
          return online;
        }
      }
    }

    this.syncQueue.enqueue('start_session', {
      planDayId,
      sessionDate: date,
      clientRef
    });

    const overview = await this.getPlanOverview(planDayId, true);
    return {
      sessionId: null,
      sessionClientRef: clientRef,
      sessionDate: date,
      planDayId,
      status: 'in_progress',
      exercises: overview.exercises.map(exercise => ({
        sessionExerciseId: `local:${clientRef}:${exercise.sortOrder}`,
        exerciseId: exercise.exerciseId,
        sortOrder: exercise.sortOrder,
        name: exercise.name,
        equipment: exercise.equipment,
        images: exercise.images,
        targetReps: exercise.targetReps,
        targetSeconds: exercise.targetSeconds,
        plannedSets: exercise.sets,
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: exercise.secondaryMuscles,
        sets: Array.from({ length: exercise.sets }, (_, index) => ({
          id: `local:${clientRef}:${exercise.sortOrder}:${index + 1}`,
          setNumber: index + 1,
          isWarmup: false,
          weightKg: null,
          reps: null,
          durationSeconds: null,
          estimated10Rm: null,
          volume: 0,
          isCompleted: false,
          clientRef: newClientRef('set')
        }))
      }))
    };
  }

  async getSessionByClientRef(clientRef: string): Promise<TrainingExecutionSession | null> {
    const user = this.authService.user();
    if (!user || !this.isOnline()) {
      return null;
    }

    const { data: sessionData, error: sessionError } = await this.supabaseService.client
      .from('training_sessions')
      .select('id,plan_day_id,session_date,status,client_ref')
      .eq('user_id', user.id)
      .eq('client_ref', clientRef)
      .maybeSingle();

    if (sessionError || !sessionData) {
      return null;
    }

    const session = sessionData as SessionRow;

    const { data: exercisesData, error: exerciseError } = await this.supabaseService.client
      .from('training_session_exercises')
      .select('id,exercise_id,exercise_name,equipment,primary_muscle,secondary_muscles,images,type,planned_sets,target_reps,target_seconds,sort_order')
      .eq('session_id', session.id)
      .order('sort_order', { ascending: true });

    if (exerciseError) {
      throw exerciseError;
    }

    const exerciseRows = (exercisesData || []) as SessionExerciseRow[];
    const sessionExerciseIds = exerciseRows.map(row => row.id);

    const logRows = sessionExerciseIds.length > 0
      ? await this.fetchSetLogs(sessionExerciseIds)
      : [];

    const logsByExercise = new Map<string, SetLogRow[]>();
    for (const log of logRows) {
      const list = logsByExercise.get(log.session_exercise_id) || [];
      list.push(log);
      logsByExercise.set(log.session_exercise_id, list);
    }

    return {
      sessionId: session.id,
      sessionClientRef: session.client_ref,
      sessionDate: session.session_date,
      planDayId: session.plan_day_id,
      status: session.status as 'in_progress' | 'completed' | 'aborted',
      exercises: exerciseRows.map(exercise => {
        const existingLogs = (logsByExercise.get(exercise.id) || []).sort((a, b) => a.set_number - b.set_number);
        const bySet = new Map(existingLogs.map(log => [`${log.is_warmup}-${log.set_number}`, log]));

        const sets: TrainingExecutionSet[] = [];
        for (let setNumber = 1; setNumber <= exercise.planned_sets; setNumber += 1) {
          const key = `false-${setNumber}`;
          const row = bySet.get(key);
          sets.push({
            id: row?.id || `virtual:${exercise.id}:${setNumber}`,
            setNumber,
            isWarmup: false,
            weightKg: row?.weight_kg || null,
            reps: row?.reps || null,
            durationSeconds: row?.duration_seconds || null,
            estimated10Rm: row?.estimated_10rm || null,
            volume: Number(row?.volume || 0),
            isCompleted: Boolean(row?.is_completed),
            clientRef: row?.client_ref || newClientRef('set')
          });
        }

        return {
          sessionExerciseId: exercise.id,
          exerciseId: exercise.exercise_id,
          sortOrder: exercise.sort_order,
          name: exercise.exercise_name,
          equipment: exercise.equipment,
          images: exercise.images || [],
          targetReps: exercise.target_reps,
          targetSeconds: exercise.target_seconds,
          plannedSets: exercise.planned_sets,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles || [],
          sets
        };
      })
    };
  }

  async upsertSetLog(input: UpsertSetLogInput): Promise<void> {
    const payload = {
      sessionClientRef: input.sessionClientRef,
      exerciseSortOrder: input.exerciseSortOrder,
      setNumber: input.setNumber,
      isWarmup: input.isWarmup,
      weightKg: input.weightKg,
      reps: input.reps,
      durationSeconds: input.durationSeconds,
      isCompleted: input.isCompleted,
      clientRef: input.clientRef || newClientRef('set')
    };

    if (!this.isOnline()) {
      this.syncQueue.enqueue('upsert_set', payload);
      return;
    }

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
      this.syncQueue.enqueue('upsert_set', payload);
    }
  }

  async completeSession(sessionClientRef: string): Promise<void> {
    if (!this.isOnline()) {
      this.syncQueue.enqueue('complete_session', { sessionClientRef });
      return;
    }

    const { error } = await this.supabaseService.client.rpc('training_complete_session_by_client', {
      p_session_client_ref: sessionClientRef
    });

    if (error) {
      this.syncQueue.enqueue('complete_session', { sessionClientRef });
    }

    this.invalidateTrainingCaches(this.requireUser().id);
  }

  async getPreviousPerformance(exerciseId: string, beforeDate: string): Promise<Array<{
    session_date: string;
    set_number: number;
    is_warmup: boolean;
    weight_kg: number | null;
    reps: number | null;
    estimated_10rm: number | null;
  }>> {
    const { data, error } = await this.supabaseService.client.rpc('training_previous_exercise_performance', {
      p_exercise_id: exerciseId,
      p_before: beforeDate
    });

    if (error) {
      throw error;
    }

    return (data || []) as Array<{
      session_date: string;
      set_number: number;
      is_warmup: boolean;
      weight_kg: number | null;
      reps: number | null;
      estimated_10rm: number | null;
    }>;
  }

  async getPlans(forceRefresh = false): Promise<TrainingPlan[]> {
    const user = this.requireUser();
    const cacheKey = `training:plans:${user.id}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.planOverviewTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: async () => {
        const { data, error } = await this.supabaseService.client
          .from('training_plans')
          .select('id,user_id,name,days_per_week,duration_weeks,start_date,is_active,created_at,updated_at')
          .eq('user_id', user.id)
          .order('is_active', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return (data || []) as TrainingPlan[];
      }
    });

    return value;
  }

  async activatePlan(planId: string): Promise<void> {
    const user = this.requireUser();

    const { error: resetError } = await this.supabaseService.client
      .from('training_plans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (resetError) {
      throw resetError;
    }

    const { error } = await this.supabaseService.client
      .from('training_plans')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', planId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    this.invalidateTrainingCaches(user.id);
  }

  async savePlan(input: SavePlanInput): Promise<string> {
    const user = this.requireUser();

    if (input.isActive) {
      const { error: resetError } = await this.supabaseService.client
        .from('training_plans')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (resetError) {
        throw resetError;
      }
    }

    const basePlanPayload = {
      user_id: user.id,
      name: input.name,
      days_per_week: input.daysPerWeek,
      duration_weeks: input.durationWeeks,
      start_date: input.startDate,
      is_active: input.isActive,
      updated_at: new Date().toISOString()
    };

    const { data: planData, error: planError } = input.id
      ? await this.supabaseService.client
          .from('training_plans')
          .update(basePlanPayload)
          .eq('id', input.id)
          .eq('user_id', user.id)
          .select('id')
          .single()
      : await this.supabaseService.client
          .from('training_plans')
          .insert(basePlanPayload)
          .select('id')
          .single();

    if (planError || !planData) {
      throw planError || new Error('Plan could not be saved');
    }

    const planId = String(planData.id);

    if (input.id) {
      const { data: existingDays, error: existingDaysError } = await this.supabaseService.client
        .from('training_plan_days')
        .select('id')
        .eq('plan_id', planId);

      if (existingDaysError) {
        throw existingDaysError;
      }

      const dayIds = (existingDays || []).map(day => String(day.id));
      if (dayIds.length > 0) {
        const { error: deleteExercisesError } = await this.supabaseService.client
          .from('training_day_exercises')
          .delete()
          .in('day_id', dayIds);

        if (deleteExercisesError) {
          throw deleteExercisesError;
        }

        const { error: deleteDaysError } = await this.supabaseService.client
          .from('training_plan_days')
          .delete()
          .eq('plan_id', planId);

        if (deleteDaysError) {
          throw deleteDaysError;
        }
      }
    }

    if (input.days.length > 0) {
      const daysPayload = input.days.map((day, index) => ({
        plan_id: planId,
        day_number: index + 1,
        name: day.name,
        target_muscles: day.targetMuscles,
        sort_order: index + 1
      }));

      const { data: dayRows, error: dayError } = await this.supabaseService.client
        .from('training_plan_days')
        .insert(daysPayload)
        .select('id,day_number');

      if (dayError || !dayRows) {
        throw dayError || new Error('Plan days could not be saved');
      }

      const dayIdByNumber = new Map<number, string>();
      for (const row of dayRows as Array<{ id: string; day_number: number }>) {
        dayIdByNumber.set(Number(row.day_number), String(row.id));
      }

      const exercisesPayload: Array<{
        day_id: string;
        exercise_id: string;
        sets: number;
        target_reps: number | null;
        target_seconds: number | null;
        sort_order: number;
      }> = [];

      for (let dayIndex = 0; dayIndex < input.days.length; dayIndex += 1) {
        const day = input.days[dayIndex];
        const dayId = dayIdByNumber.get(dayIndex + 1);
        if (!dayId) {
          continue;
        }

        day.exercises.forEach((exercise, exerciseIndex) => {
          exercisesPayload.push({
            day_id: dayId,
            exercise_id: exercise.exerciseId,
            sets: exercise.sets,
            target_reps: exercise.targetReps,
            target_seconds: exercise.targetSeconds,
            sort_order: exerciseIndex + 1
          });
        });
      }

      if (exercisesPayload.length > 0) {
        const { error: dayExercisesError } = await this.supabaseService.client
          .from('training_day_exercises')
          .insert(exercisesPayload);

        if (dayExercisesError) {
          throw dayExercisesError;
        }
      }
    }

    this.invalidateTrainingCaches(user.id);
    return planId;
  }

  async getExercises(forceRefresh = false): Promise<TrainingExercise[]> {
    const user = this.requireUser();
    const cacheKey = `training:exercises:${user.id}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.exerciseTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: async () => {
        const { data, error } = await this.supabaseService.client
          .from('training_exercises')
          .select('id,owner_id,name,equipment,primary_muscle,secondary_muscles,images,type,is_system,created_at,updated_at')
          .or(`is_system.eq.true,owner_id.eq.${user.id}`)
          .order('is_system', { ascending: false })
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        return (data || []) as TrainingExercise[];
      }
    });

    return value;
  }

  async createCustomExercise(input: {
    name: string;
    equipment: TrainingExercise['equipment'];
    type: TrainingExercise['type'];
    primaryMuscle: string;
    secondaryMuscles: string[];
    images: string[];
  }): Promise<void> {
    const user = this.requireUser();

    const { error } = await this.supabaseService.client
      .from('training_exercises')
      .insert({
        owner_id: user.id,
        name: input.name,
        equipment: input.equipment,
        type: input.type,
        primary_muscle: input.primaryMuscle,
        secondary_muscles: input.secondaryMuscles,
        images: input.images,
        is_system: false
      });

    if (error) {
      throw error;
    }

    this.queryCache.invalidate(`training:exercises:${user.id}`);
  }

  async getProgressWidgets(forceRefresh = false): Promise<TrainingGraphConfig[]> {
    const user = this.requireUser();
    const cacheKey = `training:widgets:${user.id}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.progressTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: async () => {
        const { data, error } = await this.supabaseService.client
          .from('training_graph_configs')
          .select('id,user_id,graph_type,exercise_id,muscle_group,position,settings,created_at,updated_at')
          .eq('user_id', user.id)
          .order('position', { ascending: true });

        if (error) {
          throw error;
        }

        const rows = (data || []) as TrainingGraphConfig[];
        if (rows.length > 0) {
          return rows;
        }

        return [
          {
            id: 'local-workout-count',
            user_id: user.id,
            graph_type: 'workout_count' as TrainingGraphType,
            exercise_id: null,
            muscle_group: null,
            position: 1,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'local-total-volume',
            user_id: user.id,
            graph_type: 'total_volume' as TrainingGraphType,
            exercise_id: null,
            muscle_group: null,
            position: 2,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'local-bodyweight',
            user_id: user.id,
            graph_type: 'bodyweight' as TrainingGraphType,
            exercise_id: null,
            muscle_group: null,
            position: 3,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
      }
    });

    return value;
  }

  async saveProgressWidgets(configs: QueueSaveGraphConfigsPayload['configs']): Promise<void> {
    const user = this.requireUser();

    if (!this.isOnline()) {
      this.syncQueue.enqueue('save_graph_configs', { configs });
      return;
    }

    const { error: deleteError } = await this.supabaseService.client
      .from('training_graph_configs')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      this.syncQueue.enqueue('save_graph_configs', { configs });
      return;
    }

    if (configs.length > 0) {
      const { error: insertError } = await this.supabaseService.client
        .from('training_graph_configs')
        .insert(
          configs.map(config => ({
            user_id: user.id,
            graph_type: config.graph_type,
            exercise_id: config.exercise_id,
            muscle_group: config.muscle_group,
            position: config.position,
            settings: config.settings
          }))
        );

      if (insertError) {
        this.syncQueue.enqueue('save_graph_configs', { configs });
      }
    }

    this.queryCache.invalidate(`training:widgets:${user.id}`);
  }

  async getProgressSeries(query: ProgressSeriesQuery): Promise<TrainingGraphDataPoint[]> {
    const user = this.requireUser();
    const cacheKey = `training:progress:${user.id}:${query.graphType}:${query.from || ''}:${query.to || ''}:${query.exerciseId || ''}:${query.muscleGroup || ''}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.progressTtlMs,
      allowStaleOnError: true,
      loader: async () => {
        const { data, error } = await this.supabaseService.client.rpc('training_progress_series', {
          p_graph_type: query.graphType,
          p_from: query.from || null,
          p_to: query.to || null,
          p_exercise_id: query.exerciseId || null,
          p_muscle_group: query.muscleGroup || null
        });

        if (error) {
          throw error;
        }

        return ((data || []) as TrainingGraphDataPoint[]).map(point => ({
          point_date: String(point.point_date),
          point_value: Number(point.point_value)
        }));
      }
    });

    return value;
  }

  async getExerciseVolumeSeries(
    exerciseId: string,
    from?: string,
    to?: string,
    forceRefresh = false
  ): Promise<TrainingGraphDataPoint[]> {
    const user = this.requireUser();
    const cacheKey = `training:progress:${user.id}:exercise_volume:${exerciseId}:${from || ''}:${to || ''}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.progressTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: async () => {
        const { data, error } = await this.supabaseService.client.rpc('training_exercise_volume_series', {
          p_exercise_id: exerciseId,
          p_from: from || null,
          p_to: to || null
        });

        if (error) {
          throw error;
        }

        return ((data || []) as TrainingGraphDataPoint[]).map(point => ({
          point_date: String(point.point_date),
          point_value: Number(point.point_value)
        }));
      }
    });

    return value;
  }

  async getCompletedWorkoutCountForRange(from: string, to: string): Promise<number> {
    const user = this.requireUser();

    const { count, error } = await this.supabaseService.client
      .from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('session_date', from)
      .lte('session_date', to);

    if (error) {
      throw error;
    }

    return Number(count || 0);
  }

  async upsertMeasurement(input: UpsertMeasurementInput): Promise<void> {
    const user = this.requireUser();

    if (!this.isOnline()) {
      this.syncQueue.enqueue('upsert_measurement', {
        type: input.type,
        value: input.value,
        measuredOn: input.measuredOn
      });
      return;
    }

    const { error } = await this.supabaseService.client.from('training_measurements').upsert(
      {
        user_id: user.id,
        type: input.type,
        value: input.value,
        measured_on: input.measuredOn
      },
      { onConflict: 'user_id,type,measured_on' }
    );

    if (error) {
      this.syncQueue.enqueue('upsert_measurement', {
        type: input.type,
        value: input.value,
        measuredOn: input.measuredOn
      });
      return;
    }

    if (input.type === 'weight') {
      const { error: weightError } = await this.supabaseService.client.from('weight_logs').upsert(
        {
          user_id: user.id,
          logged_on: input.measuredOn,
          weight_kg: input.value,
          note: null
        },
        { onConflict: 'user_id,logged_on' }
      );

      if (weightError) {
        this.syncQueue.enqueue('upsert_measurement', {
          type: input.type,
          value: input.value,
          measuredOn: input.measuredOn
        });
      }
    }

    this.queryCache.invalidatePrefix(`training:progress:${user.id}:`);
  }

  async getPersonalStats(forceRefresh = false): Promise<TrainingPersonalStats> {
    const user = this.requireUser();
    const cacheKey = `training:personal-stats:${user.id}`;

    const { value } = await this.queryCache.getOrLoad({
      key: cacheKey,
      ttlMs: this.progressTtlMs,
      forceRefresh,
      allowStaleOnError: true,
      loader: async () => {
        const [{ data: sessionsData, error: sessionsError }, { data: profileData }, { data: weightData }] = await Promise.all([
          this.supabaseService.client
            .from('training_sessions')
            .select('session_date')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('session_date', { ascending: false })
            .limit(500),
          this.supabaseService.client
            .from('profiles')
            .select('gym_name')
            .eq('user_id', user.id)
            .maybeSingle(),
          this.supabaseService.client
            .from('weight_logs')
            .select('weight_kg')
            .eq('user_id', user.id)
            .order('logged_on', { ascending: false })
            .limit(1)
            .maybeSingle()
        ]);

        if (sessionsError) {
          throw sessionsError;
        }

        const dates = (sessionsData || []).map(item => String(item.session_date));
        const weekSet = new Set(dates.map(date => toIsoDate(startOfIsoWeek(new Date(`${date}T00:00:00`)))));

        let streak = 0;
        let cursor = startOfIsoWeek(new Date());
        for (let i = 0; i < 260; i += 1) {
          const iso = toIsoDate(cursor);
          if (!weekSet.has(iso)) {
            break;
          }
          streak += 1;
          cursor = addDays(cursor, -7);
        }

        return {
          totalWorkouts: dates.length,
          currentStreakWeeks: streak,
          gymName: (profileData as { gym_name?: string | null } | null)?.gym_name || null,
          latestBodyweight: weightData ? Number((weightData as { weight_kg: number }).weight_kg) : null
        };
      }
    });

    return value;
  }

  async flushPendingSync(): Promise<void> {
    await this.syncQueue.flush();
  }

  private async fetchDashboardWeek(weekStart: string): Promise<TrainingDashboardWeek> {
    const weekStartDate = new Date(`${weekStart}T00:00:00`);
    const weekEnd = toIsoDate(addDays(weekStartDate, 6));

    const { data, error } = await this.supabaseService.client.rpc('training_dashboard_week_snapshot', {
      p_week_start: weekStart
    });

    if (error) {
      throw error;
    }

    const rows = (data || []) as DashboardSnapshotRow[];

    const weekdays: TrainingWeekDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStartDate, i);
      const iso = toIsoDate(day);
      weekdays.push({
        iso,
        label: day.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
        isToday: iso === toIsoDate(new Date())
      });
    }

    if (rows.length === 0) {
      return {
        weekStart,
        weekEnd,
        days: weekdays,
        activePlan: null,
        workoutDays: []
      };
    }

    const first = rows[0];

    return {
      weekStart,
      weekEnd,
      days: weekdays,
      activePlan: {
        id: first.plan_id,
        name: first.plan_name,
        durationWeeks: Number(first.duration_weeks),
        startDate: first.start_date,
        weekNumber: Number(first.week_number || 1)
      },
      workoutDays: rows.map(row => ({
        dayId: row.day_id,
        dayNumber: Number(row.day_number),
        name: row.day_name,
        exerciseCount: Number(row.exercise_count || 0),
        thumbnails: row.exercise_thumbnails || [],
        completed: Boolean(row.completed),
        currentSessionClientRef: row.current_session_client_ref
      }))
    };
  }

  private async fetchPlanOverview(planDayId: string): Promise<TrainingPlanOverview> {
    const { data: dayData, error: dayError } = await this.supabaseService.client
      .from('training_plan_days')
      .select('id,plan_id,day_number,name,target_muscles,sort_order')
      .eq('id', planDayId)
      .single();

    if (dayError || !dayData) {
      throw dayError || new Error('Workout day not found');
    }

    const day = dayData as {
      id: string;
      plan_id: string;
      day_number: number;
      name: string;
      target_muscles: string[];
    };

    const { data: planData, error: planError } = await this.supabaseService.client
      .from('training_plans')
      .select('id,name,duration_weeks,start_date')
      .eq('id', day.plan_id)
      .single();

    if (planError || !planData) {
      throw planError || new Error('Plan not found');
    }

    const plan = planData as { id: string; name: string; duration_weeks: number; start_date: string | null };

    const { data: exerciseData, error: exerciseError } = await this.supabaseService.client
      .from('training_day_exercises')
      .select('id,sets,target_reps,target_seconds,sort_order,exercise:training_exercises(id,owner_id,name,equipment,primary_muscle,secondary_muscles,images,type,is_system,created_at,updated_at)')
      .eq('day_id', planDayId)
      .order('sort_order', { ascending: true });

    if (exerciseError) {
      throw exerciseError;
    }

    const exerciseRows = (exerciseData || []) as unknown as PlanDayExerciseJoinedRow[];

    const exercises: TrainingPlanOverviewExercise[] = exerciseRows.map(row => ({
      dayExerciseId: row.id,
      exerciseId: row.exercise.id,
      name: row.exercise.name,
      equipment: row.exercise.equipment,
      images: row.exercise.images || [],
      sets: row.sets,
      targetReps: row.target_reps,
      targetSeconds: row.target_seconds,
      sortOrder: row.sort_order,
      primaryMuscle: row.exercise.primary_muscle,
      secondaryMuscles: row.exercise.secondary_muscles || []
    }));

    const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const weekNumber = plan.start_date
      ? Math.max(1, Math.floor((new Date().getTime() - new Date(`${plan.start_date}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1)
      : 1;

    return {
      planId: plan.id,
      planName: plan.name,
      dayId: day.id,
      dayName: day.name,
      weekNumber,
      totalExercises: exercises.length,
      totalSets,
      targetMuscles: (day.target_muscles || []) as string[],
      exercises
    };
  }

  private async fetchSetLogs(sessionExerciseIds: string[]): Promise<SetLogRow[]> {
    const { data, error } = await this.supabaseService.client
      .from('training_set_logs')
      .select('id,session_exercise_id,set_number,is_warmup,weight_kg,reps,duration_seconds,volume,estimated_10rm,is_completed,client_ref')
      .in('session_exercise_id', sessionExerciseIds)
      .order('set_number', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as SetLogRow[];
  }

  private requireUser(): { id: string } {
    const user = this.authService.user();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  }

  private invalidateTrainingCaches(userId: string): void {
    this.queryCache.invalidatePrefix(`training:dashboard:${userId}:`);
    this.queryCache.invalidatePrefix(`training:plans:${userId}`);
    this.queryCache.invalidatePrefix(`training:plan-overview:${userId}:`);
    this.queryCache.invalidatePrefix(`training:progress:${userId}:`);
    this.queryCache.invalidatePrefix(`training:personal-stats:${userId}`);
    this.queryCache.invalidatePrefix(`training:widgets:${userId}`);
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}
