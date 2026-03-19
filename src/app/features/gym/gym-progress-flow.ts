import {
  TrainingDataService,
  TrainingGraphDataPoint,
  TrainingPersonalStats
} from '../../core/training/training-data.service';
import { TrainingExercise, TrainingGraphConfig } from '../../core/types';

export interface ProgressHydrationData {
  widgets: TrainingGraphConfig[];
  personalStats: TrainingPersonalStats;
  exercises: TrainingExercise[];
  needsExercises: boolean;
}

export interface ExerciseProgressData {
  tenRmSeries: TrainingGraphDataPoint[];
  exerciseVolumeSeries: TrainingGraphDataPoint[];
}

export async function loadProgressHydrationData(
  trainingData: Pick<TrainingDataService, 'getProgressWidgets' | 'getPersonalStats' | 'getExercises'>,
  params: {
    forceRefresh: boolean;
    currentExercises: TrainingExercise[];
  }
): Promise<ProgressHydrationData> {
  const needsExercises = params.currentExercises.length === 0 || params.forceRefresh;
  const [widgets, personalStats, exercises] = await Promise.all([
    trainingData.getProgressWidgets(params.forceRefresh),
    trainingData.getPersonalStats(params.forceRefresh),
    needsExercises ? trainingData.getExercises(params.forceRefresh) : Promise.resolve(params.currentExercises)
  ]);

  return {
    widgets,
    personalStats,
    exercises,
    needsExercises
  };
}

export async function loadExerciseProgressData(
  trainingData: Pick<TrainingDataService, 'getProgressSeries' | 'getExerciseVolumeSeries'>,
  params: {
    exerciseId: string;
    from: string;
    to: string;
    forceRefresh: boolean;
  }
): Promise<ExerciseProgressData> {
  const [tenRmSeries, exerciseVolumeSeries] = await Promise.all([
    trainingData.getProgressSeries({
      graphType: 'exercise_10rm',
      exerciseId: params.exerciseId,
      from: params.from,
      to: params.to
    }),
    trainingData
      .getExerciseVolumeSeries(params.exerciseId, params.from, params.to, params.forceRefresh)
      .catch(() => [] as TrainingGraphDataPoint[])
  ]);

  return {
    tenRmSeries,
    exerciseVolumeSeries
  };
}
