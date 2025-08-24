-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE app_role AS ENUM ('user', 'expert', 'admin');
CREATE TYPE question_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE question_status AS ENUM ('open', 'answered', 'archived');
CREATE TYPE answer_kind AS ENUM ('ai', 'expert', 'user');
CREATE TYPE expert_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  role app_role DEFAULT 'user' NOT NULL,
  bio TEXT,
  skills TEXT[],
  premium_until TIMESTAMPTZ,
  gamification_xp INTEGER DEFAULT 0 NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  streak_days INTEGER DEFAULT 0 NOT NULL,
  last_active DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  tags TEXT[],
  visibility question_visibility DEFAULT 'public' NOT NULL,
  status question_status DEFAULT 'open' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  embedding vector(1536)
);

-- Create question_categories table
CREATE TABLE public.question_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(question_id, category_id)
);

-- Create answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  kind answer_kind NOT NULL,
  content JSONB NOT NULL,
  audio_url TEXT,
  rating_avg NUMERIC DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create answer_ratings table
CREATE TABLE public.answer_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  answer_id UUID REFERENCES public.answers(id) ON DELETE CASCADE NOT NULL,
  rater_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(answer_id, rater_id)
);

-- Create expert_applications table
CREATE TABLE public.expert_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  portfolio_url TEXT,
  skills TEXT[],
  status expert_status DEFAULT 'pending' NOT NULL,
  reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create events table for analytics
CREATE TABLE public.events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status subscription_status DEFAULT 'canceled' NOT NULL,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create user_badges table
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, badge_id)
);

-- Create leaderboard_snapshots table
CREATE TABLE public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('avatars', 'avatars', true),
  ('audio', 'audio', false),
  ('images', 'images', true);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view public profile data" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for categories
CREATE POLICY "Categories are publicly readable" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage categories" ON public.categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for questions
CREATE POLICY "Public questions are readable by all" ON public.questions
  FOR SELECT USING (
    visibility = 'public' OR 
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'expert'))
  );

CREATE POLICY "Users can create questions" ON public.questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions" ON public.questions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions" ON public.questions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for answers
CREATE POLICY "Answers are readable if question is accessible" ON public.answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.questions q 
      WHERE q.id = question_id AND (
        q.visibility = 'public' OR 
        q.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'expert'))
      )
    )
  );

CREATE POLICY "Authenticated users can create answers" ON public.answers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own answers" ON public.answers
  FOR UPDATE USING (auth.uid() = author_id);

-- Create RLS policies for ratings
CREATE POLICY "Users can view ratings" ON public.answer_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can rate answers" ON public.answer_ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "Users can update own ratings" ON public.answer_ratings
  FOR UPDATE USING (auth.uid() = rater_id);

-- Create RLS policies for expert applications
CREATE POLICY "Users can view own applications" ON public.expert_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "Users can create applications" ON public.expert_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Admins can manage applications" ON public.expert_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create RLS policies for events
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Create RLS policies for subscriptions
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscription" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for badges
CREATE POLICY "Badges are publicly readable" ON public.badges
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage badges" ON public.badges
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create RLS policies for user badges
CREATE POLICY "Users can view all badges" ON public.user_badges
  FOR SELECT USING (true);

CREATE POLICY "System can award badges" ON public.user_badges
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for leaderboards
CREATE POLICY "Leaderboards are publicly readable" ON public.leaderboard_snapshots
  FOR SELECT USING (true);

-- Create RLS policies for storage
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Audio files accessible to authenticated users" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload audio" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio' AND auth.uid() IS NOT NULL);

CREATE POLICY "Images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'images');

CREATE POLICY "Users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_questions_user_id ON public.questions(user_id);
CREATE INDEX idx_questions_visibility ON public.questions(visibility);
CREATE INDEX idx_questions_status ON public.questions(status);
CREATE INDEX idx_questions_created_at ON public.questions(created_at DESC);
CREATE INDEX idx_questions_embedding ON public.questions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_answers_question_id ON public.answers(question_id);
CREATE INDEX idx_answers_author_id ON public.answers(author_id);
CREATE INDEX idx_answer_ratings_answer_id ON public.answer_ratings(answer_id);
CREATE INDEX idx_events_name_created_at ON public.events(name, created_at DESC);
CREATE INDEX idx_events_user_id ON public.events(user_id);

-- Create trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_answers_updated_at
  BEFORE UPDATE ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expert_applications_updated_at
  BEFORE UPDATE ON public.expert_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert seed data
INSERT INTO public.categories (name, slug, description, icon) VALUES
  ('Technology', 'technology', 'Programming, AI, software development', '💻'),
  ('Science', 'science', 'Physics, chemistry, biology, mathematics', '🔬'),
  ('Business', 'business', 'Entrepreneurship, marketing, finance', '💼'),
  ('Health', 'health', 'Medicine, fitness, wellness', '🏥'),
  ('Education', 'education', 'Learning, teaching, academic topics', '📚'),
  ('Creative', 'creative', 'Art, design, music, writing', '🎨'),
  ('Lifestyle', 'lifestyle', 'Personal development, relationships', '✨');

INSERT INTO public.badges (code, name, description, icon) VALUES
  ('first_question', 'First Question', 'Asked your first question', '❓'),
  ('first_answer', 'First Answer', 'Provided your first answer', '💬'),
  ('helpful_answer', 'Helpful Answer', 'Received 5 upvotes on an answer', '👍'),
  ('week_streak_3', '3-Day Streak', 'Active for 3 consecutive days', '🔥'),
  ('week_streak_7', '7-Day Streak', 'Active for 7 consecutive days', '🚀'),
  ('expert_status', 'Expert', 'Approved as an expert', '⭐'),
  ('early_adopter', 'Early Adopter', 'One of the first 100 users', '🎉'),
  ('voice_master', 'Voice Master', 'Used voice feature 10 times', '🎤'),
  ('helpful_reviewer', 'Helpful Reviewer', 'Left 10 helpful ratings', '⚖️'),
  ('question_master', 'Question Master', 'Asked 50 questions', '🤔');