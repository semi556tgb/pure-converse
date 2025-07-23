import { useState, useEffect } from 'react';
import { encryption } from '@/lib/encryption';

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
}

export default function MessageDisplay({ message, isCurrentUser }: MessageDisplayProps) {
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

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
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
        <p className="text-xs opacity-70 mt-1">
          {formatMessageTime(message.created_at)}
          {message.encrypted_content && (
            <span className="ml-2">🔒</span>
          )}
        </p>
      </div>
    </div>
  );
}