-- Check current policies and fix the conversations RLS issue
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a proper policy that allows users to create conversations
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Also add update policy for group conversations  
CREATE POLICY "Users can update conversations they created"
ON public.conversations
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);