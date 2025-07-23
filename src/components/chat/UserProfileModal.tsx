import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Calendar, User, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}

interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  status: string;
  created_at: string;
}

export default function UserProfileModal({ userId, isOpen, onClose, onStartChat }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      fetchProfile();
    }
  }, [isOpen, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatJoinDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!profile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center p-8">
            <p className="text-muted-foreground">User not found</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">User Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Avatar and Name */}
          <div className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Status indicator */}
              <div className={`absolute bottom-4 right-0 w-6 h-6 rounded-full border-2 border-background ${getStatusColor(profile.status)}`} />
            </div>
            
            <h3 className="text-xl font-semibold">
              {profile.display_name || profile.username}
            </h3>
            {profile.display_name && (
              <p className="text-muted-foreground">@{profile.username}</p>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="capitalize">
              {profile.status}
            </Badge>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground italic">
                "{profile.bio}"
              </p>
            </div>
          )}

          {/* Profile Info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            
            <div className="flex items-center space-x-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Joined:</span>
              <span className="font-medium">{formatJoinDate(profile.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          {onStartChat && (
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => {
                  onStartChat(userId);
                  onClose();
                }}
                className="flex items-center space-x-2"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Send Message</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}