export interface Group {
  id: string;
  name: string;
  created_by: string;
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
  group_id: string;
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
  group_id: string;
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