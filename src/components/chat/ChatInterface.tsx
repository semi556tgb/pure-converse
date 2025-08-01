import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Phone, Video, Settings, Moon, Sun, Crown } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/hooks/use-toast';
import AddFriend from './AddFriend';
import PendingRequests from './PendingRequests';
import FriendsList from './FriendsList';
import MessageDisplay from './MessageDisplay';
import TypingIndicator from './TypingIndicator';
import UserProfile from './UserProfile';
import CreateGroup from './CreateGroup';
import CallInterface from './CallInterface';
import GroupManagement from './GroupManagement';
import IncomingCallModal from './IncomingCallModal';
import UserProfileModal from './UserProfileModal';

interface Profile {
  id: string;
  username: string;
  status: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to?: string;
  profiles: Profile;
}

interface Conversation {
  id: string;
  name?: string;
  type: string;
  created_by?: string;
  participants: Profile[];
  messages: Message[];
}

export default function ChatInterface() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const MAX_MESSAGE_LENGTH = 2000;
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<string | null>(null);
  const [callNotifications, setCallNotifications] = useState<Array<{
    id: string;
    username: string;
    timestamp: string;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchConversations();
      
      // Set up real-time subscription for new messages
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          () => {
            // Refresh conversations when new message is inserted
            fetchConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calls'
          },
          async (payload) => {
            if (payload.new.status === 'active' && payload.new.initiator_id !== user.id) {
              // Get the initiator's profile for incoming call
              const { data: initiatorProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.new.initiator_id)
                .single();

              if (initiatorProfile) {
                setIncomingCall({
                  ...payload.new,
                  initiator_profile: initiatorProfile
                });
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation, conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const fetchConversations = async () => {
    if (!user) return;

    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations!inner(
          id,
          name,
          group_name,
          type,
          created_by,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (participantError) {
      console.error('Error fetching conversations:', participantError);
      return;
    }

    // For each conversation, get all participants and recent messages
    const conversationsWithDetails = await Promise.all(
      participantData.map(async (item) => {
        const conversationId = item.conversation_id;
        
        // Get all participants
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select(`
            profiles!inner(
              id,
              username,
              status,
              avatar_url
            )
          `)
          .eq('conversation_id', conversationId);

        // Get recent messages with reply info
        const { data: messages } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            sender_id,
            created_at,
            reply_to,
            profiles!inner(
              id,
              username,
              status,
              avatar_url,
              display_name
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(50);

        return {
          id: conversationId,
          name: item.conversations.name || item.conversations.group_name,
          type: item.conversations.type,
          created_by: item.conversations.created_by,
          participants: participants?.map(p => p.profiles) || [],
          messages: messages || []
        };
      })
    );

    setConversations(conversationsWithDetails);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      sender_id: user.id,
      created_at: new Date().toISOString(),
      reply_to: replyingTo?.id,
      profiles: profile || { id: user.id, username: 'You', status: 'online' }
    };

    // Optimistically add message to UI
    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation 
        ? { ...conv, messages: [...conv.messages, tempMessage] }
        : conv
    ));

    const messageText = newMessage.trim();
    setNewMessage('');
    setReplyingTo(null);
    setCharacterCount(0);

    try {
      const messageData: any = {
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: messageText
      };

      // Add reply reference if replying
      if (replyingTo) {
        messageData.reply_to = replyingTo.id;
      }

      const { error } = await supabase
        .from('messages')
        .insert(messageData);

      if (error) throw error;

      // Refresh to get the real message with proper ID
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the optimistic message on error
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation 
          ? { ...conv, messages: conv.messages.filter(m => m.id !== tempMessage.id) }
          : conv
      ));

      setNewMessage(messageText); // Restore message
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
    return otherParticipants.map(p => p.username).join(', ') || 'Empty Chat';
  };

  const startCall = async () => {
    if (!selectedConversation || !user) return;

    try {
      // Create a new call
      const { data: call, error } = await supabase
        .from('calls')
        .insert({
          conversation_id: selectedConversation,
          initiator_id: user.id,
          call_type: 'voice',
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Add current user as participant
      await supabase
        .from('call_participants')
        .insert({
          call_id: call.id,
          user_id: user.id
        });

      setActiveCall(call.id);
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  // Handle typing indicator
  const handleTyping = async () => {
    if (!selectedConversation || !user) return;

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set typing status
    if (!isTyping) {
      setIsTyping(true);
      await supabase
        .from('typing_status')
        .upsert({
          user_id: user.id,
          conversation_id: selectedConversation,
          is_typing: true
        });
    }

    // Set timeout to clear typing status
    const timeout = setTimeout(async () => {
      setIsTyping(false);
      await supabase
        .from('typing_status')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_id', selectedConversation);
    }, 2000);

    setTypingTimeout(timeout);
  };

  const stopTyping = async () => {
    if (!selectedConversation || !user) return;

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    setIsTyping(false);
    await supabase
      .from('typing_status')
      .delete()
      .eq('user_id', user.id)
      .eq('conversation_id', selectedConversation);
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;
    
    // Join the call
    await supabase
      .from('call_participants')
      .insert({
        call_id: incomingCall.id,
        user_id: user.id
      });

    setActiveCall(incomingCall.id);
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    setIncomingCall(null);
  };

  const startChatWithUser = async (userId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('create_friend_conversation', {
        friend_id: userId
      });

      if (error) throw error;

      if (data) {
        fetchConversations();
        setTimeout(() => {
          setSelectedConversation(data);
        }, 100);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-8 w-8" />
              <div>
                <h1 className="font-semibold text-lg">Chat</h1>
                <p className="text-sm text-muted-foreground">
                  {profile?.username || 'Loading...'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Create Conversation Button */}
        <div className="p-4 border-b border-border">
          <div className="flex flex-wrap gap-2">
            <AddFriend onFriendAdded={fetchConversations} />
            <PendingRequests onRequestHandled={fetchConversations} />
            <CreateGroup onGroupCreated={fetchConversations} />
            <UserProfile />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 && (
            <div className="space-y-2 mb-4">
              <h3 className="text-sm font-medium text-foreground px-4 py-2">
                Conversations ({conversations.length})
              </h3>
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`flex items-center space-x-3 p-3 mx-2 rounded-lg hover:bg-accent cursor-pointer ${
                      selectedConversation === conversation.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => setSelectedConversation(conversation.id)}
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {getConversationName(conversation).charAt(0).toUpperCase()}
                      </span>
                    </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center space-x-1">
                         <p className="text-sm font-medium truncate">
                           {getConversationName(conversation)}
                         </p>
                         {conversation.type === 'group' && conversation.created_by === user?.id && (
                           <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                         )}
                       </div>
                        <p className="text-xs text-muted-foreground">
                          {conversation.type === 'group' 
                            ? `${conversation.participants.length} members`
                            : conversation.participants.find(p => p.id !== user?.id)?.username || 'Unknown'
                          }
                       </p>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Friends List */}
          <FriendsList onChatSelected={setSelectedConversation} onConversationCreated={fetchConversations} />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          (() => {
            const conversation = conversations.find(c => c.id === selectedConversation);
            return conversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>
                          {getConversationName(conversation).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-semibold">
                          {getConversationName(conversation)}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {conversation.participants.length} participants
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="icon" onClick={startCall}>
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Video className="h-4 w-4" />
                      </Button>
                      {conversation.type === 'group' && (
                        <GroupManagement
                          conversation={conversation}
                          onGroupUpdated={fetchConversations}
                          onGroupDeleted={() => {
                            setSelectedConversation(null);
                            fetchConversations();
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                  {conversation.messages.map((message) => {
                    const replyToMessage = message.reply_to ? 
                      conversation.messages.find(m => m.id === message.reply_to) : null;
                    return (
                      <MessageDisplay
                        key={message.id}
                        message={message}
                        isCurrentUser={message.sender_id === user?.id}
                        onReply={setReplyingTo}
                        onMessageDeleted={fetchConversations}
                        replyToMessage={replyToMessage}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Typing Indicator */}
                <TypingIndicator conversationId={selectedConversation} />

                {/* Message Input */}
                <div className="p-4 border-t border-border">
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-muted rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-muted-foreground">Replying to:</span>
                          <p className="truncate">{replyingTo.content || '[Encrypted Message]'}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReplyingTo(null)}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= MAX_MESSAGE_LENGTH) {
                          setNewMessage(value);
                          setCharacterCount(value.length);
                          handleTyping();
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          sendMessage();
                          stopTyping();
                        }
                      }}
                      onBlur={stopTyping}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <div className="text-xs text-muted-foreground px-2 self-center">
                      {characterCount}/{MAX_MESSAGE_LENGTH}
                    </div>
                    <Button 
                      onClick={() => {
                        sendMessage();
                        stopTyping();
                      }} 
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : null;
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Chat</h2>
              <p className="text-muted-foreground">
                Select a conversation to start chatting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Call Interface */}
      {activeCall && selectedConversation && (
        <CallInterface
          callId={activeCall}
          conversationId={selectedConversation}
          onEndCall={() => setActiveCall(null)}
        />
      )}

      {/* Call Notifications */}
      {callNotifications.map((notification) => (
        <div
          key={notification.id}
          className="fixed top-4 right-4 z-50 bg-background border border-border rounded-lg p-3 shadow-lg min-w-[250px]"
        >
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">
              {notification.username} started a call.
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {notification.timestamp}
            </span>
          </div>
        </div>
      ))}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* User Profile Modal */}
      {selectedUserProfile && (
        <UserProfileModal
          userId={selectedUserProfile}
          isOpen={!!selectedUserProfile}
          onClose={() => setSelectedUserProfile(null)}
          onStartChat={startChatWithUser}
        />
      )}
    </div>
  );
}