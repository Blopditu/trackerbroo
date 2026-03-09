export interface Group {
  id: string;
  name: string;
  created_by: string;
  period_end?: string | null;
  motto?: string | null;
  yellow_card_rules?: string | null;
  red_card_consequence?: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

export interface Ingredient {
  id: string;
  owner_id: string;
  name: string;
  source_type?: 'manual' | 'blv_generic' | 'custom_product';
  blv_food_id?: string | null;
  swissfir_id?: string | null;
  category?: string | null;
  reference_unit?: string | null;
  source_dataset?: string | null;
  base_ingredient_id?: string | null;
  kcal_per_100: number;
  cost_per_100?: number | null;
  market_name?: string | null;
  protein_per_100: number;
  carbs_per_100: number;
  fat_per_100: number;
  brand?: string;
  created_at: string;
}

export interface Meal {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface MealItem {
  meal_id: string;
  ingredient_id: string;
  grams: number;
}

export interface LogEntry {
  id: string;
  owner_id: string;
  group_id: string | null;
  day: string; // YYYY-MM-DD
  entry_type: 'ingredient' | 'meal';
  ref_id: string;
  quantity: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
}

export interface DailySummary {
  owner_id: string;
  group_id: string | null;
  day: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  gym_name?: string | null;
  age: number | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  weekly_gym_target: number;
  activity_level: 'low' | 'moderate' | 'high' | null;
  onboarding_completed: boolean;
  track_nutrition: boolean;
  track_gym: boolean;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  logged_on: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
}

export interface GymCheckin {
  id: string;
  group_id: string;
  user_id: string;
  checkin_date: string;
  week_start: string;
  note: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface GroupActivity {
  id: string;
  group_id: string;
  user_id: string;
  day: string;
  gym_done: boolean;
  sleep_done: boolean;
  protein_done: boolean;
  confirm_done: boolean;
  note: string | null;
  photo_url: string | null;
  created_at: string;
}

export type CommunityPostType = 'gym_checkin' | 'protein_milestone' | 'custom';

export interface CommunityPost {
  id: string;
  user_id: string;
  post_type: CommunityPostType;
  day: string;
  note: string | null;
  summary: Record<string, unknown> | null;
  photo_url: string | null;
  created_at: string;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
}

export interface CommunityReaction {
  id: string;
  post_id: string;
  user_id: string;
  gif_url: string;
  created_at: string;
}

export type TrainingEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'bands'
  | 'other';

export type TrainingExerciseType = TrainingEquipment;

export type TrainingMeasurementType = 'weight' | 'bodyfat' | 'waist' | 'chest';

export type TrainingSessionStatus = 'in_progress' | 'completed' | 'aborted';

export type TrainingGraphType =
  | 'workout_count'
  | 'exercise_10rm'
  | 'muscle_volume'
  | 'bodyweight'
  | 'total_volume';

export interface TrainingPlan {
  id: string;
  user_id: string;
  name: string;
  days_per_week: number;
  duration_weeks: number;
  start_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlanDay {
  id: string;
  plan_id: string;
  day_number: number;
  name: string;
  target_muscles: string[];
  sort_order: number;
  created_at: string;
}

export interface TrainingExercise {
  id: string;
  owner_id: string | null;
  name: string;
  equipment: TrainingEquipment;
  primary_muscle: string;
  secondary_muscles: string[];
  images: string[];
  type: TrainingExerciseType;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingDayExercise {
  id: string;
  day_id: string;
  exercise_id: string;
  sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  sort_order: number;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  plan_id: string;
  plan_day_id: string;
  session_date: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: TrainingSessionStatus;
  client_ref: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingSessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  equipment: TrainingEquipment;
  primary_muscle: string;
  secondary_muscles: string[];
  images: string[];
  type: TrainingExerciseType;
  planned_sets: number;
  target_reps: number | null;
  target_seconds: number | null;
  sort_order: number;
  created_at: string;
}

export interface TrainingSetLog {
  id: string;
  session_exercise_id: string;
  set_number: number;
  is_warmup: boolean;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  volume: number;
  estimated_10rm: number | null;
  is_completed: boolean;
  client_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingMeasurement {
  id: string;
  user_id: string;
  type: TrainingMeasurementType;
  value: number;
  measured_on: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingGraphConfig {
  id: string;
  user_id: string;
  graph_type: TrainingGraphType;
  exercise_id: string | null;
  muscle_group: string | null;
  position: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
