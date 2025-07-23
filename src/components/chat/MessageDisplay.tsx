import { useState, useEffect } from 'react';
import { encryption } from '@/lib/encryption';
import { Button } from '@/components/ui/button';
import { Trash2, Reply, MoreVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageDisplayProps {
  message: {
    id: string;
    content: string;
    encrypted_content?: string;
    encryption_key_id?: string;
    sender_id: string;
    created_at: string;
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
            {onReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onReply(message)}
              >
                <Reply className="h-3 w-3" />
              </Button>
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
    </div>
  );
}