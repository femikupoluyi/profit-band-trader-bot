
-- Add new fields to trades table for take-profit tracking
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS buy_order_id text,
ADD COLUMN IF NOT EXISTS sell_order_id text,
ADD COLUMN IF NOT EXISTS buy_fill_price numeric,
ADD COLUMN IF NOT EXISTS tp_price numeric,
ADD COLUMN IF NOT EXISTS sell_status text DEFAULT 'pending';

-- Add index for better performance when querying by order IDs
CREATE INDEX IF NOT EXISTS idx_trades_buy_order_id ON trades(buy_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_sell_order_id ON trades(sell_order_id);

-- Update existing records to use bybit_order_id as buy_order_id for buy orders
UPDATE trades 
SET buy_order_id = bybit_order_id,
    buy_fill_price = price
WHERE side = 'buy' AND buy_order_id IS NULL;
