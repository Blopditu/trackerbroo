import { vi } from 'vitest';
import { loadExerciseProgressData, loadProgressHydrationData } from './gym-progress-flow';

describe('gym-progress-flow', () => {
  it('hydrates progress widgets and only reloads exercises when needed', async () => {
    const trainingData = {
      getProgressWidgets: vi.fn().mockResolvedValue([{ id: 'widget-1', position: 1 }]),
      getPersonalStats: vi.fn().mockResolvedValue({ totalWorkouts: 12 }),
      getExercises: vi.fn().mockResolvedValue([{ id: 'exercise-1' }]),
    };

    const cold = await loadProgressHydrationData(trainingData as never, {
      forceRefresh: false,
      currentExercises: [],
    });
    const warm = await loadProgressHydrationData(trainingData as never, {
      forceRefresh: false,
      currentExercises: [{ id: 'exercise-2' }] as never,
    });

    expect(cold.needsExercises).toBe(true);
    expect(warm.needsExercises).toBe(false);
    expect(trainingData.getExercises).toHaveBeenCalledTimes(1);
  });

  it('loads ten-rm and volume series together and falls back to empty volume on failure', async () => {
    const trainingData = {
      getProgressSeries: vi.fn().mockResolvedValue([{ point_date: '2026-03-19', point_value: 80 }]),
      getExerciseVolumeSeries: vi.fn().mockRejectedValue(new Error('no volume')),
    };

    const result = await loadExerciseProgressData(trainingData as never, {
      exerciseId: 'exercise-1',
      from: '2026-03-01',
      to: '2026-03-19',
      forceRefresh: false,
    });

    expect(result.tenRmSeries).toEqual([{ point_date: '2026-03-19', point_value: 80 }]);
    expect(result.exerciseVolumeSeries).toEqual([]);
  });
});
