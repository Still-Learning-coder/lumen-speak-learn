import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Star, MessageCircle, Award, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Expert {
  id: string;
  display_name: string;
  bio: string;
  skills: string[];
  avatar_url: string;
  role: string;
  gamification_xp: number;
  level: number;
}

const Experts = () => {
  const { user, profile } = useAuth();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'expert')
        .order('gamification_xp', { ascending: false });

      if (error) throw error;
      setExperts(data || []);
    } catch (error) {
      console.error('Error fetching experts:', error);
      toast.error('Failed to load experts');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToBeExpert = () => {
    toast.info('Expert application feature coming soon!');
  };

  const filteredExperts = experts.filter(expert =>
    expert.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expert.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expert.skills?.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text">Expert Network</h1>
            <p className="text-muted-foreground mt-2">
              Connect with verified experts in various fields
            </p>
          </div>
          
          {user && profile?.role !== 'expert' && (
            <Button onClick={handleApplyToBeExpert} className="bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" />
              Apply to be Expert
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{experts.length}</p>
                  <p className="text-sm text-muted-foreground">Active Experts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Star className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">4.8</p>
                  <p className="text-sm text-muted-foreground">Avg Rating</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">1.2k</p>
                  <p className="text-sm text-muted-foreground">Questions Answered</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search experts by name, bio, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Experts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))
          ) : filteredExperts.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No experts found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or check back later for new experts.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredExperts.map((expert) => (
              <Card key={expert.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={expert.avatar_url} />
                      <AvatarFallback>
                        {expert.display_name?.charAt(0) || 'E'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold">{expert.display_name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Level {expert.level}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Award className="h-3 w-3" />
                          {expert.gamification_xp} XP
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {expert.bio || 'No bio available'}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {expert.skills?.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {expert.skills?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{expert.skills.length - 3} more
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>4.8</span>
                      <span className="text-muted-foreground">(12 reviews)</span>
                    </div>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Ask
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Experts;