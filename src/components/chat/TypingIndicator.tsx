import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TypingIndicatorProps {
  conversationId: string;
}

export default function TypingIndicator({ conversationId }: TypingIndicatorProps) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    const fetchTypingStatus = async () => {
      const { data, error } = await supabase
        .from('typing_status')
        .select('user_id, is_typing')
        .eq('conversation_id', conversationId)
        .eq('is_typing', true)
        .neq('user_id', user?.id);

      if (!error && data) {
        // Get usernames separately
        const userIds = data.map(item => item.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', userIds);

          const users = profiles?.map(profile => profile.display_name || profile.username) || [];
          setTypingUsers(users);
        } else {
          setTypingUsers([]);
        }
      }
    };

    fetchTypingStatus();

    // Listen for typing status changes
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'typing_status', filter: `conversation_id=eq.${conversationId}` },
        () => fetchTypingStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  if (typingUsers.length === 0) return null;

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground italic">
      {typingUsers.length === 1 ? (
        <span>{typingUsers[0]} is typing...</span>
      ) : typingUsers.length === 2 ? (
        <span>{typingUsers[0]} and {typingUsers[1]} are typing...</span>
      ) : (
        <span>{typingUsers.slice(0, -1).join(', ')} and {typingUsers[typingUsers.length - 1]} are typing...</span>
      )}
      <span className="ml-2 animate-pulse">●●●</span>
    </div>
  );
}