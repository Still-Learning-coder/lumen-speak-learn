import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInterfaceProps {
  onTranscript?: (text: string) => void;
  onResponse?: (response: string) => void;
  className?: string;
}

interface AudioRecorder {
  start(): Promise<void>;
  stop(): void;
}

class SimpleAudioRecorder implements AudioRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private onDataAvailable: (audioBlob: Blob) => void;

  constructor(onDataAvailable: (audioBlob: Blob) => void) {
    this.onDataAvailable = onDataAvailable;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
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

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.chunks, { type: 'audio/webm' });
        this.onDataAvailable(audioBlob);
        this.chunks = [];
      };

      this.mediaRecorder.start(1000); // Collect data every second
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw error;
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscript,
  onResponse,
  className
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      return true;
    } catch (error) {
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice features.",
        variant: "destructive",
      });
      return false;
    }
  };

  const processAudioData = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64 for transmission
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));

      // Here you would call your STT edge function
      // For now, we'll simulate the response
      const mockTranscript = "How does machine learning work?";
      setTranscript(mockTranscript);
      onTranscript?.(mockTranscript);

      // Simulate AI processing
      setTimeout(() => {
        const mockResponse = "Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task.";
        setResponse(mockResponse);
        onResponse?.(mockResponse);
        
        // Simulate TTS playback
        if (!isMuted) {
          setIsSpeaking(true);
          setTimeout(() => setIsSpeaking(false), 3000);
        }
        
        setIsProcessing(false);
      }, 1500);

    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process audio. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const startListening = async () => {
    if (!permissionGranted) {
      const granted = await requestMicrophonePermission();
      if (!granted) return;
    }

    try {
      recorderRef.current = new SimpleAudioRecorder(processAudioData);
      await recorderRef.current.start();
      setIsListening(true);
      setTranscript('');
      setResponse('');
    } catch (error) {
      console.error('Error starting voice recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopListening = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsListening(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Audio Enabled" : "Audio Muted",
      description: isMuted ? "You will hear AI responses" : "AI responses are muted",
    });
  };

  const getVoiceButtonVariant = () => {
    if (isProcessing) return 'voice';
    if (isListening) return 'voiceListening';
    if (isSpeaking) return 'voiceSpeaking';
    return 'voice';
  };

  const getVoiceButtonIcon = () => {
    if (isProcessing) return <Loader2 className="animate-spin" />;
    if (isListening) return <Mic />;
    return <MicOff />;
  };

  const getStatusText = () => {
    if (isProcessing) return "Processing...";
    if (isListening) return "Listening...";
    if (isSpeaking) return "Speaking...";
    return "Tap to speak";
  };

  return (
    <div className={cn("flex flex-col items-center space-y-6", className)}>
      {/* Voice Button */}
      <div className="relative">
        <Button
          variant={getVoiceButtonVariant()}
          size="voiceLarge"
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing || isSpeaking}
          className="relative"
        >
          {getVoiceButtonIcon()}
        </Button>
        
        {/* Mute Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Status Text */}
      <div className="text-center">
        <Badge variant={isListening ? "default" : "secondary"} className="mb-2">
          {getStatusText()}
        </Badge>
      </div>

      {/* Transcript and Response */}
      {(transcript || response) && (
        <Card className="w-full max-w-2xl p-6 glass-effect">
          {transcript && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Your Question:</h3>
              <p className="text-foreground">{transcript}</p>
            </div>
          )}
          
          {response && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">AI Response:</h3>
              <p className="text-foreground">{response}</p>
            </div>
          )}
        </Card>
      )}

      {/* Usage Hint */}
      {!permissionGranted && (
        <Card className="w-full max-w-md p-4 glass-effect text-center">
          <p className="text-sm text-muted-foreground">
            Click the microphone to start asking questions with your voice
          </p>
        </Card>
      )}
    </div>
  );
};