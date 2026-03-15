import {
  applyPreviousWorkoutPrefill,
  carryForwardCompletedSet,
  GymExecutionSetLike,
  PreviousExercisePerformanceSet
} from './gym-execution-utils';

describe('gym-execution-utils', () => {
  const createSet = (overrides: Partial<GymExecutionSetLike> = {}): GymExecutionSetLike => ({
    clientRef: overrides.clientRef ?? `set-${overrides.setNumber ?? 1}`,
    setNumber: overrides.setNumber ?? 1,
    isWarmup: overrides.isWarmup ?? false,
    weightKg: overrides.weightKg ?? null,
    reps: overrides.reps ?? null
  });

  const createPreviousSet = (
    overrides: Partial<PreviousExercisePerformanceSet> = {}
  ): PreviousExercisePerformanceSet => ({
    set_number: overrides.set_number ?? 1,
    is_warmup: overrides.is_warmup ?? false,
    weight_kg: overrides.weight_kg ?? null,
    reps: overrides.reps ?? null
  });

  it('prefills blank sets from matching previous workout set numbers', () => {
    const { nextSets, changed } = applyPreviousWorkoutPrefill(
      [createSet({ setNumber: 1 }), createSet({ setNumber: 2 })],
      [
        createPreviousSet({ set_number: 1, weight_kg: 20, reps: 8 }),
        createPreviousSet({ set_number: 2, weight_kg: 22.5, reps: 8 })
      ]
    );

    expect(changed).toBe(true);
    expect(nextSets).toEqual([
      createSet({ setNumber: 1, weightKg: 20, reps: 8 }),
      createSet({ setNumber: 2, weightKg: 22.5, reps: 8 })
    ]);
  });

  it('does not overwrite values already entered in the active session', () => {
    const { nextSets, changed } = applyPreviousWorkoutPrefill(
      [
        createSet({ setNumber: 1, weightKg: 25, reps: 8 }),
        createSet({ setNumber: 2, reps: 10 })
      ],
      [
        createPreviousSet({ set_number: 1, weight_kg: 20, reps: 8 }),
        createPreviousSet({ set_number: 2, weight_kg: 22.5, reps: 12 })
      ]
    );

    expect(changed).toBe(true);
    expect(nextSets).toEqual([
      createSet({ setNumber: 1, weightKg: 25, reps: 8 }),
      createSet({ setNumber: 2, weightKg: 22.5, reps: 10 })
    ]);
  });

  it('ignores warmup history and safely handles mismatched set counts', () => {
    const { nextSets, changed } = applyPreviousWorkoutPrefill(
      [createSet({ setNumber: 1 }), createSet({ setNumber: 2 }), createSet({ setNumber: 3 })],
      [
        createPreviousSet({ set_number: 1, is_warmup: true, weight_kg: 10, reps: 12 }),
        createPreviousSet({ set_number: 1, weight_kg: 20, reps: 8 }),
        createPreviousSet({ set_number: 2, weight_kg: 22.5, reps: 8 }),
        createPreviousSet({ set_number: 4, weight_kg: 25, reps: 6 })
      ]
    );

    expect(changed).toBe(true);
    expect(nextSets).toEqual([
      createSet({ setNumber: 1, weightKg: 20, reps: 8 }),
      createSet({ setNumber: 2, weightKg: 22.5, reps: 8 }),
      createSet({ setNumber: 3 })
    ]);
  });

  it('leaves sets unchanged when there is no previous workout history', () => {
    const sets = [createSet({ setNumber: 1 }), createSet({ setNumber: 2 })];

    const { nextSets, changed } = applyPreviousWorkoutPrefill(sets, []);

    expect(changed).toBe(false);
    expect(nextSets).toEqual(sets);
  });

  it('carries the completed set values into the next blank set', () => {
    const { nextSets, carriedSetClientRef } = carryForwardCompletedSet(
      [
        createSet({ clientRef: 'set-1', setNumber: 1, weightKg: 20, reps: 8 }),
        createSet({ clientRef: 'set-2', setNumber: 2 }),
        createSet({ clientRef: 'set-3', setNumber: 3 })
      ],
      'set-1'
    );

    expect(carriedSetClientRef).toBe('set-2');
    expect(nextSets[1]).toEqual(createSet({ clientRef: 'set-2', setNumber: 2, weightKg: 20, reps: 8 }));
  });

  it('does not carry forward into a set that already has weight or reps', () => {
    const sets = [
      createSet({ clientRef: 'set-1', setNumber: 1, weightKg: 20, reps: 8 }),
      createSet({ clientRef: 'set-2', setNumber: 2, reps: 10 })
    ];

    const { nextSets, carriedSetClientRef } = carryForwardCompletedSet(sets, 'set-1');

    expect(carriedSetClientRef).toBeNull();
    expect(nextSets).toEqual(sets);
  });
});
