-- Fix function search path security issues by adding proper search_path setting
DROP FUNCTION IF EXISTS public.remove_friend(UUID);
DROP FUNCTION IF EXISTS public.block_user(UUID);

-- Function to remove/block friends with proper security
CREATE OR REPLACE FUNCTION public.remove_friend(friend_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Delete the friend request (this removes the friendship)
  DELETE FROM public.friend_requests
  WHERE status = 'accepted' 
  AND ((sender_id = current_user_id AND receiver_id = friend_id) 
       OR (sender_id = friend_id AND receiver_id = current_user_id));
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Function to block a user with proper security
CREATE OR REPLACE FUNCTION public.block_user(user_id_to_block UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Update existing friend request to blocked status
  UPDATE public.friend_requests
  SET status = 'blocked', blocked_at = now()
  WHERE ((sender_id = current_user_id AND receiver_id = user_id_to_block) 
         OR (sender_id = user_id_to_block AND receiver_id = current_user_id));
  
  -- If no existing request, create a blocked entry
  IF NOT FOUND THEN
    INSERT INTO public.friend_requests (sender_id, receiver_id, status, blocked_at)
    VALUES (current_user_id, user_id_to_block, 'blocked', now());
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';