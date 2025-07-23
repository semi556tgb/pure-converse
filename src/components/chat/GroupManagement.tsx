import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Crown, MoreVertical, UserMinus, Trash2, Users } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  status: string;
  avatar_url?: string;
}

interface Conversation {
  id: string;
  name?: string;
  type: string;
  created_by?: string;
  participants: Profile[];
}

interface GroupManagementProps {
  conversation: Conversation;
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
}

export default function GroupManagement({ conversation, onGroupUpdated, onGroupDeleted }: GroupManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isGroupCreator = user?.id === conversation.created_by;

  const kickMember = async (memberId: string) => {
    if (!user || !isGroupCreator) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('kick_group_member', {
        conversation_id_param: conversation.id,
        member_id_param: memberId
      });

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "Member has been removed from the group"
      });

      onGroupUpdated();
    } catch (error) {
      console.error('Error kicking member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async () => {
    if (!user || !isGroupCreator) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_group_conversation', {
        conversation_id_param: conversation.id
      });

      if (error) throw error;

      toast({
        title: "Group deleted",
        description: "The group has been permanently deleted"
      });

      setDeleteDialogOpen(false);
      setOpen(false);
      onGroupDeleted();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (conversation.type !== 'group') return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Users className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>{conversation.name || 'Group Chat'}</span>
            </DialogTitle>
            <DialogDescription>
              Members — {conversation.participants.length}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {conversation.participants.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded hover:bg-accent"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{member.username}</span>
                    {member.id === conversation.created_by && (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
                
                {isGroupCreator && member.id !== conversation.created_by && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={loading}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => kickMember(member.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Kick from group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
          
          {isGroupCreator && (
            <DialogFooter className="border-t pt-4">
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{conversation.name || 'this group'}"? This action cannot be undone.
              All messages and group data will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteGroup}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}