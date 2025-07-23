import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface AddFriendProps {
  onFriendAdded: () => void;
}

export default function AddFriend({ onFriendAdded }: AddFriendProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [usernameToAdd, setUsernameToAdd] = useState('');
  const [loading, setLoading] = useState(false);

  const sendFriendRequest = async () => {
    if (!user || !usernameToAdd.trim()) return;
    
    setLoading(true);
    
    try {
      // Find the user by username
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', usernameToAdd.trim())
        .single();

      if (userError || !targetUser) {
        toast({
          title: "Error",
          description: "User not found. Please check the username.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (targetUser.id === user.id) {
        toast({
          title: "Error",
          description: "You cannot add yourself as a friend.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Check if friend request already exists
      const { data: existingRequest } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${targetUser.id}),and(sender_id.eq.${targetUser.id},receiver_id.eq.${user.id})`)
        .single();

      if (existingRequest) {
        const message = existingRequest.sender_id === user.id 
          ? "Friend request already sent"
          : "This user has already sent you a friend request";
        
        toast({
          title: "Request exists",
          description: message,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // Send friend request
      const { error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: targetUser.id,
          status: 'pending'
        });

      if (requestError) {
        throw requestError;
      }

      toast({
        title: "Success",
        description: `Friend request sent to ${targetUser.username}`
      });

      setUsernameToAdd('');
      setOpen(false);
      onFriendAdded();
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center space-x-2">
          <UserPlus className="h-4 w-4" />
          <span>Add Friend</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>
            Enter a username to send a friend request.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username"
              value={usernameToAdd}
              onChange={(e) => setUsernameToAdd(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  sendFriendRequest();
                }
              }}
            />
          </div>
          <Button 
            onClick={sendFriendRequest} 
            disabled={!usernameToAdd.trim() || loading}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {loading ? 'Sending...' : 'Send Friend Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}