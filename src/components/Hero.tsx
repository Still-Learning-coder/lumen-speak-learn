import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Sparkles, Mic, Users, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { VoiceInterface } from './VoiceInterface';
import heroImage from '@/assets/hero-voice-ai.jpg';

export const Hero: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sampleQuestions = [
    "How does machine learning work?",
    "Explain quantum computing simply",
    "What's the best way to start a business?",
    "How can I improve my productivity?"
  ];

  const features = [
    {
      icon: <Mic className="h-5 w-5" />,
      title: "Voice-First AI",
      description: "Talk naturally, get answers like a human conversation"
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "Visual Explanations",
      description: "See concepts through diagrams, steps, and examples"
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: "Expert Community",
      description: "Connect with verified experts in every field"
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "Instant Responses",
      description: "Real-time AI with human-like understanding"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-white/10 bg-grid-pattern" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
        
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <Badge variant="outline" className="mb-6 bg-background/50 backdrop-blur-sm">
              <Sparkles className="h-3 w-3 mr-1" />
              Chatbots are boring — AskLumen is different
            </Badge>
            
            {/* Main Headline */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              The first AI that{" "}
              <span className="gradient-text">actually talks</span>
              {" "}and shows you answers like a{" "}
              <span className="gradient-text">human</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Ask anything with your voice. Get visual explanations with diagrams, steps, and examples. 
              Connect with expert humans when you need more.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button 
                variant="hero" 
                size="xl" 
                className="group"
                onClick={() => {
                  // Scroll to voice interface or navigate to ask page
                  document.querySelector('.voice-interface')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Ask Anything Now
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              {!user && (
                <Button 
                  variant="glass" 
                  size="xl"
                  onClick={() => navigate('/auth')}
                >
                  Sign Up Free
                </Button>
              )}
            </div>

            {/* Voice Interface Demo */}
            <div className="mb-16 voice-interface">
              <VoiceInterface className="max-w-2xl mx-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Sample Questions */}
      <div className="py-16 bg-background/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Try asking me anything...
            </h2>
            <p className="text-muted-foreground">
              Here are some questions to get you started
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {sampleQuestions.map((question, index) => (
              <Card key={index} className="p-4 glass-effect hover:scale-105 transition-transform cursor-pointer group">
                <p className="text-sm font-medium group-hover:text-primary transition-colors">
                  "{question}"
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Why AskLumen is <span className="gradient-text">revolutionary</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              We're not just another chatbot. We're building the future of human-AI interaction 
              with voice, visuals, and real human expertise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 glass-effect hover:shadow-glow transition-all duration-300 group">
                <div className="text-primary mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Indicators */}
      <div className="py-16 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <Badge variant="outline" className="bg-background/50">
                🔒 Privacy First
              </Badge>
              <Badge variant="outline" className="bg-background/50">
                ⚡ Real-time AI
              </Badge>
              <Badge variant="outline" className="bg-background/50">
                🧠 Expert Verified
              </Badge>
              <Badge variant="outline" className="bg-background/50">
                🌍 Global Community
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};