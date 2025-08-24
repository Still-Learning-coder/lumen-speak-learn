import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Plus, MessageCircle, Clock, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Question {
  id: string;
  title: string;
  body: string;
  created_at: string;
  status: string;
  visibility: string;
  tags: string[];
  user_id: string;
  profiles?: {
    display_name: string;
    avatar_url: string;
  };
}

const Questions = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchQuestions();
  }, [activeTab]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('questions')
        .select(`
          *,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `);

      if (activeTab === 'my-questions' && user) {
        query = query.eq('user_id', user.id);
      } else if (activeTab === 'open') {
        query = query.eq('status', 'open');
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const filteredQuestions = questions.filter(question =>
    question.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    question.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    question.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text">Questions</h1>
            <p className="text-muted-foreground mt-2">
              Explore questions from our community or ask your own
            </p>
          </div>
          
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Ask Question
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="all">All Questions</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            {user && <TabsTrigger value="my-questions">My Questions</TabsTrigger>}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Questions List */}
            <div className="space-y-4">
              {loading ? (
                <div className="grid gap-4">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-6 bg-muted rounded mb-4"></div>
                        <div className="h-4 bg-muted rounded mb-2"></div>
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredQuestions.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No questions found</h3>
                    <p className="text-muted-foreground mb-4">
                      Be the first to ask a question in this category!
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Ask the First Question
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredQuestions.map((question) => (
                  <Card key={question.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2 hover:text-primary cursor-pointer">
                            {question.title}
                          </h3>
                          
                          {question.body && (
                            <p className="text-muted-foreground mb-3 line-clamp-2">
                              {question.body}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mb-3">
                            {question.tags?.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(question.created_at).toLocaleDateString()}
                              </div>
                              <span>by {question.profiles?.display_name || 'Anonymous'}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={question.status === 'open' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {question.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {question.visibility}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Questions;