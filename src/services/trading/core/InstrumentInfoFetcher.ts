
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
   * Fetch instrument information from Bybit API
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
      
      // Parse precision information from Bybit response
      const priceDecimals = this.calculateDecimals(instrument.tickSize || '0.01');
      const quantityDecimals = this.calculateDecimals(instrument.basePrecision || '0.0001');

      const instrumentInfo: BybitInstrumentInfo = {
        symbol: instrument.symbol,
        priceDecimals,
        quantityDecimals,
        minOrderQty: instrument.minOrderQty || '0.0001',
        minOrderAmt: instrument.minOrderAmt || '10',
        tickSize: instrument.tickSize || '0.01',
        basePrecision: instrument.basePrecision || '0.0001'
      };

      console.log(`✅ Fetched instrument info for ${symbol}:`, instrumentInfo);
      return instrumentInfo;
    } catch (error) {
      console.error(`❌ Exception fetching instrument info for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate decimal places from a tick size or precision string
   */
  private static calculateDecimals(value: string): number {
    try {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 4; // Default fallback
      }

      // Count decimal places
      const str = num.toString();
      if (str.indexOf('.') !== -1) {
        return str.split('.')[1].length;
      }
      return 0;
    } catch (error) {
      console.warn(`Error calculating decimals for value ${value}:`, error);
      return 4; // Default fallback
    }
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
