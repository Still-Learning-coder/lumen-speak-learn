import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  MessageCircle, 
  Award, 
  Settings, 
  BarChart3, 
  UserCheck,
  UserX,
  Star,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalUsers: number;
  totalQuestions: number;
  totalAnswers: number;
  pendingApplications: number;
}

const Admin = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalQuestions: 0,
    totalAnswers: 0,
    pendingApplications: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin
    if (!user || profile?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      navigate('/');
      return;
    }

    fetchDashboardData();
  }, [user, profile, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch various statistics
      const [usersData, questionsData, answersData, applicationsData] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('answers').select('id', { count: 'exact' }),
        supabase.from('expert_applications').select('id', { count: 'exact' }).eq('status', 'pending')
      ]);

      setStats({
        totalUsers: usersData.count || 0,
        totalQuestions: questionsData.count || 0,
        totalAnswers: answersData.count || 0,
        pendingApplications: applicationsData.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin') {
    return null; // This will be handled by useEffect redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage users, content, and platform settings
            </p>
          </div>
          <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
            <Settings className="h-3 w-3 mr-1" />
            Admin Access
          </Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? '...' : stats.totalUsers}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? '...' : stats.totalQuestions}
                  </p>
                  <p className="text-sm text-muted-foreground">Questions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Star className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? '...' : stats.totalAnswers}
                  </p>
                  <p className="text-sm text-muted-foreground">Answers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? '...' : stats.pendingApplications}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Reviews</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="experts">Expert Apps</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-muted-foreground">
                      Manage user accounts, roles, and permissions
                    </p>
                    <Button variant="outline">
                      View All Users
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Quick Actions</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button variant="outline" size="sm">
                        <UserCheck className="h-4 w-4 mr-2" />
                        Promote User
                      </Button>
                      <Button variant="outline" size="sm">
                        <UserX className="h-4 w-4 mr-2" />
                        Suspend User
                      </Button>
                      <Button variant="outline" size="sm">
                        <Award className="h-4 w-4 mr-2" />
                        Award Badge
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Bulk Actions
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Content Moderation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Review and moderate questions, answers, and user-generated content
                </p>
                <div className="mt-4">
                  <Button variant="outline">
                    View Flagged Content
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="experts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Expert Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Review and approve expert applications
                  </p>
                  
                  {stats.pendingApplications > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <span className="font-semibold text-orange-700">
                          {stats.pendingApplications} applications pending review
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <Button variant="outline">
                    Review Applications
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Platform Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  View detailed analytics and insights about platform usage
                </p>
                <div className="mt-4">
                  <Button variant="outline">
                    View Full Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Configure platform-wide settings and features
                </p>
                <div className="mt-4">
                  <Button variant="outline">
                    Configure Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;