-- Add group admin functions
CREATE OR REPLACE FUNCTION public.kick_group_member(
  conversation_id_param UUID,
  member_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  is_group_creator BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if current user is the group creator
  SELECT (created_by = current_user_id) INTO is_group_creator
  FROM public.conversations
  WHERE id = conversation_id_param AND type = 'group';
  
  IF NOT is_group_creator THEN
    RAISE EXCEPTION 'Only group creator can kick members';
  END IF;
  
  -- Don't allow kicking the group creator
  IF member_id_param = current_user_id THEN
    RAISE EXCEPTION 'Group creator cannot kick themselves';
  END IF;
  
  -- Remove member from conversation
  DELETE FROM public.conversation_participants
  WHERE conversation_id = conversation_id_param 
  AND user_id = member_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete group (only by creator)
CREATE OR REPLACE FUNCTION public.delete_group_conversation(
  conversation_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  is_group_creator BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  -- Check if current user is the group creator
  SELECT (created_by = current_user_id) INTO is_group_creator
  FROM public.conversations
  WHERE id = conversation_id_param AND type = 'group';
  
  IF NOT is_group_creator THEN
    RAISE EXCEPTION 'Only group creator can delete the group';
  END IF;
  
  -- Delete all participants first (cascading)
  DELETE FROM public.conversation_participants
  WHERE conversation_id = conversation_id_param;
  
  -- Delete all messages in the conversation
  DELETE FROM public.messages
  WHERE conversation_id = conversation_id_param;
  
  -- Delete the conversation
  DELETE FROM public.conversations
  WHERE id = conversation_id_param;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;