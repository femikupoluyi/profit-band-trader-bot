-- Add DELETE policy to allow users to delete their own trading logs
CREATE POLICY "Users can delete their own trading logs" 
ON public.trading_logs 
FOR DELETE 
USING (auth.uid() = user_id);