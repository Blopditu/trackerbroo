export function buildWorkoutShareSuggestion(completedThisWeek: number): {
  suggestion: string;
  note: string;
} {
  const level = Math.min(Math.max(completedThisWeek, 1), 3);
  const progressLabel = `${level}/3`;

  return {
    suggestion: `${progressLabel} Workouts diese Woche`,
    note: `Gym erledigt ${progressLabel} diese Woche 💪`,
  };
}
