-- Fix search path for security
ALTER FUNCTION public.user_is_conversation_participant(UUID, UUID) SET search_path TO '';
ALTER FUNCTION public.create_friend_conversation(UUID) SET search_path TO '';