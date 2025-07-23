-- Drop existing problematic policies and recreate with correct syntax
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;

-- Recreate with correct policy name
CREATE POLICY "Users can view their conversation participants"
ON public.conversations
FOR SELECT
USING (
  id IN (
    SELECT conversation_id 
    FROM public.conversation_participants 
    WHERE user_id = auth.uid()
  )
);