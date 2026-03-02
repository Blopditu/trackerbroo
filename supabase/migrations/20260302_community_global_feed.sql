BEGIN;

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('gym_checkin', 'protein_milestone', 'custom')),
  day DATE NOT NULL,
  note TEXT,
  summary JSONB,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS community_posts_user_day_type_uniq
  ON public.community_posts (user_id, day, post_type);

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx
  ON public.community_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comments_non_empty_chk CHECK (length(trim(comment_text)) > 0)
);

CREATE INDEX IF NOT EXISTS community_comments_post_created_idx
  ON public.community_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS public.community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gif_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reactions_gif_non_empty_chk CHECK (length(trim(gif_url)) > 0)
);

CREATE INDEX IF NOT EXISTS community_reactions_post_created_idx
  ON public.community_reactions (post_id, created_at);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community posts are readable by authenticated users" ON public.community_posts;
DROP POLICY IF EXISTS "Users can insert own community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can update own community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can delete own community posts" ON public.community_posts;

CREATE POLICY "Community posts are readable by authenticated users"
  ON public.community_posts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own community posts"
  ON public.community_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own community posts"
  ON public.community_posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own community posts"
  ON public.community_posts
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Community comments are readable by authenticated users" ON public.community_comments;
DROP POLICY IF EXISTS "Users can insert own community comments" ON public.community_comments;
DROP POLICY IF EXISTS "Users can update own community comments" ON public.community_comments;
DROP POLICY IF EXISTS "Users can delete own community comments" ON public.community_comments;

CREATE POLICY "Community comments are readable by authenticated users"
  ON public.community_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own community comments"
  ON public.community_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own community comments"
  ON public.community_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own community comments"
  ON public.community_comments
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Community reactions are readable by authenticated users" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can insert own community reactions" ON public.community_reactions;
DROP POLICY IF EXISTS "Users can delete own community reactions" ON public.community_reactions;

CREATE POLICY "Community reactions are readable by authenticated users"
  ON public.community_reactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own community reactions"
  ON public.community_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own community reactions"
  ON public.community_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own or groupmate profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMIT;
