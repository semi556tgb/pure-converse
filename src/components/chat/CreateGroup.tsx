import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus } from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  display_name?: string;
}

interface CreateGroupProps {
  onGroupCreated: () => void;
}

export default function CreateGroup({ onGroupCreated }: CreateGroupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFriends();
    }
  }, [open, user]);

  const fetchFriends = async () => {
    if (!user) return;

    try {
      // Get accepted friend requests
      const { data: acceptedRequests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) throw error;

      // Get friend IDs
      const friendIds = acceptedRequests?.map(req => 
        req.sender_id === user.id ? req.receiver_id : req.sender_id
      ) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Get friend profiles
      const { data: friendProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      setFriends(friendProfiles || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else if (prev.length < 5) {
        return [...prev, friendId];
      } else {
        toast({
          title: "Maximum reached",
          description: "You can only select up to 5 friends for a group",
          variant: "destructive"
        });
        return prev;
      }
    });
  };

  const createGroup = async () => {
    if (!user || selectedFriends.length === 0 || !groupName.trim()) return;

    setLoading(true);
    
    try {
      console.log('Creating group with user:', user.id);
      console.log('Selected friends:', selectedFriends);
      console.log('Group name:', groupName.trim());
      
      // Use the database function to create group conversation
      const { data: conversationId, error: funcError } = await supabase
        .rpc('create_group_conversation', {
          group_name_param: groupName.trim(),
          friend_ids: selectedFriends
        });

      console.log('Function result:', { conversationId, funcError });
      if (funcError) throw funcError;

      toast({
        title: "Group created",
        description: `Created group "${groupName}" with ${selectedFriends.length} friends`
      });

      setGroupName('');
      setSelectedFriends([]);
      setOpen(false);
      onGroupCreated();
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
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
          <Users className="h-4 w-4" />
          <span>Create Group</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Select up to 5 friends to create a group chat
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Friends ({selectedFriends.length}/5)</Label>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {friends.length === 0 ? (
                <p className="text-sm text-muted-foreground">No friends available</p>
              ) : (
                friends.map((friend) => (
                  <div key={friend.id} className="flex items-center space-x-3 p-2 border rounded">
                    <Checkbox
                      checked={selectedFriends.includes(friend.id)}
                      onCheckedChange={() => toggleFriendSelection(friend.id)}
                      disabled={!selectedFriends.includes(friend.id) && selectedFriends.length >= 5}
                    />
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {friend.display_name || friend.username}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <Button 
            onClick={createGroup}
            disabled={!groupName.trim() || selectedFriends.length === 0 || loading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : `Create Group (${selectedFriends.length} friends)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}