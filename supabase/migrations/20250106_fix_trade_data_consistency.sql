
-- Data correction migration to fix trade entry prices and ensure schema consistency
-- This migration addresses critical data inconsistency issues identified in the audit

-- Step 1: Log the data correction process
DO $$
DECLARE
    fix_count INTEGER := 0;
    trade_record RECORD;
BEGIN
    -- Log start of data correction
    INSERT INTO trading_logs (user_id, log_type, message, data)
    SELECT DISTINCT user_id, 'system_info', 'Starting data correction migration', 
           jsonb_build_object('migration', '20250106_fix_trade_data_consistency', 'timestamp', now())
    FROM trades 
    LIMIT 1;

    -- Fix buy_fill_price where it's NULL but should be set from price
    FOR trade_record IN 
        SELECT id, user_id, symbol, side, price, buy_fill_price, status
        FROM trades 
        WHERE side = 'buy' 
        AND status IN ('filled', 'closed')
        AND (buy_fill_price IS NULL OR buy_fill_price = 0)
    LOOP
        UPDATE trades 
        SET buy_fill_price = trade_record.price,
            updated_at = now()
        WHERE id = trade_record.id;
        
        fix_count := fix_count + 1;
        
        -- Log each fix
        INSERT INTO trading_logs (user_id, log_type, message, data)
        VALUES (
            trade_record.user_id,
            'system_info',
            'Fixed buy_fill_price for trade',
            jsonb_build_object(
                'trade_id', trade_record.id,
                'symbol', trade_record.symbol,
                'old_buy_fill_price', trade_record.buy_fill_price,
                'new_buy_fill_price', trade_record.price,
                'status', trade_record.status
            )
        );
    END LOOP;

    -- Fix buy_order_id where it's NULL but bybit_order_id exists for buy orders
    UPDATE trades 
    SET buy_order_id = bybit_order_id,
        updated_at = now()
    WHERE side = 'buy' 
    AND buy_order_id IS NULL 
    AND bybit_order_id IS NOT NULL;

    -- Set default sell_status for all trades if NULL
    UPDATE trades 
    SET sell_status = 'pending',
        updated_at = now()
    WHERE sell_status IS NULL;

    -- Log completion
    INSERT INTO trading_logs (user_id, log_type, message, data)
    SELECT DISTINCT user_id, 'system_info', 'Data correction migration completed', 
           jsonb_build_object(
               'migration', '20250106_fix_trade_data_consistency',
               'fixes_applied', fix_count,
               'timestamp', now()
           )
    FROM trades 
    LIMIT 1;

    RAISE NOTICE 'Data correction completed. Fixed % trades.', fix_count;
END $$;

-- Step 2: Add indexes for better performance on the new schema fields
CREATE INDEX IF NOT EXISTS idx_trades_buy_fill_price ON trades(buy_fill_price) WHERE buy_fill_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_sell_status ON trades(sell_status);
CREATE INDEX IF NOT EXISTS idx_trades_side_status ON trades(side, status);

-- Step 3: Add a function to validate trade data consistency
CREATE OR REPLACE FUNCTION validate_trade_data_consistency()
RETURNS TABLE (
    issue_type TEXT,
    trade_id UUID,
    symbol TEXT,
    issue_description TEXT
) AS $$
BEGIN
    -- Check for buy trades without buy_fill_price
    RETURN QUERY
    SELECT 
        'missing_buy_fill_price'::TEXT,
        t.id,
        t.symbol,
        'Buy trade missing buy_fill_price'::TEXT
    FROM trades t
    WHERE t.side = 'buy' 
    AND t.status IN ('filled', 'closed')
    AND (t.buy_fill_price IS NULL OR t.buy_fill_price = 0);

    -- Check for trades with inconsistent status and order IDs
    RETURN QUERY
    SELECT 
        'inconsistent_order_data'::TEXT,
        t.id,
        t.symbol,
        'Trade has bybit_order_id but missing buy_order_id'::TEXT
    FROM trades t
    WHERE t.side = 'buy'
    AND t.bybit_order_id IS NOT NULL
    AND t.buy_order_id IS NULL;

    -- Check for trades without sell_status
    RETURN QUERY
    SELECT 
        'missing_sell_status'::TEXT,
        t.id,
        t.symbol,
        'Trade missing sell_status'::TEXT
    FROM trades t
    WHERE t.sell_status IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a function to get properly calculated P&L
CREATE OR REPLACE FUNCTION get_trade_pnl(
    p_trade_id UUID,
    p_current_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    trade_id UUID,
    symbol TEXT,
    should_show_pnl BOOLEAN,
    entry_price NUMERIC,
    current_price NUMERIC,
    spot_pnl NUMERIC,
    spot_percentage NUMERIC
) AS $$
DECLARE
    trade_rec RECORD;
    calc_entry_price NUMERIC;
    calc_current_price NUMERIC;
    calc_spot_pnl NUMERIC;
    calc_spot_percentage NUMERIC;
    should_show BOOLEAN := FALSE;
BEGIN
    -- Get trade record
    SELECT * INTO trade_rec FROM trades WHERE id = p_trade_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Determine if we should show P&L (filled buy with linked TP or closed trade)
    IF trade_rec.status = 'closed' THEN
        should_show := TRUE;
        calc_entry_price := COALESCE(trade_rec.buy_fill_price, trade_rec.price);
        calc_current_price := calc_entry_price; -- For closed trades, use entry price
        calc_spot_pnl := COALESCE(trade_rec.profit_loss, 0);
        calc_spot_percentage := CASE 
            WHEN calc_entry_price > 0 THEN (calc_spot_pnl / (calc_entry_price * trade_rec.quantity)) * 100
            ELSE 0
        END;
    ELSIF trade_rec.side = 'buy' 
          AND trade_rec.status = 'filled' 
          AND trade_rec.sell_order_id IS NOT NULL THEN
        should_show := TRUE;
        calc_entry_price := COALESCE(trade_rec.buy_fill_price, trade_rec.price);
        calc_current_price := COALESCE(p_current_price, calc_entry_price);
        calc_spot_pnl := (calc_current_price - calc_entry_price) * trade_rec.quantity;
        calc_spot_percentage := CASE 
            WHEN calc_entry_price > 0 THEN ((calc_current_price - calc_entry_price) / calc_entry_price) * 100
            ELSE 0
        END;
    ELSE
        calc_entry_price := COALESCE(trade_rec.buy_fill_price, trade_rec.price);
        calc_current_price := COALESCE(p_current_price, calc_entry_price);
        calc_spot_pnl := 0;
        calc_spot_percentage := 0;
    END IF;

    RETURN QUERY SELECT 
        p_trade_id,
        trade_rec.symbol,
        should_show,
        calc_entry_price,
        calc_current_price,
        calc_spot_pnl,
        calc_spot_percentage;
END;
$$ LANGUAGE plpgsql;
