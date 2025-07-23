-- Add typing status to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS typing_conversation_id UUID;

-- Add user profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create typing status table for better tracking
CREATE TABLE IF NOT EXISTS public.typing_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  is_typing BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS for typing status
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- Create policies for typing status
CREATE POLICY "Users can manage their own typing status"
ON public.typing_status
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view typing status in their conversations"
ON public.typing_status
FOR SELECT
USING (
  conversation_id IN (
    SELECT cp.conversation_id FROM public.conversation_participants cp
    WHERE cp.user_id = auth.uid()
  )
);

-- Enable realtime for typing status
ALTER TABLE public.typing_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;