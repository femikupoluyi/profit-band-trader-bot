
import { supabase } from '@/integrations/supabase/client';

export interface BybitInstrumentInfo {
  symbol: string;
  priceDecimals: number;
  quantityDecimals: number;
  tickSize: string;
  basePrecision: string;
  quotePrecision: string;
  minOrderQty: string;
  maxOrderQty: string;
  minOrderAmt: string;
  maxOrderAmt: string;
}

export class InstrumentInfoFetcher {
  /**
   * Fetch instrument information for a symbol from Bybit
   */
  static async fetchInstrumentInfo(symbol: string): Promise<BybitInstrumentInfo | null> {
    try {
      console.log(`🔍 Fetching instrument info for ${symbol} from Bybit...`);

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
      if (!instrumentList || instrumentList.length === 0) {
        console.error(`❌ No instrument data found for ${symbol}`);
        return null;
      }

      const instrument = instrumentList[0];
      console.log(`📊 Raw instrument data for ${symbol}:`, instrument);

      return this.processInstrumentData(instrument);
    } catch (error) {
      console.error(`❌ Exception fetching instrument info for ${symbol}:`, error);
      return null;
    }
  }

  private static processInstrumentData(instrument: any): BybitInstrumentInfo {
    // Extract decimal places from tickSize and basePrecision
    const priceDecimals = this.getDecimalPlaces(instrument.priceFilter?.tickSize || '0.01');
    const quantityDecimals = this.getDecimalPlaces(instrument.lotSizeFilter?.basePrecision || '0.0001');

    const instrumentInfo: BybitInstrumentInfo = {
      symbol: instrument.symbol,
      priceDecimals,
      quantityDecimals,
      tickSize: instrument.priceFilter?.tickSize || '0.01',
      basePrecision: instrument.lotSizeFilter?.basePrecision || '0.0001',
      quotePrecision: instrument.lotSizeFilter?.quotePrecision || '0.01',
      minOrderQty: instrument.lotSizeFilter?.minOrderQty || '0',
      maxOrderQty: instrument.lotSizeFilter?.maxOrderQty || '999999999',
      minOrderAmt: instrument.lotSizeFilter?.minOrderAmt || '10',
      maxOrderAmt: instrument.lotSizeFilter?.maxOrderAmt || '999999999'
    };

    console.log(`✅ Processed instrument info for ${instrument.symbol}:`, instrumentInfo);
    return instrumentInfo;
  }

  /**
   * Get decimal places from a tick size string (e.g., "0.01" -> 2, "0.0001" -> 4)
   */
  private static getDecimalPlaces(tickSize: string): number {
    try {
      const num = parseFloat(tickSize);
      if (isNaN(num) || num <= 0) {
        console.warn(`Invalid tick size: ${tickSize}, defaulting to 4 decimals`);
        return 4;
      }

      // Convert to string and count decimal places
      const str = num.toString();
      if (str.includes('.')) {
        return str.split('.')[1].length;
      }
      return 0;
    } catch (error) {
      console.error(`Error parsing tick size ${tickSize}:`, error);
      return 4; // Safe default
    }
  }
}
