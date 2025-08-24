import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Settings, Award, Star, MessageCircle, Upload, Crown } from 'lucide-react';
import { toast } from 'sonner';

const Profile = () => {
  const { user, profile, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    skills: profile?.skills?.join(', ') || ''
  });

  const handleSave = async () => {
    try {
      const skillsArray = formData.skills
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

      await updateProfile({
        display_name: formData.display_name,
        bio: formData.bio,
        skills: skillsArray
      });
      
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleCancel = () => {
    setFormData({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      skills: profile?.skills?.join(', ') || ''
    });
    setIsEditing(false);
  };

  const isPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-2xl">
                {profile?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {profile?.display_name || user?.email || 'User'}
                </h1>
                {profile?.role === 'expert' && (
                  <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                    <Star className="h-3 w-3 mr-1" />
                    Expert
                  </Badge>
                )}
                {isPremium && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    <Crown className="h-3 w-3 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  Level {profile?.level || 1}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4" />
                  {profile?.gamification_xp || 0} XP
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {profile?.streak_days || 0} day streak
                </div>
              </div>
              
              <p className="text-muted-foreground mb-4">
                {profile?.bio || 'No bio added yet.'}
              </p>
              
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {isEditing ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Display Name</label>
                      <Input
                        value={formData.display_name}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                        placeholder="Your display name"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Bio</label>
                      <Textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="Tell us about yourself..."
                        rows={4}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Skills</label>
                      <Input
                        value={formData.skills}
                        onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                        placeholder="JavaScript, React, AI, etc. (comma separated)"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button onClick={handleSave}>Save Changes</Button>
                      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Skills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {profile?.skills && profile.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {profile.skills.map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No skills added yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Achievement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Progress to next level</span>
                          <span className="text-sm text-muted-foreground">
                            {profile?.gamification_xp || 0} / {((profile?.level || 1) * 1000)} XP
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(100, ((profile?.gamification_xp || 0) / ((profile?.level || 1) * 1000)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Activity tracking coming soon!</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Advanced settings coming soon!</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">
                          {isPremium ? 'Premium Plan' : 'Free Plan'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {isPremium 
                            ? `Active until ${new Date(profile?.premium_until || '').toLocaleDateString()}`
                            : 'Upgrade to unlock premium features'
                          }
                        </p>
                      </div>
                      <Button variant={isPremium ? 'outline' : 'default'}>
                        {isPremium ? 'Manage' : 'Upgrade'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Profile;