-- Fix the create_friend_conversation function
DROP FUNCTION IF EXISTS public.create_friend_conversation(UUID);

CREATE OR REPLACE FUNCTION public.create_friend_conversation(friend_id UUID)
RETURNS UUID AS $$
DECLARE
  conversation_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Validate that both users are friends
  IF NOT EXISTS (
    SELECT 1 FROM public.friend_requests 
    WHERE status = 'accepted' 
    AND ((sender_id = current_user_id AND receiver_id = friend_id) 
         OR (sender_id = friend_id AND receiver_id = current_user_id))
  ) THEN
    RAISE EXCEPTION 'Users are not friends';
  END IF;
  
  -- Check if conversation already exists
  SELECT c.id INTO conversation_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND c.id IN (
      SELECT cp1.conversation_id
      FROM public.conversation_participants cp1
      WHERE cp1.user_id = current_user_id
      INTERSECT
      SELECT cp2.conversation_id
      FROM public.conversation_participants cp2
      WHERE cp2.user_id = friend_id
    );
  
  -- If conversation doesn't exist, create it
  IF conversation_id IS NULL THEN
    INSERT INTO public.conversations (type, created_by)
    VALUES ('direct', current_user_id)
    RETURNING id INTO conversation_id;
    
    -- Add both users as participants
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES 
      (conversation_id, current_user_id),
      (conversation_id, friend_id);
  END IF;
  
  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Add encryption key column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS encrypted_content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS encryption_key_id TEXT;