-- FEED Platform: Posts Table Migration
-- Creates posts table for the social feed

CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user_created ON public.posts(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts
  FOR SELECT
  USING (NOT is_hidden);

CREATE POLICY "Users can create their own posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Likes table
CREATE TABLE public.post_likes (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Indexes for likes
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes(user_id);

-- Enable RLS for likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.post_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_comments_post ON public.post_comments(post_id);
CREATE INDEX idx_comments_user ON public.post_comments(user_id);
CREATE INDEX idx_comments_parent ON public.post_comments(parent_id);

-- Enable RLS for comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Comments are viewable by everyone"
  ON public.post_comments
  FOR SELECT
  USING (NOT is_hidden);

CREATE POLICY "Users can create comments"
  ON public.post_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.post_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.post_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for comments updated_at
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
