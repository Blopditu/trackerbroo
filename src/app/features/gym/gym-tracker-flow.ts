import {
  TrainingDashboardDay,
  TrainingDashboardWeek,
  TrainingDataService,
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
    'getPlanOverview'
  >,
  params: {
    workout: TrainingDashboardDay | null;
    currentOverviewDayId: string | null;
    forceSessionRefresh: boolean;
  },
): Promise<WorkoutPreviewData> {
  const { workout, currentOverviewDayId, forceSessionRefresh } = params;
  if (!workout) {
    return {
      clearActiveSession: false,
    };
  }

  const reuseOverview = currentOverviewDayId === workout.dayId && !forceSessionRefresh;
  const overview = reuseOverview ? undefined : await trainingData.getPlanOverview(workout.dayId);

  return {
    overview,
    clearActiveSession: false,
  };
}
