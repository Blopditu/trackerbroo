export interface BuilderExerciseDraft {
  exerciseId: string;
  sets: number;
  targetReps: number | null;
  targetSeconds: number | null;
}

export interface BuilderDayDraft {
  name: string;
  targetMuscles: string;
  exercises: BuilderExerciseDraft[];
}

function defaultExercise(fallbackExerciseId: string): BuilderExerciseDraft {
  return {
    exerciseId: fallbackExerciseId,
    sets: 3,
    targetReps: 8,
    targetSeconds: null
  };
}

export function syncBuilderDays(
  currentDays: BuilderDayDraft[],
  targetDays: number,
  fallbackExerciseId: string
): BuilderDayDraft[] {
  const next = currentDays.map(day => ({
    ...day,
    exercises: [...day.exercises]
  }));

  if (next.length < targetDays) {
    for (let index = next.length; index < targetDays; index += 1) {
      next.push({
        name: `Day ${index + 1}`,
        targetMuscles: '',
        exercises: fallbackExerciseId ? [defaultExercise(fallbackExerciseId)] : []
      });
    }
  } else if (next.length > targetDays) {
    next.length = targetDays;
  }

  return next;
}

export function updateBuilderDayName(days: BuilderDayDraft[], dayIndex: number, value: string): BuilderDayDraft[] {
  const next = [...days];
  next[dayIndex] = { ...next[dayIndex], name: value };
  return next;
}

export function updateBuilderDayMuscles(days: BuilderDayDraft[], dayIndex: number, value: string): BuilderDayDraft[] {
  const next = [...days];
  next[dayIndex] = { ...next[dayIndex], targetMuscles: value };
  return next;
}

export function updateBuilderExercise(
  days: BuilderDayDraft[],
  dayIndex: number,
  exerciseIndex: number,
  field: 'exerciseId' | 'sets' | 'targetReps',
  value: string
): BuilderDayDraft[] {
  const next = [...days];
  const day = { ...next[dayIndex] };
  const exercises = [...day.exercises];
  const row = { ...exercises[exerciseIndex] };

  if (field === 'exerciseId') {
    row.exerciseId = value;
  } else if (field === 'sets') {
    row.sets = Math.max(1, Number(value || 1));
  } else {
    row.targetReps = value ? Math.max(1, Number(value)) : null;
  }

  exercises[exerciseIndex] = row;
  day.exercises = exercises;
  next[dayIndex] = day;
  return next;
}

export function appendBuilderExercise(
  days: BuilderDayDraft[],
  dayIndex: number,
  fallbackExerciseId: string
): BuilderDayDraft[] {
  const next = [...days];
  next[dayIndex] = {
    ...next[dayIndex],
    exercises: [
      ...next[dayIndex].exercises,
      defaultExercise(fallbackExerciseId)
    ]
  };
  return next;
}

export function removeBuilderExerciseAt(
  days: BuilderDayDraft[],
  dayIndex: number,
  exerciseIndex: number
): BuilderDayDraft[] {
  const next = [...days];
  const day = next[dayIndex];
  next[dayIndex] = {
    ...day,
    exercises: day.exercises.filter((_, index) => index !== exerciseIndex)
  };
  return next;
}

export function appendBuilderDay(days: BuilderDayDraft[], fallbackExerciseId: string): BuilderDayDraft[] {
  return [
    ...days,
    {
      name: `Day ${days.length + 1}`,
      targetMuscles: '',
      exercises: fallbackExerciseId ? [defaultExercise(fallbackExerciseId)] : []
    }
  ];
}
