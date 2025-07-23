import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Reply, MoreVertical, Smile } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MessageReaction {
  id: string;
  emoji: string;
  user_id: string;
  count?: number;
}

interface MessageDisplayProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    reply_to?: string;
    profiles?: {
      username: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  isCurrentUser: boolean;
  onReply?: (message: any) => void;
  onMessageDeleted?: () => void;
  replyToMessage?: any;
}

export default function MessageDisplay({ message, isCurrentUser, onReply, onMessageDeleted, replyToMessage }: MessageDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reactions, setReactions] = useState<MessageReaction[]>([]);

  // Fetch reactions for this message
  useEffect(() => {
    const fetchReactions = async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', message.id);

      if (!error && data) {
        // Group reactions by emoji and count them
        const reactionMap = new Map<string, MessageReaction>();
        data.forEach(reaction => {
          const key = reaction.emoji;
          if (reactionMap.has(key)) {
            const existing = reactionMap.get(key)!;
            existing.count = (existing.count || 1) + 1;
          } else {
            reactionMap.set(key, {
              id: reaction.id,
              emoji: reaction.emoji,
              user_id: reaction.user_id,
              count: 1
            });
          }
        });
        setReactions(Array.from(reactionMap.values()));
      }
    };

    fetchReactions();

    // Listen for reaction changes
    const channel = supabase
      .channel(`message-reactions-${message.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'message_reactions', filter: `message_id=eq.${message.id}` },
        () => fetchReactions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id]);

  const addReaction = async (emoji: string) => {
    try {
      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(r => 
        r.emoji === emoji && 
        r.user_id === user?.id
      );

      if (existingReaction) {
        // Remove reaction if it already exists
        await removeReaction(existingReaction.id);
        return;
      }

      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: message.id,
          user_id: user?.id,
          emoji: emoji
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({
        title: "Error",
        description: "Failed to add reaction",
        variant: "destructive"
      });
    }
  };

  const removeReaction = async (reactionId: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', reactionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing reaction:', error);
      toast({
        title: "Error",
        description: "Failed to remove reaction",
        variant: "destructive"
      });
    }
  };

  const deleteMessage = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id)
        .eq('sender_id', user?.id); // Extra security check

      if (error) throw error;

      toast({
        title: "Message deleted",
        description: "Your message has been deleted"
      });

      onMessageDeleted?.();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group mb-4`}>
      {!isCurrentUser && (
        <Avatar className="w-8 h-8 mr-2 mt-1">
          <AvatarImage src={message.profiles?.avatar_url} />
          <AvatarFallback className="text-xs">
            {message.profiles?.username?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className="flex flex-col max-w-xs lg:max-w-md">
        {/* Reply indicator */}
        {message.reply_to && replyToMessage && (
          <div className={`text-xs text-muted-foreground mb-1 p-2 rounded bg-accent/50 border-l-2 border-primary/50 ${isCurrentUser ? 'ml-auto' : ''}`}>
            <span className="font-medium">Replying to {replyToMessage.profiles?.username}:</span>
            <div className="truncate">{replyToMessage.content?.substring(0, 50)}...</div>
          </div>
        )}
        
        <div
          className={`px-4 py-2 rounded-lg relative ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground ml-auto rounded-br-sm'
              : 'bg-muted text-muted-foreground rounded-bl-sm'
          }`}
        >
          {/* Show username for non-current user messages */}
          {!isCurrentUser && message.profiles && (
            <p className="text-xs font-medium mb-1 opacity-70">
              {message.profiles.display_name || message.profiles.username}
            </p>
          )}
          
          <p className="text-sm break-words">
            {message.content}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs opacity-70">
              {formatMessageTime(message.created_at)}
          </p>
          
          {/* Message Actions */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
            {/* Only show reply button for other users' messages */}
            {onReply && !isCurrentUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onReply(message)}
              >
                <Reply className="h-3 w-3" />
              </Button>
            )}
            
            {/* Emoji reactions - only for other users' messages */}
            {!isCurrentUser && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Smile className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 bg-card border border-border shadow-lg">
                  <div className="grid grid-cols-6 gap-2">
                    {['❤️', '👍', '👎', '😂', '😮', '😢', '😍', '😊', '😎', '🔥', '💯', '🎉', '👏', '🙌', '💪', '😭', '😱', '🤔', '😴', '🥳', '🤗', '😜', '🤨', '😏'].map(emoji => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent"
                        onClick={() => {
                          addReaction(emoji);
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {isCurrentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={deleteMessage}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          </div>
        </div>
        
        {/* Show reactions if any */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((reaction) => {
              const userReacted = reaction.user_id === user?.id;
              return (
                <button
                  key={reaction.id}
                  onClick={() => userReacted ? removeReaction(reaction.id) : addReaction(reaction.emoji)}
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs border transition-colors ${
                    userReacted 
                      ? 'bg-primary/20 border-primary text-primary' 
                      : 'bg-background border-border hover:bg-accent'
                  }`}
                >
                  {reaction.emoji} {reaction.count && reaction.count > 1 ? reaction.count : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {isCurrentUser && (
        <Avatar className="w-8 h-8 ml-2 mt-1">
          <AvatarImage src={message.profiles?.avatar_url} />
          <AvatarFallback className="text-xs">
            {message.profiles?.username?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}