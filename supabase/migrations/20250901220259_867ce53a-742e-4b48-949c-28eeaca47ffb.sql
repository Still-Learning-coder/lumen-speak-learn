-- Create generated_videos table for storing video generation metadata
CREATE TABLE public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  video_prompt TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'huggingface',
  user_question TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for video access (same pattern as generated_images)
CREATE POLICY "Users can create videos in their conversations" 
ON public.generated_videos 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1
  FROM conversation_messages cm
  JOIN conversations c ON c.id = cm.conversation_id
  WHERE cm.id = generated_videos.message_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can view videos from their conversations" 
ON public.generated_videos 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM conversation_messages cm
  JOIN conversations c ON c.id = cm.conversation_id
  WHERE cm.id = generated_videos.message_id AND c.user_id = auth.uid()
));

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

-- Create storage policies for videos
CREATE POLICY "Users can view videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'videos');

CREATE POLICY "Users can upload videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their videos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);