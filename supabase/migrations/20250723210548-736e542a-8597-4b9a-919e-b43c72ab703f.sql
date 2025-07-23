-- Create a function to safely create group conversations
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  group_name_param TEXT,
  friend_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  conversation_id UUID;
  current_user_id UUID;
  friend_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Validate group name
  IF group_name_param IS NULL OR trim(group_name_param) = '' THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;
  
  -- Validate friend count
  IF array_length(friend_ids, 1) IS NULL OR array_length(friend_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one friend must be selected';
  END IF;
  
  IF array_length(friend_ids, 1) > 5 THEN
    RAISE EXCEPTION 'Maximum 5 friends allowed';
  END IF;
  
  -- Validate all selected users are friends
  FOR friend_id IN SELECT unnest(friend_ids) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.friend_requests 
      WHERE status = 'accepted' 
      AND ((sender_id = current_user_id AND receiver_id = friend_id) 
           OR (sender_id = friend_id AND receiver_id = current_user_id))
    ) THEN
      RAISE EXCEPTION 'Selected user % is not a friend', friend_id;
    END IF;
  END LOOP;
  
  -- Create the group conversation
  INSERT INTO public.conversations (type, name, created_by)
  VALUES ('group', trim(group_name_param), current_user_id)
  RETURNING id INTO conversation_id;
  
  -- Add creator as participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conversation_id, current_user_id);
  
  -- Add all selected friends as participants
  FOR friend_id IN SELECT unnest(friend_ids) LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (conversation_id, friend_id);
  END LOOP;
  
  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;