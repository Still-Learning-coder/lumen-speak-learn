import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Hero } from '@/components/Hero';
import { ChatBot } from '@/components/ChatBot';
import { UserCheck, LogOut, Settings } from 'lucide-react';

const Index = () => {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleAuthAction = () => {
    if (user) {
      signOut();
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <header className="fixed top-0 w-full z-50 glass-effect border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold gradient-text">AskLumen.ai</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4" />
                  <span>Hi, {profile?.display_name || 'User'}!</span>
                  {profile?.level && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                      Level {profile.level}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleAuthAction}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="hero" size="sm" onClick={handleAuthAction}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        <Hero />
        <ChatBot />
      </main>
    </div>
  );
};

export default Index;
