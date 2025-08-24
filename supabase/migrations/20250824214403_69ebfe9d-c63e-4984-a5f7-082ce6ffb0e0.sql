-- Create conversations table to store chat sessions
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_messages table to store individual messages
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  audio_url TEXT,
  is_playing BOOLEAN DEFAULT false
);

-- Create generated_images table to store AI-generated images
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  user_question TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'huggingface',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_audio table to store audio files
CREATE TABLE public.conversation_audio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  voice_provider TEXT NOT NULL,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_audio ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversations
CREATE POLICY "Users can view their own conversations" 
ON public.conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" 
ON public.conversations 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for conversation_messages
CREATE POLICY "Users can view messages from their conversations" 
ON public.conversation_messages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = conversation_messages.conversation_id 
  AND conversations.user_id = auth.uid()
));

CREATE POLICY "Users can create messages in their conversations" 
ON public.conversation_messages 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = conversation_messages.conversation_id 
  AND conversations.user_id = auth.uid()
));

CREATE POLICY "Users can update messages in their conversations" 
ON public.conversation_messages 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = conversation_messages.conversation_id 
  AND conversations.user_id = auth.uid()
));

CREATE POLICY "Users can delete messages from their conversations" 
ON public.conversation_messages 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.conversations 
  WHERE conversations.id = conversation_messages.conversation_id 
  AND conversations.user_id = auth.uid()
));

-- Create RLS policies for generated_images
CREATE POLICY "Users can view images from their conversations" 
ON public.generated_images 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.id = generated_images.message_id 
  AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create images in their conversations" 
ON public.generated_images 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.id = generated_images.message_id 
  AND c.user_id = auth.uid()
));

-- Create RLS policies for conversation_audio
CREATE POLICY "Users can view audio from their conversations" 
ON public.conversation_audio 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.id = conversation_audio.message_id 
  AND c.user_id = auth.uid()
));

CREATE POLICY "Users can create audio in their conversations" 
ON public.conversation_audio 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.id = conversation_audio.message_id 
  AND c.user_id = auth.uid()
));

-- Create function to update conversation updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET updated_at = now() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation timestamp when messages are added
CREATE TRIGGER update_conversation_timestamp
AFTER INSERT OR UPDATE ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX idx_generated_images_message_id ON public.generated_images(message_id);
CREATE INDEX idx_conversation_audio_message_id ON public.conversation_audio(message_id);