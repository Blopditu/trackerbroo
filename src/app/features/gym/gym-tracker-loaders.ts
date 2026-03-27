import {
  TrainingDashboardDay,
  TrainingDashboardWeek,
} from '../../core/training/training-data.service';

export function selectTrackedWorkoutDay(
  dashboard: TrainingDashboardWeek,
  selectedDate: string,
): TrainingDashboardDay | null {
  return dashboard.workoutDays.find((workout) => workout.scheduledDate === selectedDate) || null;
}

export function shouldRefreshWorkoutPreview(params: {
  currentOverviewDayId: string | null;
  nextWorkoutDayId: string | null;
  currentSessionClientRef: string | null;
  forceSessionRefresh: boolean;
}): boolean {
  if (params.forceSessionRefresh) {
    return true;
  }

  if (params.currentOverviewDayId !== params.nextWorkoutDayId) {
    return true;
  }

  return Boolean(params.currentSessionClientRef);
}
