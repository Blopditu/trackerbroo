-- Supabase handles JWT secrets automatically - no need to set this
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kcal_per_100 DECIMAL(10,2) NOT NULL,
  cost_per_100 DECIMAL(10,2),
  market_name TEXT,
  protein_per_100 DECIMAL(10,2) NOT NULL,
  carbs_per_100 DECIMAL(10,2) NOT NULL,
  fat_per_100 DECIMAL(10,2) NOT NULL,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing ingredient columns for existing projects
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS cost_per_100 DECIMAL(10,2);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS market_name TEXT;

-- Meals
CREATE TABLE IF NOT EXISTS meals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meal items
CREATE TABLE IF NOT EXISTS meal_items (
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  grams DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (meal_id, ingredient_id)
);

-- Log entries
CREATE TABLE IF NOT EXISTS log_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('ingredient', 'meal')),
  ref_id UUID NOT NULL, -- ingredient_id or meal_id
  quantity DECIMAL(10,2) NOT NULL, -- grams or servings
  kcal DECIMAL(10,2) NOT NULL,
  protein DECIMAL(10,2) NOT NULL,
  carbs DECIMAL(10,2) NOT NULL,
  fat DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  kcal DECIMAL(10,2) DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  carbs DECIMAL(10,2) DEFAULT 0,
  fat DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (owner_id, group_id, day)
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  height_cm DECIMAL(6,2),
  current_weight_kg DECIMAL(6,2),
  target_weight_kg DECIMAL(6,2),
  weekly_gym_target INTEGER NOT NULL DEFAULT 3 CHECK (weekly_gym_target BETWEEN 1 AND 14),
  activity_level TEXT CHECK (activity_level IN ('low', 'moderate', 'high')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily weight logs
CREATE TABLE IF NOT EXISTS weight_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on DATE NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL CHECK (weight_kg > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, logged_on)
);

-- Gym check-ins
CREATE TABLE IF NOT EXISTS gym_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  week_start DATE NOT NULL,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_checkins ENABLE ROW LEVEL SECURITY;
