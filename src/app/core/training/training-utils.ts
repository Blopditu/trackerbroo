export interface ProgressionInput {
  targetReps: number | null;
  sets: Array<{ reps: number | null; isWarmup: boolean }>;
  currentWeightKg: number | null;
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function estimateOneRm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return weightKg * (1 + reps / 30);
}

export function estimateTenRm(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) {
    return null;
  }
  const oneRm = estimateOneRm(weightKg, reps);
  return roundTo(oneRm * 0.75, 2);
}

export function calculateVolume(weightKg: number | null, reps: number | null): number {
  return roundTo((weightKg || 0) * (reps || 0), 2);
}

export function suggestNextWeightKg(input: ProgressionInput): number | null {
  if (!input.targetReps || !input.currentWeightKg || input.currentWeightKg <= 0) {
    return null;
  }

  const workingSets = input.sets.filter(set => !set.isWarmup);
  if (workingSets.length === 0) {
    return null;
  }

  const allHitTarget = workingSets.every(set => Number(set.reps || 0) >= input.targetReps!);
  if (!allHitTarget) {
    return null;
  }

  return roundTo(input.currentWeightKg + 2.5, 1);
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfIsoWeek(day: Date): Date {
  const copy = new Date(day);
  copy.setHours(0, 0, 0, 0);
  const weekday = copy.getDay();
  const daysSinceMonday = (weekday + 6) % 7;
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

export function addDays(day: Date, count: number): Date {
  const copy = new Date(day);
  copy.setDate(copy.getDate() + count);
  return copy;
}

export function newClientRef(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}
