import {
  TrainingExecutionExercise,
  TrainingGraphDataPoint,
} from '../../core/training/training-data.service';
import { TrainingGraphConfig } from '../../core/types';
import { roundTo } from '../../core/training/training-utils';

export interface ExerciseProgressRow {
  date: string;
  tenRm: string;
  volume: string;
}

export interface DetailChartPoint {
  date: string;
  value: number;
  x: number;
  y: number;
}

export function equipmentLabel(equipment: string): string {
  const map: Record<string, string> = {
    barbell: 'Langhantel',
    dumbbell: 'Kurzhantel',
    machine: 'Maschine',
    cable: 'Kabel',
    bodyweight: 'Koerpergewicht',
    bands: 'Baender',
    other: 'Sonstiges',
  };

  return map[equipment] || equipment;
}

export function muscleLabel(muscle: string): string {
  const map: Record<string, string> = {
    chest: 'Brust',
    upper_chest: 'Obere Brust',
    lower_chest: 'Untere Brust',
    neck: 'Nacken',
    shoulders: 'Schultern',
    side_delts: 'Seitliche Schulter',
    rear_delts: 'Hintere Schulter',
    front_delts: 'Vordere Schulter',
    triceps: 'Trizeps',
    biceps: 'Bizeps',
    brachialis: 'Brachialis',
    forearms: 'Unterarme',
    lats: 'Latissimus',
    mid_back: 'Mittlerer Ruecken',
    upper_back: 'Oberer Ruecken',
    lower_back: 'Unterer Ruecken',
    traps: 'Trapez',
    posterior_chain: 'Rueckseite',
    quads: 'Quadrizeps',
    hamstrings: 'Hamstrings',
    glutes: 'Gesaess',
    calves: 'Waden',
    abs: 'Bauch',
    core: 'Rumpf',
    obliques: 'Seitliche Bauchmuskeln',
    serratus_anterior: 'Serratus',
    hip_flexors: 'Hueftbeuger',
    rectus_femoris: 'Rectus Femoris',
    teres_major: 'Teres Major',
    soleus: 'Soleus',
    adductors: 'Adduktoren',
    abductors: 'Abduktoren',
  };

  return map[muscle] || muscle;
}

export function targetLabel(exercise: TrainingExecutionExercise): string {
  if (exercise.targetReps) {
    return `${exercise.targetReps} reps`;
  }
  if (exercise.targetSeconds) {
    return `${exercise.targetSeconds}s`;
  }
  return '--';
}

export function graphTitle(widget: TrainingGraphConfig, exerciseName?: string | null): string {
  if (widget.graph_type === 'workout_count') return 'Workout-Haeufigkeit';
  if (widget.graph_type === 'exercise_10rm') return `${exerciseName || 'Übung'} 10RM`;
  if (widget.graph_type === 'muscle_volume')
    return `Muskelvolumen (${widget.muscle_group || 'alle'})`;
  if (widget.graph_type === 'bodyweight') return 'Koerpergewicht';
  return 'Gesamtvolumen';
}

export function graphSubtitle(widget: TrainingGraphConfig): string {
  if (widget.graph_type === 'exercise_10rm' && !widget.exercise_id) return 'Bitte Übung wählen';
  if (widget.graph_type === 'muscle_volume' && !widget.muscle_group) return 'Alle Muskelgruppen';
  return 'Tippen für eine genauere Analyse';
}

export function toLinePoints(points: TrainingGraphDataPoint[]): string {
  if (points.length === 0) {
    return '0,34 100,34';
  }

  const values = points.map((point) => Number(point.point_value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 32 - ((value - min) / range) * 28;
      return `${x},${roundTo(y, 2)}`;
    })
    .join(' ');
}

export function detailChartPoints(points: TrainingGraphDataPoint[]): DetailChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const values = points.map((point) => Number(point.point_value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 100;
    const y = 36 - ((Number(point.point_value) - min) / range) * 32;
    return {
      date: point.point_date,
      value: Number(point.point_value),
      x: Number(roundTo(x, 2)),
      y: Number(roundTo(y, 2)),
    };
  });
}

export function buildExerciseProgressRows(
  tenRmSeries: TrainingGraphDataPoint[],
  exerciseVolumeSeries: TrainingGraphDataPoint[],
): ExerciseProgressRow[] {
  const tenRmByDay = new Map<string, number>();
  const volumeByDay = new Map<string, number>();

  for (const point of tenRmSeries) {
    tenRmByDay.set(point.point_date, Number(point.point_value));
  }

  for (const point of exerciseVolumeSeries) {
    volumeByDay.set(point.point_date, Number(point.point_value));
  }

  const dates = [...new Set([...tenRmByDay.keys(), ...volumeByDay.keys()])]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 8);

  return dates.map((date) => ({
    date,
    tenRm: tenRmByDay.has(date) ? `${tenRmByDay.get(date)!.toFixed(1)} kg` : '--',
    volume: volumeByDay.has(date) ? `${Math.round(volumeByDay.get(date)!)} kg` : '--',
  }));
}
