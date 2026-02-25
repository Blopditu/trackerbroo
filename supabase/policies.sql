-- Groups policies
CREATE POLICY "Users can view groups they belong to" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups" ON groups
  FOR UPDATE USING (auth.uid() = created_by);

-- Group members policies
CREATE POLICY "Users can view their memberships" ON group_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Group owners can add members" ON group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

CREATE POLICY "Group owners can remove members" ON group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

-- Ingredients policies
CREATE POLICY "Users can CRUD their own ingredients" ON ingredients
  FOR ALL USING (auth.uid() = owner_id);

-- Meals policies
CREATE POLICY "Users can CRUD their own meals" ON meals
  FOR ALL USING (auth.uid() = owner_id);

-- Meal items policies
CREATE POLICY "Users can CRUD meal items for their meals" ON meal_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meals
      WHERE meals.id = meal_items.meal_id
      AND meals.owner_id = auth.uid()
    )
  );

-- Log entries policies
CREATE POLICY "Users can CRUD their own log entries" ON log_entries
  FOR ALL USING (auth.uid() = owner_id);

-- Daily summaries policies
CREATE POLICY "Group members can view summaries" ON daily_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = daily_summaries.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert their own summaries" ON daily_summaries
  FOR ALL USING (auth.uid() = owner_id);

-- Profiles policies
CREATE POLICY "Users can view own or groupmate profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM group_members self_member
      JOIN group_members target_member
        ON self_member.group_id = target_member.group_id
      WHERE self_member.user_id = auth.uid()
        AND target_member.user_id = profiles.user_id
    )
  );

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Weight logs policies
CREATE POLICY "Users can CRUD their own weight logs" ON weight_logs
  FOR ALL USING (auth.uid() = user_id);

-- Gym check-ins policies
CREATE POLICY "Group members can view check-ins in their groups" ON gym_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = gym_checkins.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create check-ins for their own groups" ON gym_checkins
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = gym_checkins.group_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own check-ins" ON gym_checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own check-ins" ON gym_checkins
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update daily summaries
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update daily summary
  INSERT INTO daily_summaries (owner_id, group_id, day, kcal, protein, carbs, fat, updated_at)
  SELECT
    NEW.owner_id,
    NEW.group_id,
    NEW.day,
    COALESCE(SUM(kcal), 0),
    COALESCE(SUM(protein), 0),
    COALESCE(SUM(carbs), 0),
    COALESCE(SUM(fat), 0),
    NOW()
  FROM log_entries
  WHERE owner_id = NEW.owner_id AND group_id = NEW.group_id AND day = NEW.day
  ON CONFLICT (owner_id, group_id, day)
  DO UPDATE SET
    kcal = EXCLUDED.kcal,
    protein = EXCLUDED.protein,
    carbs = EXCLUDED.carbs,
    fat = EXCLUDED.fat,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on log_entries
CREATE TRIGGER trigger_update_daily_summary
  AFTER INSERT OR UPDATE OR DELETE ON log_entries
  FOR EACH ROW EXECUTE FUNCTION update_daily_summary();
