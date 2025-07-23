import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, Users } from 'lucide-react';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: {
    username: string;
  };
  receiver?: {
    username: string;
  };
}

interface PendingRequestsProps {
  onRequestHandled: () => void;
}

export default function PendingRequests({ onRequestHandled }: PendingRequestsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      // Get friend requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Get user profiles for the requests
      const userIds = new Set<string>();
      requestsData?.forEach(req => {
        userIds.add(req.sender_id);
        userIds.add(req.receiver_id);
      });

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', Array.from(userIds));

      if (profilesError) throw profilesError;

      // Combine the data
      const requestsWithProfiles = requestsData?.map(req => ({
        ...req,
        sender: profilesData?.find(p => p.id === req.sender_id),
        receiver: profilesData?.find(p => p.id === req.receiver_id)
      })) || [];

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open, user]);

  const handleRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Friend request ${action}ed`
      });

      fetchRequests();
      onRequestHandled();
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to handle friend request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const pendingReceivedRequests = requests.filter(r => 
    r.receiver_id === user?.id && r.status === 'pending'
  );
  
  const pendingSentRequests = requests.filter(r => 
    r.sender_id === user?.id && r.status === 'pending'
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Users className="h-4 w-4 mr-2" />
          <span>Requests</span>
          {pendingReceivedRequests.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {pendingReceivedRequests.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Friend Requests</DialogTitle>
          <DialogDescription>
            Manage your pending friend requests.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Received Requests */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Received ({pendingReceivedRequests.length})
            </h3>
            <div className="space-y-2">
              {pendingReceivedRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests</p>
              ) : (
                pendingReceivedRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {request.sender?.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{request.sender?.username}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleRequest(request.id, 'accept')}
                        disabled={loading}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleRequest(request.id, 'reject')}
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sent Requests */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">
              Sent ({pendingSentRequests.length})
            </h3>
            <div className="space-y-2">
              {pendingSentRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests</p>
              ) : (
                pendingSentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {request.receiver?.username?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{request.receiver?.username}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Pending</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}