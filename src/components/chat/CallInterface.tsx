import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Settings,
  Users,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallParticipant {
  id: string;
  user_id: string;
  is_muted: boolean;
  is_video_enabled: boolean;
  profiles?: {
    username: string;
    display_name?: string;
  };
}

interface CallInterfaceProps {
  callId: string;
  conversationId: string;
  onEndCall: () => void;
}

export default function CallInterface({ callId, conversationId, onEndCall }: CallInterfaceProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    initializeCall();
    fetchParticipants();
    
    // Listen for participant changes
    const channel = supabase
      .channel(`call-${callId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'call_participants', filter: `call_id=eq.${callId}` },
        () => fetchParticipants()
      )
      .subscribe();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      supabase.removeChannel(channel);
    };
  }, [callId]);

  const initializeCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoEnabled
      });
      
      setLocalStream(stream);
      if (localVideoRef.current && isVideoEnabled) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from('call_participants')
        .select('*')
        .eq('call_id', callId)
        .is('left_at', null);

      if (!error && participantsData) {
        // Get user profiles separately
        const userIds = participantsData.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', userIds);

        const participantsWithProfiles = participantsData.map(participant => ({
          ...participant,
          profiles: profiles?.find(p => p.id === participant.user_id)
        }));

        setParticipants(participantsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const toggleMute = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        
        // Update in database
        await supabase
          .from('call_participants')
          .update({ is_muted: !isMuted })
          .eq('call_id', callId)
          .eq('user_id', user?.id);
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        
        // Update in database
        await supabase
          .from('call_participants')
          .update({ is_video_enabled: !isVideoEnabled })
          .eq('call_id', callId)
          .eq('user_id', user?.id);
      }
    }
  };

  const endCall = async () => {
    try {
      // Mark participant as left
      await supabase
        .from('call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', callId)
        .eq('user_id', user?.id);

      // Update call status if last participant
      const activeParticipants = participants.filter(p => p.user_id !== user?.id);
      if (activeParticipants.length === 0) {
        await supabase
          .from('calls')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString()
          })
          .eq('id', callId);
      }

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      onEndCall();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-background border border-border rounded-lg p-4 shadow-lg min-w-[300px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Phone className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Call in progress</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(false)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </div>
            <div className="flex space-x-2">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="sm"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={endCall}
              >
                <PhoneOff className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onEndCall}>
      <DialogContent className="max-w-4xl h-[600px] p-0 bg-gray-900 text-white border-gray-700">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Voice Connected</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Participants Grid */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-full">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="relative bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center"
                >
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-3">
                    <span className="text-lg font-bold text-white">
                      {(participant.profiles?.display_name || participant.profiles?.username || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {participant.profiles?.display_name || participant.profiles?.username || 'User'}
                    </p>
                    <div className="flex items-center justify-center space-x-1 mt-1">
                      {participant.is_muted && (
                        <MicOff className="h-3 w-3 text-red-500" />
                      )}
                      {!participant.is_video_enabled && (
                        <VideoOff className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 p-6 border-t border-gray-700">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="lg"
              onClick={toggleMute}
              className="w-12 h-12 rounded-full"
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            
            <Button
              variant={isVideoEnabled ? "secondary" : "outline"}
              size="lg"
              onClick={toggleVideo}
              className="w-12 h-12 rounded-full"
            >
              {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-12 h-12 rounded-full"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Hidden video element for local stream */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}