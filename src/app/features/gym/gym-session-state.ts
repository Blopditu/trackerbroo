import {
  TrainingExecutionExercise,
  TrainingExecutionSession,
  TrainingExecutionSet,
} from '../../core/training/training-data.service';

export function findSetByClientRef(
  session: TrainingExecutionSession | null,
  clientRef: string,
): TrainingExecutionSet | null {
  if (!session) {
    return null;
  }

  for (const exercise of session.exercises) {
    const hit = exercise.sets.find((setRow) => setRow.clientRef === clientRef);
    if (hit) {
      return hit;
    }
  }

  return null;
}

export function findSetContext(
  session: TrainingExecutionSession | null,
  clientRef: string,
): { exercise: TrainingExecutionExercise; setRow: TrainingExecutionSet } | null {
  if (!session) {
    return null;
  }

  for (const exercise of session.exercises) {
    const setRow = exercise.sets.find((setItem) => setItem.clientRef === clientRef);
    if (setRow) {
      return { exercise, setRow };
    }
  }

  return null;
}

export function isExerciseCompleted(exercise: TrainingExecutionExercise): boolean {
  return exercise.sets.length > 0 && exercise.sets.every((setRow) => setRow.isCompleted);
}

export function findNextIncompleteExerciseIndex(
  session: TrainingExecutionSession,
  startIndex: number,
): number {
  for (let index = Math.max(0, startIndex); index < session.exercises.length; index += 1) {
    if (!isExerciseCompleted(session.exercises[index])) {
      return index;
    }
  }

  return -1;
}

export function areAllSessionExercisesCompleted(session: TrainingExecutionSession): boolean {
  return session.exercises.every((exercise) => isExerciseCompleted(exercise));
}

export function replaceExerciseSets(
  session: TrainingExecutionSession,
  sessionExerciseId: string,
  nextSets: TrainingExecutionSet[],
): TrainingExecutionSession {
  return {
    ...session,
    exercises: session.exercises.map((currentExercise) =>
      currentExercise.sessionExerciseId === sessionExerciseId
        ? {
            ...currentExercise,
            sets: nextSets,
          }
        : currentExercise,
    ),
  };
}

export function updateSetByClientRef(
  session: TrainingExecutionSession,
  clientRef: string,
  updater: (setRow: TrainingExecutionSet) => TrainingExecutionSet,
): TrainingExecutionSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((setRow) =>
        setRow.clientRef === clientRef ? updater(setRow) : setRow,
      ),
    })),
  };
}
