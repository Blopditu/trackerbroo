import {
  TrainingDashboardDay,
  TrainingDashboardWeek,
  TrainingDataService,
  TrainingExecutionSession,
  TrainingPlanOverview,
} from '../../core/training/training-data.service';
import { TrainingExercise, TrainingPlan } from '../../core/types';

export interface TrackerBootstrapData {
  dashboard: TrainingDashboardWeek;
  exercises: TrainingExercise[];
  plans: TrainingPlan[];
}

export interface WorkoutPreviewData {
  overview?: TrainingPlanOverview;
  activeSession?: TrainingExecutionSession;
  clearActiveSession: boolean;
}

export async function loadTrackerBootstrapData(
  trainingData: Pick<
    TrainingDataService,
    'hasPendingSync' | 'flushPendingSync' | 'getDashboardWeek' | 'getExercises' | 'getPlans'
  >,
  selectedDate: string,
  forceRefresh: boolean,
): Promise<TrackerBootstrapData> {
  if (trainingData.hasPendingSync()) {
    await trainingData.flushPendingSync();
  }

  const [dashboard, exercises, plans] = await Promise.all([
    trainingData.getDashboardWeek(selectedDate, forceRefresh),
    trainingData.getExercises(forceRefresh),
    trainingData.getPlans(forceRefresh),
  ]);

  return { dashboard, exercises, plans };
}

export async function loadDashboardWeekData(
  trainingData: Pick<TrainingDataService, 'getDashboardWeek'>,
  selectedDate: string,
  forceRefresh: boolean,
): Promise<TrainingDashboardWeek> {
  return trainingData.getDashboardWeek(selectedDate, forceRefresh);
}

export async function loadWorkoutPreviewData(
  trainingData: Pick<
    TrainingDataService,
    'hasPendingSync' | 'flushPendingSync' | 'getPlanOverview' | 'getSessionByClientRef'
  >,
  params: {
    workout: TrainingDashboardDay;
    currentOverviewDayId: string | null;
    currentSessionClientRef: string | null;
    forceSessionRefresh: boolean;
  },
): Promise<WorkoutPreviewData> {
  const { workout, currentOverviewDayId, currentSessionClientRef, forceSessionRefresh } = params;
  const reuseOverview = currentOverviewDayId === workout.dayId && !forceSessionRefresh;
  const overview = reuseOverview ? undefined : await trainingData.getPlanOverview(workout.dayId);

  if (workout.currentSessionClientRef) {
    if (currentSessionClientRef !== workout.currentSessionClientRef || forceSessionRefresh) {
      if (trainingData.hasPendingSync()) {
        await trainingData.flushPendingSync();
      }

      const activeSession = await trainingData.getSessionByClientRef(
        workout.currentSessionClientRef,
      );
      return activeSession && activeSession.status === 'in_progress'
        ? { overview, activeSession, clearActiveSession: false }
        : { overview, clearActiveSession: false };
    }

    return { overview, clearActiveSession: false };
  }

  return {
    overview,
    clearActiveSession: currentSessionClientRef !== null,
  };
}
