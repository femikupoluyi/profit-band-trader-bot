import { supabase } from '@/integrations/supabase/client';

export type BybitInstrumentInfo = {
  symbol: string;
  priceDecimals: number;
  quantityDecimals: number;
  minOrderQty: string;
  minOrderAmt: string;
  tickSize: string;
  basePrecision: string;
};

export class InstrumentInfoFetcher {
  /**
   * ENHANCED: Fetch instrument information from Bybit API with better validation
   */
  static async fetchInstrumentInfo(symbol: string): Promise<BybitInstrumentInfo | null> {
    try {
      if (!symbol || typeof symbol !== 'string') {
        console.warn('Invalid symbol provided to fetchInstrumentInfo');
        return null;
      }

      console.log(`🔄 Fetching instrument info for ${symbol} from Bybit...`);

      const { data: response, error } = await supabase.functions.invoke('bybit-api', {
        body: {
          endpoint: '/v5/market/instruments-info',
          method: 'GET',
          params: {
            category: 'spot',
            symbol: symbol
          },
          isDemoTrading: true
        }
      });

      if (error) {
        console.error(`❌ Error fetching instrument info for ${symbol}:`, error);
        return null;
      }

      if (response?.retCode !== 0) {
        console.error(`❌ Bybit API error for ${symbol}:`, response?.retMsg);
        return null;
      }

      const instrumentList = response.result?.list;
      if (!instrumentList || !Array.isArray(instrumentList) || instrumentList.length === 0) {
        console.warn(`⚠️ No instrument info found for ${symbol}`);
        return null;
      }

      const instrument = instrumentList[0];
      
      // ENHANCED: Validate instrument data before processing
      if (!instrument.tickSize || !instrument.basePrecision) {
        console.error(`❌ Invalid instrument data for ${symbol}:`, instrument);
        return null;
      }

      // ENHANCED: Use string-based decimal calculation for accuracy
      const priceDecimals = this.calculateDecimalsFromString(instrument.tickSize || '0.01');
      const quantityDecimals = this.calculateDecimalsFromString(instrument.basePrecision || '0.0001');

      const instrumentInfo: BybitInstrumentInfo = {
        symbol: instrument.symbol,
        priceDecimals,
        quantityDecimals,
        minOrderQty: instrument.minOrderQty || '0.0001',
        minOrderAmt: instrument.minOrderAmt || '10',
        tickSize: instrument.tickSize || '0.01',
        basePrecision: instrument.basePrecision || '0.0001'
      };

      console.log(`✅ Fetched and validated instrument info for ${symbol}:`, instrumentInfo);
      
      // ENHANCED: Additional validation
      this.validateInstrumentInfo(instrumentInfo);
      
      return instrumentInfo;
    } catch (error) {
      console.error(`❌ Exception fetching instrument info for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * ENHANCED: Calculate decimal places from precision string using string parsing
   */
  private static calculateDecimalsFromString(value: string): number {
    try {
      // Parse as number first to handle scientific notation
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        console.warn(`Invalid precision value: ${value}, using default 4`);
        return 4;
      }

      // Convert back to string to count decimals
      const str = num.toString();
      if (str.includes('.')) {
        const decimals = str.split('.')[1].length;
        // Cap at reasonable maximum
        return Math.min(decimals, 8);
      }
      return 0;
    } catch (error) {
      console.warn(`Error calculating decimals for value ${value}:`, error);
      return 4; // Safe fallback
    }
  }

  /**
   * ENHANCED: Validate instrument info has required fields
   */
  private static validateInstrumentInfo(info: BybitInstrumentInfo): void {
    const requiredFields = ['symbol', 'tickSize', 'basePrecision', 'minOrderQty', 'minOrderAmt'];
    
    for (const field of requiredFields) {
      if (!info[field as keyof BybitInstrumentInfo]) {
        throw new Error(`Missing required field ${field} in instrument info for ${info.symbol}`);
      }
    }

    // Validate numeric fields can be parsed
    const numericFields = ['tickSize', 'basePrecision', 'minOrderQty', 'minOrderAmt'];
    for (const field of numericFields) {
      const value = parseFloat(info[field as keyof BybitInstrumentInfo] as string);
      if (isNaN(value) || value <= 0) {
        throw new Error(`Invalid numeric value for ${field}: ${info[field as keyof BybitInstrumentInfo]} in ${info.symbol}`);
      }
    }

    console.log(`✅ Instrument info validation passed for ${info.symbol}`);
  }

  /**
   * Batch fetch instrument info for multiple symbols
   */
  static async fetchMultipleInstrumentInfo(symbols: string[]): Promise<Map<string, BybitInstrumentInfo>> {
    const results = new Map<string, BybitInstrumentInfo>();
    
    if (!Array.isArray(symbols)) {
      console.warn('Invalid symbols array provided to fetchMultipleInstrumentInfo');
      return results;
    }
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (symbol) => {
        const info = await this.fetchInstrumentInfo(symbol);
        if (info) {
          results.set(symbol, info);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
}
