import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GymFacadeService } from './gym-facade.service';
import {
  TrainingDataService,
  TrainingExecutionSession,
} from '../../core/training/training-data.service';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { InteractionTelemetryService } from '../../core/interaction-telemetry.service';
import { vi } from 'vitest';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('GymFacadeService', () => {
  let facade: GymFacadeService;
  let authUser: ReturnType<typeof signal<{ id: string } | null>>;
  let trainingData: {
    hasPendingSync: ReturnType<typeof vi.fn>;
    flushPendingSync: ReturnType<typeof vi.fn>;
    getDashboardWeek: ReturnType<typeof vi.fn>;
    getExercises: ReturnType<typeof vi.fn>;
    getPlans: ReturnType<typeof vi.fn>;
    getPlanOverview: ReturnType<typeof vi.fn>;
    getSessionByClientRef: ReturnType<typeof vi.fn>;
    startSession: ReturnType<typeof vi.fn>;
    getPreviousPerformance: ReturnType<typeof vi.fn>;
    upsertSetLog: ReturnType<typeof vi.fn>;
    completeSession: ReturnType<typeof vi.fn>;
    abortSession: ReturnType<typeof vi.fn>;
    getCompletedWorkoutCountForRange: ReturnType<typeof vi.fn>;
    getProgressWidgets: ReturnType<typeof vi.fn>;
    getPersonalStats: ReturnType<typeof vi.fn>;
    getProgressSeries: ReturnType<typeof vi.fn>;
    getExerciseVolumeSeries: ReturnType<typeof vi.fn>;
    upsertMeasurement: ReturnType<typeof vi.fn>;
    saveProgressWidgets: ReturnType<typeof vi.fn>;
    activatePlan: ReturnType<typeof vi.fn>;
    savePlan: ReturnType<typeof vi.fn>;
  };

  const dashboardWeek = {
    weekStart: '2026-03-09',
    weekEnd: '2026-03-15',
    days: [{ iso: '2026-03-12', label: 'Do. 12', isToday: false }],
    activePlan: {
      id: 'plan-1',
      name: 'Push Pull',
      durationWeeks: 12,
      startDate: '2026-03-01',
      weekNumber: 2,
    },
    workoutDays: [
      {
        dayId: 'day-1',
        dayNumber: 1,
        scheduledDate: '2026-03-12',
        name: 'Push',
        exerciseCount: 2,
        thumbnails: [],
        completed: false,
        currentSessionClientRef: null,
      },
    ],
  };

  const planOverview = {
    planId: 'plan-1',
    planName: 'Push Pull',
    dayId: 'day-1',
    dayName: 'Push',
    weekNumber: 2,
    totalExercises: 2,
    totalSets: 6,
    targetMuscles: ['chest'],
    exercises: [
      {
        dayExerciseId: 'day-ex-1',
        exerciseId: 'exercise-1',
        name: 'Bench Press',
        equipment: 'barbell' as const,
        images: [],
        sets: 3,
        targetReps: 8,
        targetSeconds: null,
        sortOrder: 1,
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
      },
    ],
  };

  const exercises = [
    {
      id: 'exercise-1',
      owner_id: null,
      name: 'Bench Press',
      equipment: 'barbell' as const,
      primary_muscle: 'chest',
      secondary_muscles: ['triceps'],
      images: [],
      type: 'barbell' as const,
      is_system: true,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'exercise-2',
      owner_id: null,
      name: 'Row',
      equipment: 'machine' as const,
      primary_muscle: 'mid_back',
      secondary_muscles: ['biceps'],
      images: [],
      type: 'machine' as const,
      is_system: true,
      created_at: '',
      updated_at: '',
    },
  ];

  const session = (): TrainingExecutionSession => ({
    sessionId: 'session-1',
    sessionClientRef: 'session-client-1',
    sessionDate: '2026-03-12',
    startedAt: '2026-03-12T08:00:00.000Z',
    planDayId: 'day-1',
    status: 'in_progress',
    exercises: [
      {
        sessionExerciseId: 'session-ex-1',
        exerciseId: 'exercise-1',
        sortOrder: 1,
        name: 'Bench Press',
        equipment: 'barbell',
        images: [],
        targetReps: 8,
        targetSeconds: null,
        plannedSets: 3,
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
        sets: [
          {
            id: 'set-1',
            setNumber: 1,
            isWarmup: false,
            weightKg: 20,
            reps: 8,
            durationSeconds: null,
            estimated10Rm: null,
            volume: 160,
            isCompleted: true,
            clientRef: 'set-client-1',
          },
        ],
      },
      {
        sessionExerciseId: 'session-ex-2',
        exerciseId: 'exercise-2',
        sortOrder: 2,
        name: 'Row',
        equipment: 'machine',
        images: [],
        targetReps: 10,
        targetSeconds: null,
        plannedSets: 3,
        primaryMuscle: 'mid_back',
        secondaryMuscles: ['biceps'],
        sets: [
          {
            id: 'set-2',
            setNumber: 1,
            isWarmup: false,
            weightKg: null,
            reps: null,
            durationSeconds: null,
            estimated10Rm: null,
            volume: 0,
            isCompleted: false,
            clientRef: 'set-client-2',
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    authUser = signal<{ id: string } | null>({ id: 'user-1' });

    trainingData = {
      hasPendingSync: vi.fn(),
      flushPendingSync: vi.fn(),
      getDashboardWeek: vi.fn(),
      getExercises: vi.fn(),
      getPlans: vi.fn(),
      getPlanOverview: vi.fn(),
      getSessionByClientRef: vi.fn(),
      startSession: vi.fn(),
      getPreviousPerformance: vi.fn(),
      upsertSetLog: vi.fn(),
      completeSession: vi.fn(),
      abortSession: vi.fn(),
      getCompletedWorkoutCountForRange: vi.fn(),
      getProgressWidgets: vi.fn(),
      getPersonalStats: vi.fn(),
      getProgressSeries: vi.fn(),
      getExerciseVolumeSeries: vi.fn(),
      upsertMeasurement: vi.fn(),
      saveProgressWidgets: vi.fn(),
      activatePlan: vi.fn(),
      savePlan: vi.fn(),
    };

    trainingData.hasPendingSync.mockReturnValue(false);
    trainingData.flushPendingSync.mockResolvedValue(undefined);
    trainingData.getDashboardWeek.mockResolvedValue(dashboardWeek);
    trainingData.getExercises.mockResolvedValue(exercises);
    trainingData.getPlans.mockResolvedValue([]);
    trainingData.getPlanOverview.mockResolvedValue(planOverview);
    trainingData.getSessionByClientRef.mockResolvedValue(null);
    trainingData.startSession.mockResolvedValue(session());
    trainingData.getPreviousPerformance.mockImplementation(async (exerciseId: string) => [
      {
        session_date: '2026-03-05',
        set_number: 1,
        is_warmup: false,
        weight_kg: exerciseId === 'exercise-1' ? 25 : 40,
        reps: exerciseId === 'exercise-1' ? 8 : 10,
        estimated_10rm: null,
      },
    ]);
    trainingData.upsertSetLog.mockResolvedValue('saved');
    trainingData.completeSession.mockResolvedValue(undefined);
    trainingData.abortSession.mockResolvedValue(undefined);
    trainingData.getCompletedWorkoutCountForRange.mockResolvedValue(2);
    trainingData.getProgressWidgets.mockResolvedValue([]);
    trainingData.getPersonalStats.mockResolvedValue({
      totalWorkouts: 12,
      currentStreakWeeks: 3,
      gymName: 'Gym',
      latestBodyweight: 82,
    });
    trainingData.getProgressSeries.mockResolvedValue([
      { point_date: '2026-03-12', point_value: 80 },
    ]);
    trainingData.getExerciseVolumeSeries.mockResolvedValue([
      { point_date: '2026-03-12', point_value: 640 },
    ]);
    trainingData.upsertMeasurement.mockResolvedValue(undefined);
    trainingData.saveProgressWidgets.mockResolvedValue(undefined);
    trainingData.activatePlan.mockResolvedValue(undefined);
    trainingData.savePlan.mockResolvedValue('plan-1');

    TestBed.configureTestingModule({
      providers: [
        GymFacadeService,
        { provide: TrainingDataService, useValue: trainingData as unknown as TrainingDataService },
        { provide: AuthService, useValue: { user: authUser } },
        {
          provide: SupabaseService,
          useValue: { client: { from: () => ({ upsert: async () => ({ error: null }) }) } },
        },
        {
          provide: InteractionTelemetryService,
          useValue: {
            startJourney: () => 'journey-1',
            completeJourney: () => undefined,
            failJourney: () => undefined,
          },
        },
      ],
    });

    facade = TestBed.inject(GymFacadeService);
    facade.selectedDate.set('2026-03-12');
  });

  it('boots tracker with dashboard, exercises, plans and only flushes when pending sync exists', async () => {
    trainingData.hasPendingSync.mockReturnValueOnce(true).mockReturnValueOnce(false);

    await facade.loadTrackerBootstrap();
    await facade.loadTrackerBootstrap();

    expect(trainingData.flushPendingSync).toHaveBeenCalledTimes(1);
    expect(trainingData.getDashboardWeek).toHaveBeenCalledTimes(2);
    expect(trainingData.getExercises).toHaveBeenCalledTimes(2);
    expect(trainingData.getPlans).toHaveBeenCalledTimes(2);
  });

  it('loads only the dashboard on week refresh', async () => {
    await facade.loadTrackerBootstrap();
    trainingData.getDashboardWeek.mockClear();
    trainingData.getExercises.mockClear();
    trainingData.getPlans.mockClear();

    await facade.loadDashboardWeek(true);

    expect(trainingData.getDashboardWeek).toHaveBeenCalledTimes(1);
    expect(trainingData.getExercises).not.toHaveBeenCalled();
    expect(trainingData.getPlans).not.toHaveBeenCalled();
  });

  it('reuses tracker state across activate calls and resets when the user changes', async () => {
    await facade.activate();
    trainingData.getDashboardWeek.mockClear();
    trainingData.getExercises.mockClear();
    trainingData.getPlans.mockClear();

    await facade.activate();

    expect(trainingData.getDashboardWeek).not.toHaveBeenCalled();
    expect(trainingData.getExercises).not.toHaveBeenCalled();
    expect(trainingData.getPlans).not.toHaveBeenCalled();

    authUser.set({ id: 'user-2' });
    facade.resetForUserChange();

    expect(facade.dashboardWeek()).toBeNull();
    expect(facade.activeSession()).toBeNull();
    expect(facade.activeTab()).toBe('tracker');
    expect(facade.progressLoaded()).toBe(false);
  });

  it('waits for an in-flight bootstrap to finish before treating the tracker as ready', async () => {
    const dashboardRequest = deferred<typeof dashboardWeek>();
    const overviewRequest = deferred<typeof planOverview>();

    trainingData.getDashboardWeek.mockImplementationOnce(() => dashboardRequest.promise);
    trainingData.getPlanOverview.mockImplementationOnce(() => overviewRequest.promise);

    const firstActivate = facade.activate();
    dashboardRequest.resolve(dashboardWeek);

    const secondActivate = facade.activate();
    overviewRequest.resolve(planOverview);

    await Promise.all([firstActivate, secondActivate]);

    expect(trainingData.getDashboardWeek).toHaveBeenCalledTimes(1);
    expect(trainingData.getPlanOverview).toHaveBeenCalledTimes(1);
    expect(facade.selectedOverview()).toEqual(planOverview);
  });

  it('reuses previous performance per exercise within the active session', async () => {
    facade.activeSession.set(session());
    facade.activeExerciseIndex.set(0);

    await facade.refreshPreviousPerformance();
    facade.activeExerciseIndex.set(1);
    await facade.refreshPreviousPerformance();
    facade.activeExerciseIndex.set(0);
    await facade.refreshPreviousPerformance();

    expect(trainingData.getPreviousPerformance).toHaveBeenCalledTimes(2);
    expect(facade.previousPerformance()[0]?.weight_kg).toBe(25);
  });

  it('clears the workout preview on a selected rest day', async () => {
    facade.selectedDate.set('2026-03-13');

    await facade.loadTrackerBootstrap();

    expect(facade.selectedWorkoutDay()).toBeNull();
    expect(facade.selectedOverview()).toBeNull();
  });

  it('does not eagerly reload progress after finishing a workout while progress is inactive', async () => {
    facade.activeSession.set(session());

    const completed = await facade.finishWorkout(false);

    expect(completed).toBe(true);
    expect(facade.progressDirty()).toBe(true);
    expect(trainingData.getProgressWidgets).not.toHaveBeenCalled();
    expect(trainingData.getPersonalStats).not.toHaveBeenCalled();
  });

  it('returns an active workout to the tracker without discarding it', async () => {
    facade.activeSession.set(session());

    await facade.leaveWorkoutForLater();

    expect(facade.activeSession()).toBeNull();
    expect(trainingData.getDashboardWeek).toHaveBeenCalled();
  });

  it('hydrates progress once and reuses it until marked dirty', async () => {
    await facade.activateProgressTab();
    await facade.activateProgressTab();

    expect(trainingData.getProgressWidgets).toHaveBeenCalledTimes(1);
    expect(trainingData.getPersonalStats).toHaveBeenCalledTimes(1);
    expect(trainingData.getProgressSeries).toHaveBeenCalledTimes(1);
    expect(trainingData.getExerciseVolumeSeries).toHaveBeenCalledTimes(1);
  });

  it('reloads dirty progress on the next activation', async () => {
    await facade.activateProgressTab();
    await facade.saveMeasurement(false);
    await facade.activateProgressTab();

    expect(trainingData.upsertMeasurement).toHaveBeenCalled();
    expect(trainingData.getProgressWidgets).toHaveBeenCalledTimes(2);
    expect(trainingData.getPersonalStats).toHaveBeenCalledTimes(2);
  });

  it('ignores stale progress requests when the selected exercise changes quickly', async () => {
    facade.exercises.set(exercises);

    const exerciseOneTenRm = deferred<Array<{ point_date: string; point_value: number }>>();
    const exerciseOneVolume = deferred<Array<{ point_date: string; point_value: number }>>();
    const exerciseTwoTenRm = deferred<Array<{ point_date: string; point_value: number }>>();
    const exerciseTwoVolume = deferred<Array<{ point_date: string; point_value: number }>>();

    trainingData.getProgressSeries.mockImplementation(
      async (query: { exerciseId?: string | null }) => {
        if (query.exerciseId === 'exercise-1') {
          return exerciseOneTenRm.promise;
        }
        return exerciseTwoTenRm.promise;
      },
    );
    trainingData.getExerciseVolumeSeries.mockImplementation(async (exerciseId: string) => {
      if (exerciseId === 'exercise-1') {
        return exerciseOneVolume.promise;
      }
      return exerciseTwoVolume.promise;
    });

    facade.onProgressExerciseChange('exercise-1');
    facade.onProgressExerciseChange('exercise-2');

    exerciseTwoTenRm.resolve([{ point_date: '2026-03-13', point_value: 90 }]);
    exerciseTwoVolume.resolve([{ point_date: '2026-03-13', point_value: 900 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    exerciseOneTenRm.resolve([{ point_date: '2026-03-12', point_value: 70 }]);
    exerciseOneVolume.resolve([{ point_date: '2026-03-12', point_value: 700 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(facade.tenRmSeries()).toEqual([{ point_date: '2026-03-13', point_value: 90 }]);
    expect(facade.exerciseVolumeSeries()).toEqual([{ point_date: '2026-03-13', point_value: 900 }]);
  });
});
