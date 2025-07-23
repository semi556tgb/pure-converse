import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, UserPlus } from 'lucide-react';

interface CreateConversationProps {
  onConversationCreated: () => void;
}

export default function CreateConversation({ onConversationCreated }: CreateConversationProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [usernameToAdd, setUsernameToAdd] = useState('');
  const [loading, setLoading] = useState(false);

  const createDirectMessage = async () => {
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

      // Check if conversation already exists between these users
      const { data: existingConversations } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(type)
        `)
        .eq('user_id', user.id);

      if (existingConversations) {
        for (const conv of existingConversations) {
          if (conv.conversations.type === 'direct') {
            // Check if this conversation includes the target user
            const { data: otherParticipants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conv.conversation_id)
              .neq('user_id', user.id);

            if (otherParticipants?.some(p => p.user_id === targetUser.id)) {
              toast({
                title: "Conversation exists",
                description: `You already have a conversation with ${targetUser.username}`,
                variant: "destructive"
              });
              setLoading(false);
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: user.id
        })
        .select()
        .single();

      if (convError) {
        throw convError;
      }

      // Add both users as participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: user.id },
          { conversation_id: conversation.id, user_id: targetUser.id }
        ]);

      if (participantError) {
        throw participantError;
      }

      toast({
        title: "Success",
        description: `Started conversation with ${targetUser.username}`
      });

      setUsernameToAdd('');
      setOpen(false);
      onConversationCreated();
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
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
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Enter a username to start a direct message conversation.
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
                  createDirectMessage();
                }
              }}
            />
          </div>
          <Button 
            onClick={createDirectMessage} 
            disabled={!usernameToAdd.trim() || loading}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Start Conversation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}