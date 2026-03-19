import { TrainingDashboardDay, TrainingGraphDataPoint } from '../../core/training/training-data.service';
import { TrainingGraphConfig } from '../../core/types';
import { addDays, toIsoDate } from '../../core/training/training-utils';

export function shouldHydrateProgress(progressLoaded: boolean, progressDirty: boolean): boolean {
  return !progressLoaded || progressDirty;
}

export function buildProgressDateRange(rangeDays: number): { from: string; to: string } {
  const to = toIsoDate(new Date());
  const from = toIsoDate(addDays(new Date(), -(rangeDays - 1)));
  return { from, to };
}

export function sortWidgetsByPosition(widgets: TrainingGraphConfig[]): TrainingGraphConfig[] {
  return [...widgets].sort((a, b) => a.position - b.position);
}

export function clearProgressSeries(): { tenRmSeries: TrainingGraphDataPoint[]; exerciseVolumeSeries: TrainingGraphDataPoint[] } {
  return {
    tenRmSeries: [],
    exerciseVolumeSeries: []
  };
}
