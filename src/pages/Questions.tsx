import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, MicOff, Send, Bot, User, Volume2, VolumeX, Play, Pause, Video, Crown, Loader2, ImageIcon, Paperclip, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  audioUrl?: string;
  isPlaying?: boolean;
  generatedImageUrl?: string;
  conversationId?: string;
}

// Audio recorder class
class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      this.chunks = [];
      this.mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      this.mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to access microphone');
    }
  }
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No recording in progress'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: 'audio/webm'
        });
        this.cleanup();
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
const Questions = () => {
  const {
    user,
    profile
  } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Map<string, string>>(new Map());
  const [imageGenerating, setImageGenerating] = useState<Set<string>>(new Set());
  const [webSpeechSupported, setWebSpeechSupported] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [speechState, setSpeechState] = useState<{
    messageId: string | null;
    text: string;
    position: number;
    isPaused: boolean;
    isLoading: boolean;
  }>({
    messageId: null,
    text: '',
    position: 0,
    isPaused: false,
    isLoading: false
  });
  const recorderRef = useRef<AudioRecorder | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();

  useEffect(() => {
    if (!user) {
      // Don't redirect to auth, just disable functionality
      return;
    }
    
    // Create new conversation when component mounts
    createNewConversation();
  }, [user]);

  const createNewConversation = async () => {
    if (!user) return;
    
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New Conversation'
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setCurrentConversationId(conversation.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
    }
  };

  const saveMessageToDatabase = async (message: Message): Promise<string | null> => {
    if (!currentConversationId || !user) return null;
    
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: currentConversationId,
          content: message.content,
          role: message.role,
          audio_url: message.audioUrl,
          is_playing: message.isPlaying || false
        })
        .select()
        .single();
        
      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  };

  const saveGeneratedImageToDatabase = async (
    messageId: string, 
    imageUrl: string, 
    imagePrompt: string, 
    userQuestion: string, 
    aiResponse: string
  ) => {
    if (!user) return;
    
    try {
      await supabase
        .from('generated_images')
        .insert({
          message_id: messageId,
          image_url: imageUrl,
          image_prompt: imagePrompt,
          user_question: userQuestion,
          ai_response: aiResponse,
          provider: 'huggingface'
        });
    } catch (error) {
      console.error('Error saving generated image:', error);
    }
  };

  const saveAudioToDatabase = async (messageId: string, audioUrl: string, provider: string, voiceId?: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('conversation_audio')
        .insert({
          message_id: messageId,
          audio_url: audioUrl,
          voice_provider: provider,
          voice_id: voiceId
        });
    } catch (error) {
      console.error('Error saving audio:', error);
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    // Check if Web Speech API is supported
    setWebSpeechSupported('speechSynthesis' in window);
  }, []);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const startRecording = async () => {
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setIsRecording(true);
      toast.success('Recording started. Speak your question!');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };
  const stopRecording = async () => {
    if (!recorderRef.current) return;
    try {
      setIsRecording(false);
      setIsProcessing(true);
      const audioBlob = await recorderRef.current.stop();
      const base64Audio = await blobToBase64(audioBlob);

      // Convert speech to text
      const {
        data: transcriptionData,
        error: transcriptionError
      } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio
        }
      });
      if (transcriptionError) {
        throw new Error(transcriptionError.message);
      }
      const transcribedText = transcriptionData.text;
      if (transcribedText.trim()) {
        // Put the transcribed text in the input box
        setInputText(transcribedText.trim());
        toast.success('Voice transcribed! You can edit and send the message.');
      } else {
        toast.error('No speech detected. Please try again.');
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sendQuestion = async () => {
    if ((!inputText.trim() && selectedFiles.length === 0) || isProcessing) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputText.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to database if user is logged in
    let savedUserMessageId = userMessage.id;
    if (user && currentConversationId) {
      const dbMessageId = await saveMessageToDatabase(userMessage);
      if (dbMessageId) {
        savedUserMessageId = dbMessageId;
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, id: savedUserMessageId }
            : msg
        ));
      }
    }

    const currentQuestion = inputText.trim();
    const currentFiles = [...selectedFiles];
    setInputText('');
    setSelectedFiles([]);
    setIsProcessing(true);
    
    try {
      // Convert files to base64 for sending to AI
      const filesForAI = await Promise.all(
        currentFiles.map(async (file) => ({
          name: file.name,
          type: file.type,
          data: await fileToBase64(file)
        }))
      );

      // Get AI response
      const { data: responseData, error: responseError } = await supabase.functions.invoke('chat-completion', {
        body: {
          message: currentQuestion,
          files: filesForAI,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }
      });
      
      console.log('Edge function response:', { responseData, responseError });
      
      if (responseError) {
        console.error('Supabase function invoke error:', responseError);
        throw new Error(`Function invoke error: ${responseError.message}`);
      }
      
      // Check if the response data contains an error (from our edge function)
      if (responseData && responseData.error) {
        console.error('Edge function returned error:', responseData);
        
        // Handle specific rate limit errors with better messaging
        if (responseData.type === 'rate_limit') {
          const retryAfter = responseData.retryAfter;
          const retryMessage = retryAfter ? ` Try again in ${retryAfter} seconds.` : ' Please try again in a few minutes.';
          throw new Error(`OpenAI rate limit exceeded.${retryMessage} Consider checking your OpenAI billing plan for higher limits.`);
        }
        
        throw new Error(`Edge function error: ${responseData.error} - ${responseData.details || ''}`);
      }
      
      if (!responseData) {
        console.error('No response data received from edge function');
        throw new Error('No response data received from edge function');
      }
      
      const assistantResponse = responseData.response;

      // Create and add assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: assistantResponse,
        role: 'assistant',
        timestamp: new Date(),
        audioUrl: '',
        isPlaying: false
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to database if user is logged in
      if (user && currentConversationId) {
        const dbMessageId = await saveMessageToDatabase(assistantMessage);
        if (dbMessageId) {
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, id: dbMessageId }
              : msg
          ));
        }
      }
      
    } catch (error) {
      console.error('Error getting response:', error);
      
      // Extract meaningful error message
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      let toastMessage = 'Failed to get response. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Rate limit reached') || error.message.includes('rate limit exceeded')) {
          errorContent = '🚫 **Gemini Rate Limit Reached**\n\nThe Google Gemini API is experiencing high demand. Here are your options:\n\n1. **Try again in a few minutes** - rate limits usually reset quickly\n2. **Check your Google Cloud Console** at [console.cloud.google.com](https://console.cloud.google.com)\n3. **Consider upgrading your quota** for higher limits\n4. **Wait for automatic reset** - most limits reset daily\n\nGemini has generous free tier limits that should handle most usage.';
          toastMessage = 'Gemini rate limit reached. Please try again in a few minutes.';
        } else if (error.message.includes('insufficient_quota')) {
          errorContent = '💳 **Gemini Quota Exceeded**\n\nYour Google API account needs attention:\n\n1. **Visit**: [Google Cloud Console](https://console.cloud.google.com)\n2. **Check your API quotas** and billing\n3. **Enable billing** or **increase quotas** if needed\n\nGemini offers a generous free tier for new users.';
          toastMessage = 'Gemini quota exceeded. Check your Google Cloud Console';
        } else if (error.message.includes('invalid_api_key')) {
          errorContent = '🔑 **Invalid API Key**\n\nThere\'s an issue with the Gemini API configuration. Please contact support.';
          toastMessage = 'Invalid Gemini API key. Please contact support.';
        } else if (error.message.includes('Edge Function returned a non-2xx status code')) {
          errorContent = '⚠️ **Service Temporarily Unavailable**\n\nOur AI service is experiencing high demand. This is likely due to:\n\n- Gemini API rate limiting\n- High server load\n- Temporary service interruption\n\nPlease **try again in a few minutes**. Gemini typically has excellent uptime and generous limits.';
          toastMessage = 'Service temporarily unavailable. Please try again in a few minutes.';
        } else if (error.message) {
          errorContent = `❌ **Error**: ${error.message}`;
          toastMessage = error.message;
        }
      }
      
      toast.error(toastMessage);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: errorContent,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };
  const playAudio = (messageId: string, audioUrl: string) => {
    // Stop current audio if playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);

    // Update message playing state
    setMessages(prev => prev.map(msg => msg.id === messageId ? {
      ...msg,
      isPlaying: true
    } : {
      ...msg,
      isPlaying: false
    }));
    audio.onended = () => {
      setMessages(prev => prev.map(msg => msg.id === messageId ? {
        ...msg,
        isPlaying: false
      } : msg));
      setCurrentAudio(null);
    };
    audio.onerror = () => {
      toast.error('Failed to play audio');
      setMessages(prev => prev.map(msg => msg.id === messageId ? {
        ...msg,
        isPlaying: false
      } : msg));
      setCurrentAudio(null);
    };
    audio.play();
  };
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isPlaying: false
      })));
    }
  };
  // Clean text by removing markdown formatting and symbols
  const cleanTextForSpeech = (text: string): string => {
    // Safety check for undefined or null text
    if (!text || typeof text !== 'string') {
      console.warn('cleanTextForSpeech received invalid text:', text);
      return '';
    }
    
    return text
      // Remove markdown bold/italic formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove markdown headers
      .replace(/#+\s/g, '')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown code blocks
      .replace(/```[^`]*```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove bullet points and dashes
      .replace(/^[-*+]\s/gm, '')
      // Remove multiple spaces and normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleGenerateImage = async (messageId: string, userQuestion: string, aiResponse: string) => {
    if (imageGenerating.has(messageId) || !user) return;

    // Don't generate images for error messages or empty responses
    if (!aiResponse || aiResponse.trim().length === 0 || aiResponse.includes('Error:') || aiResponse.includes('rate limit') || aiResponse.includes('quota exceeded')) {
      toast.error('Cannot generate image for error messages or empty responses');
      return;
    }

    setImageGenerating(prev => new Set(prev).add(messageId));

    try {
      // Validate inputs
      if (!userQuestion || !aiResponse) {
        throw new Error('Missing question or response for image generation');
      }

      // Try to generate the image prompt, but fallback to a simple prompt if it fails
      let imagePrompt = `Visual illustration of: ${userQuestion}. Educational, clear, informative style.`;
      
      try {
        const promptResponse = await supabase.functions.invoke('generate-image-prompt', {
          body: { userQuestion, aiResponse }
        });

        if (promptResponse.data?.imagePrompt && !promptResponse.error) {
          imagePrompt = promptResponse.data.imagePrompt;
          console.log('✅ Generated enhanced image prompt:', imagePrompt);
        } else {
          console.log('⚠️ Using fallback image prompt due to prompt generation error:', promptResponse.error);
        }
      } catch (promptError) {
        console.log('⚠️ Using fallback image prompt due to prompt generation failure:', promptError);
      }

      // Then, generate the image using the prompt
      const imageResponse = await supabase.functions.invoke('image-generation', {
        body: { prompt: imagePrompt }
      });

      if (imageResponse.error) {
        console.error('Image generation error:', imageResponse.error);
        throw new Error(imageResponse.error.message || 'Failed to generate image');
      }

      if (!imageResponse.data?.imageUrl) {
        throw new Error('No image URL received from server');
      }

      const { imageUrl } = imageResponse.data;

      // Store the generated image in local state
      setGeneratedImages(prev => new Map(prev).set(messageId, imageUrl));

      // Update the message with the generated image
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, generatedImageUrl: imageUrl }
          : msg
      ));

      // Save the generated image to database
      await saveGeneratedImageToDatabase(messageId, imageUrl, imagePrompt, userQuestion, aiResponse);

      toast.success('Image generated successfully!');
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image. Please try again.');
    } finally {
      setImageGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
    }
  };

  const startSpeech = async (messageId: string, content: string) => {
    if (isMuted) {
      toast.info('Audio is muted. Unmute to hear the response.');
      return;
    }

    // Validate content parameter and check for error messages
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      toast.error('No content available for text-to-speech');
      return;
    }

    // Don't generate audio for error messages
    if (content.includes('Error:') || content.includes('rate limit') || content.includes('quota exceeded') || content.includes('API key')) {
      toast.error('Cannot generate audio for error messages');
      return;
    }

    const cleanedContent = cleanTextForSpeech(content);
    
    // Set loading state
    setSpeechState({
      messageId,
      text: cleanedContent,
      position: 0,
      isPaused: false,
      isLoading: true
    });

    try {
      // Try to generate audio first
      const audioUrl = await generateAudio(cleanedContent);
      
      if (audioUrl && audioUrl !== 'web-speech-synthesis') {
        // Use generated audio with our custom controls
        // Update message with the audio URL
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, audioUrl }
            : msg
        ));
        playSpeechFromPosition(messageId, audioUrl, cleanedContent, 0);
      } else {
        // Fallback to web speech API with position tracking
        // Update message with web speech identifier
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, audioUrl: 'web-speech-synthesis' }
            : msg
        ));
        speakWithWebSpeech(messageId, cleanedContent, 0);
      }
    } catch (error) {
      console.error('Speech generation error:', error);
      toast.error('Failed to generate speech');
      setSpeechState({
        messageId: null,
        text: '',
        position: 0,
        isPaused: false,
        isLoading: false
      });
    }
  };

  const pauseSpeech = () => {
    if (speechState.messageId) {
      // Stop current audio
      if (currentAudio) {
        currentAudio.pause();
      }
      
      // Cancel web speech if active
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      setSpeechState(prev => ({ ...prev, isPaused: true, isLoading: false }));
      
      // Update message state
      setMessages(prev => prev.map(msg => 
        msg.id === speechState.messageId 
          ? { ...msg, isPlaying: false }
          : msg
      ));
    }
  };

  const resumeSpeech = () => {
    if (speechState.messageId && speechState.isPaused) {
      const message = messages.find(msg => msg.id === speechState.messageId);
      
      if (message?.audioUrl && message.audioUrl !== 'web-speech-synthesis') {
        // Resume generated audio from position
        playSpeechFromPosition(speechState.messageId, message.audioUrl, speechState.text, speechState.position);
      } else {
        // Resume web speech from position
        speakWithWebSpeech(speechState.messageId, speechState.text, speechState.position);
      }
    }
  };

  const stopSpeech = () => {
    // Stop all audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Cancel web speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    // Reset speech state
    setSpeechState({
      messageId: null,
      text: '',
      position: 0,
      isPaused: false,
      isLoading: false
    });

    // Update all messages to not playing
    setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
  };

  const playSpeechFromPosition = (messageId: string, audioUrl: string, text: string, startPosition: number) => {
    // Stop any current audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    const audio = new Audio(audioUrl);
    setCurrentAudio(audio);

    // Calculate approximate time position (very rough estimation)
    const estimatedDuration = text.length / 15; // ~15 characters per second average speaking rate
    const startTime = (startPosition / text.length) * estimatedDuration;
    
    audio.currentTime = Math.max(0, startTime);

    // Update states
    setSpeechState(prev => ({ 
      ...prev, 
      isPaused: false, 
      isLoading: false,
      position: startPosition 
    }));

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isPlaying: true }
        : { ...msg, isPlaying: false }
    ));

    // Track position during playback (rough estimation)
    const progressInterval = setInterval(() => {
      if (audio.paused || audio.ended) {
        clearInterval(progressInterval);
        return;
      }
      
      const progress = audio.currentTime / (estimatedDuration || 1);
      const currentPos = Math.floor(progress * text.length);
      
      setSpeechState(prev => ({ ...prev, position: currentPos }));
    }, 500);

    audio.onended = () => {
      clearInterval(progressInterval);
      stopSpeech();
    };

    audio.onerror = () => {
      clearInterval(progressInterval);
      toast.error('Failed to play audio');
      stopSpeech();
    };

    audio.play();
  };

  const speakWithWebSpeech = (messageId: string, text: string, startPosition: number) => {
    // Get the text from the current position
    const textToSpeak = text.substring(startPosition);
    
    if (!textToSpeak.trim()) {
      stopSpeech();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use a pleasant voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Samantha') || 
      voice.name.includes('Alex') || 
      voice.name.includes('Karen') || 
      voice.name.toLowerCase().includes('female')
    ) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Update states
    setSpeechState(prev => ({ 
      ...prev, 
      isPaused: false, 
      isLoading: false,
      position: startPosition 
    }));

    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isPlaying: true }
        : { ...msg, isPlaying: false }
    ));

    // Track progress during speech
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(progressInterval);
        return;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      const estimatedCharsSpoken = Math.floor(elapsed * 15); // ~15 chars per second
      const currentPos = Math.min(startPosition + estimatedCharsSpoken, text.length);
      
      setSpeechState(prev => ({ ...prev, position: currentPos }));
    }, 500);

    utterance.onend = () => {
      clearInterval(progressInterval);
      stopSpeech();
    };

    utterance.onerror = (error) => {
      clearInterval(progressInterval);
      console.error('Web Speech synthesis error:', error);
      stopSpeech();
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleReadAloud = (messageId: string, content: string) => {
    if (speechState.messageId === messageId) {
      if (speechState.isPaused) {
        resumeSpeech();
      } else if (speechState.isLoading) {
        // Do nothing while loading
        return;
      } else {
        pauseSpeech();
      }
    } else {
      // Stop current speech and start new one
      stopSpeech();
      startSpeech(messageId, content);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} file(s) selected`);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };
  const generateAudio = async (text: string): Promise<string> => {
    try {
      console.log('🎵 Starting audio generation for text:', {
        textLength: text.length
      });

      // First try Supabase TTS function
      const {
        data: audioData,
        error: audioError
      } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: text,
          voice: '9BWtsMINqrJLrRacOk9x'
        }
      });
      console.log('🎵 TTS Response:', {
        hasAudioData: !!audioData?.audioContent,
        audioError: audioError?.message,
        audioDataError: audioData?.error
      });
      if (!audioError && audioData?.audioContent && !audioData?.error) {
        console.log('✅ External TTS successful');
        return `data:audio/mp3;base64,${audioData.audioContent}`;
      }

      // Log the specific error for debugging
      const errorMsg = audioError?.message || audioData?.error || 'Unknown TTS error';
      console.warn('⚠️ External TTS failed:', errorMsg);

      // Fallback to Web Speech API if supported
      if (webSpeechSupported) {
        console.log('🎵 Falling back to Web Speech API');
        return await generateWebSpeechAudio(text);
      }

      // If no fallback available, show specific error
      if (errorMsg.includes('401') || errorMsg.includes('API key')) {
        toast.error("TTS unavailable: API key issue");
      } else if (errorMsg.includes('429') || errorMsg.includes('quota')) {
        toast.error("TTS unavailable: API quota exceeded");
      } else if (errorMsg.includes('unusual_activity')) {
        toast.error("TTS temporarily unavailable due to API limits");
      } else {
        toast.error("TTS unavailable - continuing with text only");
      }
      return '';
    } catch (error) {
      console.error('🚨 Audio generation failed completely:', error);

      // Try Web Speech as last resort
      if (webSpeechSupported) {
        console.log('🎵 Last resort: Web Speech API');
        try {
          return await generateWebSpeechAudio(text);
        } catch (webSpeechError) {
          console.error('🚨 Web Speech also failed:', webSpeechError);
        }
      }
      toast.error("All audio services unavailable - continuing with text only");
      return '';
    }
  };
  const generateWebSpeechAudio = async (text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔊 Generating audio with Web Speech API');

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to use a pleasant voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => voice.name.includes('Samantha') || voice.name.includes('Alex') || voice.name.includes('Karen') || voice.name.toLowerCase().includes('female')) || voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        // For generateWebSpeechAudio, we don't actually speak here
        // Just return the identifier immediately
        console.log('✅ Web Speech API available - returning identifier');
        resolve('web-speech-synthesis');
      } catch (error) {
        console.error('🚨 Web Speech setup error:', error);
        reject(error);
      }
    });
  };
  const generateVideoResponse = () => {
    if (!isPremium) {
      toast.error('Video responses are only available for Premium users');
      return;
    }
    toast.info('Video response generation coming soon!');
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold gradient-text mb-4">Ask Your Question</h1>
            <p className="text-xl text-muted-foreground">
              Ask questions using voice or text and get AI-powered responses
            </p>
          </div>

          {/* Messages Area */}
          <Card className="mb-6 h-[500px] flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center justify-between">
                <span>Conversation</span>
                <div className="flex items-center gap-2">
                  
                  {isPremium && <Badge className="bg-yellow-500/10 text-yellow-500">
                      <Crown className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {messages.length === 0 && <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Start by asking a question using voice or text!
                  </p>
                </div>}
              
              {messages.map(message => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>}
                  
                  <div className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {message.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted-foreground/10 prose-pre:text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    code: ({
                      className,
                      children,
                      ...props
                    }: any) => {
                      const isInline = !className || !className.includes('language-');
                      if (isInline) {
                        return <code className="bg-muted-foreground/20 text-foreground px-1 py-0.5 rounded text-sm" {...props}>
                                    {children}
                                  </code>;
                      }
                      return <pre className="bg-muted-foreground/10 p-3 rounded-lg overflow-x-auto">
                                  <code className="text-sm" {...props}>
                                    {children}
                                  </code>
                                </pre>;
                    },
                    ul: ({
                      children
                    }) => <ul className="list-disc list-inside space-y-1 my-2">
                                {children}
                              </ul>,
                    ol: ({
                      children
                    }) => <ol className="list-decimal list-inside space-y-1 my-2">
                                {children}
                              </ol>,
                    blockquote: ({
                      children
                    }) => <blockquote className="border-l-4 border-primary/50 pl-4 italic my-2">
                                {children}
                              </blockquote>,
                    h1: ({
                      children
                    }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                    h2: ({
                      children
                    }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                    h3: ({
                      children
                    }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                  }}>
                          {message.content}
                        </ReactMarkdown>
                      </div> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    
                    {/* Display generated image if available */}
                    {message.generatedImageUrl && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <img 
                          src={message.generatedImageUrl} 
                          alt="Generated visual explanation"
                          className="w-full rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => window.open(message.generatedImageUrl, '_blank')}
                        />
                      </div>
                    )}

                    {message.role === 'assistant' && <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          {speechState.messageId === message.id ? (
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleReadAloud(message.id, message.content)} 
                                disabled={speechState.isLoading}
                              >
                                {speechState.isLoading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Loading...
                                  </>
                                ) : speechState.isPaused ? (
                                  <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Resume
                                  </>
                                ) : (
                                  <>
                                    <Pause className="h-4 w-4 mr-1" />
                                    Pause
                                  </>
                                )}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={stopSpeech}
                                disabled={speechState.isLoading}
                                className="text-destructive hover:text-destructive"
                              >
                                <VolumeX className="h-4 w-4 mr-1" />
                                Stop
                              </Button>
                              {speechState.text && (
                                <div className="text-xs text-muted-foreground">
                                  {Math.round((speechState.position / speechState.text.length) * 100)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleReadAloud(message.id, message.content)} 
                              disabled={isProcessing || speechState.isLoading}
                            >
                              <Volume2 className="h-4 w-4 mr-1" />
                              Read Aloud
                            </Button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const userQuestion = messages.find((msg, index) => 
                                index < messages.indexOf(message) && msg.role === 'user'
                              )?.content || '';
                              handleGenerateImage(message.id, userQuestion, message.content);
                            }}
                            disabled={imageGenerating.has(message.id)}
                          >
                            {imageGenerating.has(message.id) ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <ImageIcon className="h-4 w-4 mr-1" />
                            )}
                            {imageGenerating.has(message.id) ? 'Generating...' : 'Generate Image'}
                          </Button>
                        </div>
                        
                        {isPremium && <Button variant="ghost" size="sm" onClick={generateVideoResponse} className="ml-auto">
                            <Video className="h-4 w-4 mr-1" />
                            Video
                          </Button>}
                      </div>}
                  </div>

                  {message.role === 'user' && <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>}
                </div>)}
              
              {isProcessing && <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  </div>
                </div>}
              
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* Input Area */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="relative">
                  <Textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type your question here or use voice input..." className="min-h-[100px] resize-none" disabled={isProcessing} />
                  
                  {/* File Upload Button */}
                  <div className="absolute bottom-3 right-3">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                        <span>
                          <Paperclip className="h-4 w-4" />
                        </span>
                      </Button>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
                    />
                  </div>
                </div>

                {/* Selected Files Display */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg text-sm">
                        <span className="truncate max-w-[200px]">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant={isRecording ? "destructive" : "outline"} onClick={isRecording ? stopRecording : startRecording} disabled={isProcessing}>
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isRecording ? 'Stop Recording' : 'Voice Input'}
                    </Button>
                    
                    {isRecording && <Badge variant="destructive" className="animate-pulse">
                        Recording...
                      </Badge>}
                  </div>
                  
                  <Button onClick={sendQuestion} disabled={(!inputText.trim() && selectedFiles.length === 0) || isProcessing} className="bg-primary hover:bg-primary/90">
                    {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Question
                  </Button>
                </div>

                {!user && <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Sign in to save your conversation history and access premium features
                    </p>
                  </div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};
export default Questions;