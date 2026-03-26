import {
  calculateVolume,
  estimateTenRm,
  startOfIsoWeek,
  suggestNextWeightKg,
} from './training-utils';

describe('training-utils', () => {
  it('calculates Epley 10RM', () => {
    expect(estimateTenRm(80, 6)).toBe(72);
    expect(estimateTenRm(80, 5)).toBe(70);
    expect(estimateTenRm(null, 5)).toBeNull();
  });

  it('calculates volume', () => {
    expect(calculateVolume(80, 6)).toBe(480);
    expect(calculateVolume(null, 6)).toBe(0);
  });

  it('suggests +2.5kg when all working sets hit target', () => {
    expect(
      suggestNextWeightKg({
        targetReps: 8,
        currentWeightKg: 70,
        sets: [
          { reps: 10, isWarmup: true },
          { reps: 8, isWarmup: false },
          { reps: 9, isWarmup: false },
        ],
      }),
    ).toBe(72.5);

    expect(
      suggestNextWeightKg({
        targetReps: 8,
        currentWeightKg: 70,
        sets: [
          { reps: 8, isWarmup: false },
          { reps: 7, isWarmup: false },
        ],
      }),
    ).toBeNull();
  });

  it('gets monday week start', () => {
    const monday = startOfIsoWeek(new Date('2026-03-12T10:00:00Z'));
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(2);
    expect(monday.getDate()).toBe(9);
    expect(monday.getDay()).toBe(1);
  });
});
