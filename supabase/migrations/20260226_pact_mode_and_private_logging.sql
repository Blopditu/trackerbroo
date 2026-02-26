-- Pact mode + private nutrition logging

-- 1) Groups config fields
ALTER TABLE groups ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS motto TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS yellow_card_rules TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS red_card_consequence TEXT;

-- 2) Private mode logging support
ALTER TABLE log_entries ALTER COLUMN group_id DROP NOT NULL;

-- 3) Ensure daily_summaries has stable PK and null-safe uniqueness for upserts
ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE daily_summaries SET id = gen_random_uuid() WHERE id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
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
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'daily_summaries'
      AND constraint_name = 'daily_summaries_pkey'
  ) THEN
    ALTER TABLE daily_summaries ADD PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE daily_summaries ALTER COLUMN group_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS daily_summaries_owner_group_day_uniq
  ON daily_summaries (owner_id, group_id, day) NULLS NOT DISTINCT;

-- 4) Pact activity table
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

ALTER TABLE group_activities ENABLE ROW LEVEL SECURITY;

-- 5) RLS updates for private/group nutrition scope
DROP POLICY IF EXISTS "Users can CRUD their own log entries" ON log_entries;
CREATE POLICY "Users can read own log entries" ON log_entries
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own log entries for private or joined groups" ON log_entries
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = log_entries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Users can update own log entries for private or joined groups" ON log_entries
  FOR UPDATE USING (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = log_entries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = log_entries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Users can delete own log entries" ON log_entries
  FOR DELETE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Group members can view summaries" ON daily_summaries;
DROP POLICY IF EXISTS "Users can upsert their own summaries" ON daily_summaries;
CREATE POLICY "Users can read own or group summaries" ON daily_summaries
  FOR SELECT USING (
    auth.uid() = owner_id
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = daily_summaries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Users can insert own summaries for private or joined groups" ON daily_summaries
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = daily_summaries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Users can update own summaries for private or joined groups" ON daily_summaries
  FOR UPDATE USING (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = daily_summaries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = owner_id
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM group_members
        WHERE group_members.group_id = daily_summaries.group_id
          AND group_members.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "Users can delete own summaries" ON daily_summaries
  FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Group members can view activities in their groups" ON group_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_activities.group_id
        AND group_members.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create activity for their own groups" ON group_activities
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_activities.group_id
        AND group_members.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update their own activities" ON group_activities
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own activities" ON group_activities
  FOR DELETE USING (auth.uid() = user_id);
