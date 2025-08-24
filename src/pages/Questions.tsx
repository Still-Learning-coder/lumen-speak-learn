import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Mic, 
  MicOff, 
  Send, 
  Bot, 
  User, 
  Volume2, 
  VolumeX, 
  Play,
  Pause,
  Video,
  Crown,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  audioUrl?: string;
  isPlaying?: boolean;
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
          noiseSuppression: true,
        }
      });
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.chunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
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
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
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
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  const recorderRef = useRef<AudioRecorder | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptionError) {
        throw new Error(transcriptionError.message);
      }

      const transcribedText = transcriptionData.text;
      if (transcribedText.trim()) {
        setInputText(transcribedText);
        toast.success('Voice converted to text!');
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

  const sendQuestion = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = inputText.trim();
    setInputText('');
    setIsProcessing(true);

    try {
      // Get AI response
      const { data: responseData, error: responseError } = await supabase.functions.invoke('chat-completion', {
        body: {
          message: currentQuestion,
          conversationHistory: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }
      });

      if (responseError) {
        throw new Error(responseError.message);
      }

      const assistantResponse = responseData.response;

      // Generate audio for the response if not muted
      let audioUrl = '';
      if (!isMuted) {
        try {
          const { data: audioData, error: audioError } = await supabase.functions.invoke('text-to-speech', {
            body: { 
              text: assistantResponse,
              voice: 'alloy' 
            }
          });

          if (!audioError && audioData.audioContent) {
            audioUrl = `data:audio/mp3;base64,${audioData.audioContent}`;
          }
        } catch (audioError) {
          console.error('Audio generation failed:', audioError);
          // Continue without audio
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: assistantResponse,
        role: 'assistant',
        timestamp: new Date(),
        audioUrl: audioUrl,
        isPlaying: false
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Auto-play audio if available and not muted
      if (audioUrl && !isMuted) {
        setTimeout(() => playAudio(assistantMessage.id, audioUrl), 500);
      }

    } catch (error) {
      console.error('Error getting response:', error);
      toast.error('Failed to get response. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
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
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isPlaying: true }
        : { ...msg, isPlaying: false }
    ));

    audio.onended = () => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isPlaying: false }
          : msg
      ));
      setCurrentAudio(null);
    };

    audio.onerror = () => {
      toast.error('Failed to play audio');
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isPlaying: false }
          : msg
      ));
      setCurrentAudio(null);
    };

    audio.play();
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  const generateVideoResponse = () => {
    if (!isPremium) {
      toast.error('Video responses are only available for Premium users');
      return;
    }
    toast.info('Video response generation coming soon!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  {isPremium && (
                    <Badge className="bg-yellow-500/10 text-yellow-500">
                      <Crown className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Start by asking a question using voice or text!
                  </p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={`max-w-[80%] p-4 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    
                    {message.role === 'assistant' && message.audioUrl && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => 
                            message.isPlaying 
                              ? stopAudio() 
                              : playAudio(message.id, message.audioUrl!)
                          }
                        >
                          {message.isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {message.isPlaying ? 'Playing...' : 'Play Audio'}
                        </span>
                        
                        {isPremium && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={generateVideoResponse}
                            className="ml-auto"
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Video
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex gap-3 justify-start">
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
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </CardContent>
          </Card>

          {/* Input Area */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your question here or use voice input..."
                  className="min-h-[100px] resize-none"
                  disabled={isProcessing}
                />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isRecording ? "destructive" : "outline"}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                      {isRecording ? 'Stop Recording' : 'Voice Input'}
                    </Button>
                    
                    {isRecording && (
                      <Badge variant="destructive" className="animate-pulse">
                        Recording...
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    onClick={sendQuestion}
                    disabled={!inputText.trim() || isProcessing}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Question
                  </Button>
                </div>

                {!user && (
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Sign in to save your conversation history and access premium features
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Questions;