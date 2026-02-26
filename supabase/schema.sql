-- Supabase handles JWT secrets automatically - no need to set this
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_end DATE,
  motto TEXT,
  yellow_card_rules TEXT,
  red_card_consequence TEXT,
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
ALTER TABLE groups ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS motto TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS yellow_card_rules TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS red_card_consequence TEXT;

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
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
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
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  kcal DECIMAL(10,2) DEFAULT 0,
  protein DECIMAL(10,2) DEFAULT 0,
  carbs DECIMAL(10,2) DEFAULT 0,
  fat DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_summaries_owner_group_day_uniq
  ON daily_summaries (owner_id, group_id, day) NULLS NOT DISTINCT;

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

-- Group ritual activities
CREATE TABLE IF NOT EXISTS group_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  gym_done BOOLEAN NOT NULL DEFAULT FALSE,
  sleep_done BOOLEAN NOT NULL DEFAULT FALSE,
  protein_done BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_done BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS group_activities_group_user_day_uniq
  ON group_activities (group_id, user_id, day);

-- Allow personal nutrition entries/summaries without a group
ALTER TABLE log_entries ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE daily_summaries SET id = gen_random_uuid() WHERE id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'daily_summaries'
      AND constraint_name = 'daily_summaries_pkey'
  ) THEN
    ALTER TABLE daily_summaries DROP CONSTRAINT daily_summaries_pkey;
  END IF;
END $$;

ALTER TABLE daily_summaries ALTER COLUMN id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'daily_summaries'
      AND constraint_name = 'daily_summaries_pkey'
  ) THEN
    ALTER TABLE daily_summaries ADD PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE daily_summaries ALTER COLUMN group_id DROP NOT NULL;

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
ALTER TABLE group_activities ENABLE ROW LEVEL SECURITY;
