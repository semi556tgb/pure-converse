import { useState, useEffect } from 'react';
import { encryption } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
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
    encrypted_content?: string;
    encryption_key_id?: string;
    sender_id: string;
    created_at: string;
    reply_to?: string;
  };
  isCurrentUser: boolean;
  onReply?: (message: any) => void;
  onMessageDeleted?: () => void;
}

export default function MessageDisplay({ message, isCurrentUser, onReply, onMessageDeleted }: MessageDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);

  useEffect(() => {
    const decryptMessage = async () => {
      if (message.encrypted_content && message.encryption_key_id) {
        setIsDecrypting(true);
        try {
          const decrypted = await encryption.decryptMessage(
            message.encrypted_content,
            message.encryption_key_id
          );
          setDecryptedContent(decrypted);
        } catch (error) {
          console.error('Failed to decrypt message:', error);
          setDecryptedContent('[Unable to decrypt message]');
        } finally {
          setIsDecrypting(false);
        }
      } else {
        setDecryptedContent(message.content);
      }
    };

    decryptMessage();
  }, [message]);

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
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
          isCurrentUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <p className="text-sm">
          {isDecrypting ? (
            <span className="opacity-50">🔒 Decrypting...</span>
          ) : (
            decryptedContent
          )}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs opacity-70">
            {formatMessageTime(message.created_at)}
            {message.encrypted_content && (
              <span className="ml-2">🔒</span>
            )}
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
                <PopoverContent className="w-auto p-2">
                  <div className="flex space-x-2">
                    {['❤️', '👍', '👎', '😂', '😮', '😢'].map(emoji => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => addReaction(emoji)}
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
        
        {/* Show reactions if any */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {reactions.map((reaction) => (
              <span
                key={reaction.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-background border"
              >
                {reaction.emoji} {reaction.count && reaction.count > 1 ? reaction.count : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}