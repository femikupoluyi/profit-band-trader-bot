-- Phase 1: Critical Data Consistency Fixes

-- 1. Clean up stale sell orders (they represent completed trades and should be closed)
UPDATE public.trades 
SET status = 'closed', updated_at = NOW()
WHERE side = 'sell' 
AND status IN ('filled', 'partial_filled', 'pending')
AND user_id IS NOT NULL;

-- 2. Clean up very old pending orders (older than 24 hours)
UPDATE public.trades 
SET status = 'closed', updated_at = NOW()
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '24 hours'
AND user_id IS NOT NULL;

-- 3. Fix any trades with invalid status values
UPDATE public.trades 
SET status = 'closed', updated_at = NOW()
WHERE status NOT IN ('pending', 'filled', 'partial_filled', 'cancelled', 'closed')
AND user_id IS NOT NULL;

-- 4. Clean up trades for symbols not in current trading config
-- This will be handled by application logic to respect current user configurations

-- 5. Add index for better performance on status and symbol queries
CREATE INDEX IF NOT EXISTS idx_trades_user_status_symbol ON public.trades(user_id, status, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_user_side_status ON public.trades(user_id, side, status);

-- 6. Add data validation constraints
ALTER TABLE public.trades 
ADD CONSTRAINT check_valid_status 
CHECK (status IN ('pending', 'filled', 'partial_filled', 'cancelled', 'closed'));

ALTER TABLE public.trades 
ADD CONSTRAINT check_valid_side 
CHECK (side IN ('buy', 'sell'));

ALTER TABLE public.trades 
ADD CONSTRAINT check_positive_price 
CHECK (price > 0);

ALTER TABLE public.trades 
ADD CONSTRAINT check_positive_quantity 
CHECK (quantity > 0);