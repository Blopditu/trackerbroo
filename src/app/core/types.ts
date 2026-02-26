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
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  weekly_gym_target: number;
  activity_level: 'low' | 'moderate' | 'high' | null;
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
