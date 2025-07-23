import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface IncomingCallModalProps {
  call: {
    id: string;
    initiator_id: string;
    conversation_id: string;
    initiator_profile?: {
      username: string;
      avatar_url?: string;
    };
  };
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({ call, onAccept, onDecline }: IncomingCallModalProps) {
  const { user } = useAuth();
  const [ringingAudio, setRingingAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create ringing sound
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmkhCjqEy+rEaB4IJ3vM7+ONOTH+gL7m8Z5HEBI9k9n1tXMlEDaR0+3IdCYJMX3J7+OPPQr+fLzm9qJbFAg+ltfr0HEoCa++5b6hSgUoeb3h7YtaFAhDk8rx1mkgCFqn0vjNdyQCJHbJ8OecEQ2OqejlDJg=';
    audio.loop = true;
    audio.volume = 0.7;
    setRingingAudio(audio);

    // Start playing
    audio.play().catch(console.error);

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const handleAccept = () => {
    ringingAudio?.pause();
    onAccept();
  };

  const handleDecline = async () => {
    ringingAudio?.pause();
    
    // End the call in database
    await supabase
      .from('calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', call.id);

    onDecline();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 text-center min-w-[300px] shadow-xl">
        <div className="mb-4">
          <Avatar className="w-20 h-20 mx-auto mb-4">
            <AvatarImage src={call.initiator_profile?.avatar_url} />
            <AvatarFallback className="text-2xl">
              {call.initiator_profile?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h3 className="text-lg font-semibold mb-1">
            {call.initiator_profile?.username}
          </h3>
          <p className="text-muted-foreground text-sm">Incoming Call...</p>
        </div>

        <div className="flex justify-center space-x-4">
          <Button
            onClick={handleDecline}
            variant="destructive"
            size="lg"
            className="rounded-full w-12 h-12 p-0"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-green-600 hover:bg-green-700 rounded-full w-12 h-12 p-0"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}