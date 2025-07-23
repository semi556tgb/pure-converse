-- Add group conversation support
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_description TEXT;

-- Update calls table for better call management
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS call_data JSONB;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS is_group_call BOOLEAN DEFAULT false;

-- Create call participants table
CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_muted BOOLEAN DEFAULT false,
  is_video_enabled BOOLEAN DEFAULT false,
  UNIQUE(call_id, user_id)
);

-- Enable RLS for call participants
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- Create policies for call participants
CREATE POLICY "Users can manage their own call participation"
ON public.call_participants
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view call participants in their conversations"
ON public.call_participants
FOR SELECT
USING (
  call_id IN (
    SELECT c.id FROM public.calls c
    JOIN public.conversation_participants cp ON c.conversation_id = cp.conversation_id
    WHERE cp.user_id = auth.uid()
  )
);

-- Enable realtime for call participants
ALTER TABLE public.call_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;