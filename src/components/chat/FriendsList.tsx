import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Users, UserMinus, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Friend {
  id: string;
  username: string;
}

interface FriendsListProps {
  onChatSelected: (conversationId: string) => void;
  onConversationCreated: () => void;
}

export default function FriendsList({ onChatSelected, onConversationCreated }: FriendsListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFriends = async () => {
    if (!user) return;

    try {
      // Get accepted friend requests where I'm either sender or receiver
      const { data: acceptedRequests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) throw error;

      // Get friend IDs (the other person in each request)
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
        .select('id, username')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      setFriends(friendProfiles || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [user]);

  const startChatWithFriend = async (friendId: string) => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Use the database function to create/get conversation
      const { data, error } = await supabase.rpc('create_friend_conversation', {
        friend_id: friendId
      });

      if (error) throw error;

      const conversationId = data;
      if (conversationId) {
        // First refresh conversations list, then select the conversation
        onConversationCreated();
        setTimeout(() => {
          onChatSelected(conversationId);
        }, 100);
        
        toast({
          title: "Chat opened",
          description: "You can now start chatting!"
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async (friendId: string, friendUsername: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase.rpc('remove_friend', {
        friend_id: friendId
      });

      if (error) throw error;

      toast({
        title: "Friend removed",
        description: `${friendUsername} has been removed from your friends list`
      });
      
      fetchFriends();
    } catch (error) {
      console.error('Error removing friend:', error);
      toast({
        title: "Error",
        description: "Failed to remove friend",
        variant: "destructive"
      });
    }
  };

  const blockUser = async (userId: string, username: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase.rpc('block_user', {
        user_id_to_block: userId
      });

      if (error) throw error;

      toast({
        title: "User blocked",
        description: `${username} has been blocked`
      });
      
      fetchFriends();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive"
      });
    }
  };

  if (friends.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No friends yet</p>
        <p className="text-xs">Add friends to start chatting!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground px-4 py-2">
        Friends ({friends.length})
      </h3>
      <div className="space-y-1">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="flex items-center justify-between p-3 mx-2 rounded-lg hover:bg-accent group"
          >
            <div 
              className="flex items-center space-x-3 flex-1 cursor-pointer"
              onClick={() => startChatWithFriend(friend.id)}
            >
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {friend.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium">{friend.username}</span>
            </div>
            
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={() => startChatWithFriend(friend.id)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border border-border">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFriend(friend.id, friend.username);
                    }}
                    className="text-orange-600 focus:text-orange-600"
                  >
                    <UserMinus className="h-3 w-3 mr-2" />
                    Remove Friend
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      blockUser(friend.id, friend.username);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX className="h-3 w-3 mr-2" />
                    Block User
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}