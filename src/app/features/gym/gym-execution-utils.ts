export interface GymExecutionSetLike {
  clientRef: string;
  setNumber: number;
  isWarmup: boolean;
  weightKg: number | null;
  reps: number | null;
}

export interface PreviousExercisePerformanceSet {
  set_number: number;
  is_warmup: boolean;
  weight_kg: number | null;
  reps: number | null;
}

export function applyPreviousWorkoutPrefill<T extends GymExecutionSetLike>(
  sets: readonly T[],
  previousPerformance: readonly PreviousExercisePerformanceSet[],
): { nextSets: T[]; changed: boolean } {
  const previousBySetNumber = new Map(
    previousPerformance
      .filter((setRow) => !setRow.is_warmup)
      .map((setRow) => [setRow.set_number, setRow] as const),
  );

  let changed = false;

  const nextSets = sets.map((setRow) => {
    if (setRow.isWarmup) {
      return setRow;
    }

    const previousSet = previousBySetNumber.get(setRow.setNumber);
    if (!previousSet) {
      return setRow;
    }

    const nextWeight = setRow.weightKg ?? previousSet.weight_kg ?? null;
    const nextReps = setRow.reps ?? previousSet.reps ?? null;

    if (nextWeight === setRow.weightKg && nextReps === setRow.reps) {
      return setRow;
    }

    changed = true;
    return {
      ...setRow,
      weightKg: nextWeight,
      reps: nextReps,
    };
  });

  return { nextSets, changed };
}

export function carryForwardCompletedSet<T extends GymExecutionSetLike>(
  sets: readonly T[],
  completedClientRef: string,
): { nextSets: T[]; carriedSetClientRef: string | null } {
  const completedIndex = sets.findIndex((setRow) => setRow.clientRef === completedClientRef);
  if (completedIndex < 0) {
    return { nextSets: [...sets], carriedSetClientRef: null };
  }

  const completedSet = sets[completedIndex];
  if (completedSet.weightKg === null && completedSet.reps === null) {
    return { nextSets: [...sets], carriedSetClientRef: null };
  }

  const nextIndex = sets.findIndex((setRow, index) => index > completedIndex && !setRow.isWarmup);
  if (nextIndex < 0) {
    return { nextSets: [...sets], carriedSetClientRef: null };
  }

  const nextSet = sets[nextIndex];
  if (nextSet.weightKg !== null || nextSet.reps !== null) {
    return { nextSets: [...sets], carriedSetClientRef: null };
  }

  const nextSets = sets.map((setRow, index) =>
    index === nextIndex
      ? {
          ...setRow,
          weightKg: completedSet.weightKg,
          reps: completedSet.reps,
        }
      : setRow,
  );

  return {
    nextSets,
    carriedSetClientRef: nextSet.clientRef,
  };
}
