import {
  TrainingDashboardDay,
  TrainingDashboardWeek,
} from '../../core/training/training-data.service';

export function selectTrackedWorkoutDay(
  dashboard: TrainingDashboardWeek,
  selectedDayId: string | null,
): TrainingDashboardDay | null {
  return (
    dashboard.workoutDays.find((workout) => workout.dayId === selectedDayId) ||
    dashboard.workoutDays[0] ||
    null
  );
}

export function shouldRefreshWorkoutPreview(params: {
  currentOverviewDayId: string | null;
  nextWorkoutDayId: string;
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
