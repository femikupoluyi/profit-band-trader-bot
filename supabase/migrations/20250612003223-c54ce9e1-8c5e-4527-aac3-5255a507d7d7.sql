
-- Add new trading logic configuration columns to trading_configs table
ALTER TABLE public.trading_configs 
ADD COLUMN IF NOT EXISTS trading_logic_type TEXT DEFAULT 'logic1_base',
ADD COLUMN IF NOT EXISTS swing_analysis_bars INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS volume_lookback_periods INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS fibonacci_sensitivity NUMERIC DEFAULT 0.618,
ADD COLUMN IF NOT EXISTS atr_multiplier NUMERIC DEFAULT 1.0;

-- Add constraints to ensure valid values
ALTER TABLE public.trading_configs 
ADD CONSTRAINT check_trading_logic_type 
CHECK (trading_logic_type IN ('logic1_base', 'logic2_data_driven'));

ALTER TABLE public.trading_configs 
ADD CONSTRAINT check_swing_analysis_bars 
CHECK (swing_analysis_bars >= 10 AND swing_analysis_bars <= 200);

ALTER TABLE public.trading_configs 
ADD CONSTRAINT check_volume_lookback_periods 
CHECK (volume_lookback_periods >= 20 AND volume_lookback_periods <= 500);

ALTER TABLE public.trading_configs 
ADD CONSTRAINT check_fibonacci_sensitivity 
CHECK (fibonacci_sensitivity >= 0.1 AND fibonacci_sensitivity <= 1.0);

ALTER TABLE public.trading_configs 
ADD CONSTRAINT check_atr_multiplier 
CHECK (atr_multiplier >= 0.1 AND atr_multiplier <= 5.0);
