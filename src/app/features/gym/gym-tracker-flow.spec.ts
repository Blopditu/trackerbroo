import { vi } from 'vitest';
import {
  loadDashboardWeekData,
  loadTrackerBootstrapData,
  loadWorkoutPreviewData
} from './gym-tracker-flow';

describe('gym-tracker-flow', () => {
  it('flushes pending sync before tracker bootstrap and returns all tracker data', async () => {
    const trainingData = {
      hasPendingSync: vi.fn().mockReturnValue(true),
      flushPendingSync: vi.fn().mockResolvedValue(undefined),
      getDashboardWeek: vi.fn().mockResolvedValue({ weekStart: '2026-03-16' }),
      getExercises: vi.fn().mockResolvedValue([{ id: 'exercise-1' }]),
      getPlans: vi.fn().mockResolvedValue([{ id: 'plan-1' }])
    };

    const result = await loadTrackerBootstrapData(trainingData as never, '2026-03-19', true);

    expect(trainingData.flushPendingSync).toHaveBeenCalledTimes(1);
    expect(result.dashboard).toEqual({ weekStart: '2026-03-16' });
    expect(result.exercises).toEqual([{ id: 'exercise-1' }]);
    expect(result.plans).toEqual([{ id: 'plan-1' }]);
  });

  it('loads workout preview state with overview reuse and session clearing rules', async () => {
    const trainingData = {
      hasPendingSync: vi.fn().mockReturnValue(false),
      flushPendingSync: vi.fn(),
      getPlanOverview: vi.fn().mockResolvedValue({ dayId: 'day-2' }),
      getSessionByClientRef: vi.fn()
    };

    const withoutSession = await loadWorkoutPreviewData(trainingData as never, {
      workout: {
        dayId: 'day-2',
        currentSessionClientRef: null
      } as never,
      currentOverviewDayId: 'day-1',
      currentSessionClientRef: 'session-1',
      forceSessionRefresh: false
    });

    expect(withoutSession.overview).toEqual({ dayId: 'day-2' });
    expect(withoutSession.clearActiveSession).toBe(true);

    trainingData.getSessionByClientRef.mockResolvedValue({
      sessionClientRef: 'session-2',
      status: 'in_progress'
    });

    const withSession = await loadWorkoutPreviewData(trainingData as never, {
      workout: {
        dayId: 'day-2',
        currentSessionClientRef: 'session-2'
      } as never,
      currentOverviewDayId: 'day-2',
      currentSessionClientRef: null,
      forceSessionRefresh: false
    });

    expect(withSession.overview).toBeUndefined();
    expect(withSession.activeSession).toEqual({
      sessionClientRef: 'session-2',
      status: 'in_progress'
    });
  });

  it('loads dashboard week without touching plans or exercises', async () => {
    const trainingData = {
      getDashboardWeek: vi.fn().mockResolvedValue({ weekStart: '2026-03-16' })
    };

    const dashboard = await loadDashboardWeekData(trainingData as never, '2026-03-19', false);

    expect(dashboard).toEqual({ weekStart: '2026-03-16' });
  });
});
