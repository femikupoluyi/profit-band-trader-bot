
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';
import { DataDrivenSupportAnalyzer } from './DataDrivenSupportAnalyzer';
import { SupportLevelProcessor } from './SupportLevelProcessor';
import { SupportLevel } from './TypeDefinitions';

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface TradingLogic {
  name: string;
  description: string;
  analyzeSupportLevels(candles: CandleData[], config: TradingConfigData, symbol: string): Promise<SupportLevel[]>;
  calculateDynamicBounds?(candles: CandleData[], config: TradingConfigData): { lowerBound: number; upperBound: number };
}

export class Logic1BaseSupport implements TradingLogic {
  name = 'Logic 1 - Base Support Detection';
  description = 'Original simple support level detection using price grouping with Bybit precision';
  
  private analyzer = new SupportLevelAnalyzer();

  async analyzeSupportLevels(candles: CandleData[], config: TradingConfigData, symbol: string): Promise<SupportLevel[]> {
    console.log('🔧 Using Logic 1 - Base Support Detection with Bybit precision');
    
    try {
      const result = this.analyzer.identifySupportLevel(candles);
      if (!result) {
        return [];
      }

      // Format the support level price using Bybit precision
      const formattedPrice = await SupportLevelProcessor.formatSupportLevel(symbol, result.price);
      
      const formattedResult: SupportLevel = {
        ...result,
        price: formattedPrice
      };

      console.log(`✅ Logic 1 formatted support for ${symbol}: ${result.price} → ${formattedPrice}`);
      return [formattedResult];
    } catch (error) {
      console.error(`❌ Error in Logic 1 support analysis for ${symbol}:`, error);
      return [];
    }
  }
}

export class Logic2DataDriven implements TradingLogic {
  name = 'Logic 2 - Data-Driven Support Analysis';
  description = 'Advanced support detection using swing lows, volume profile, and Fibonacci analysis with Bybit precision';
  
  private analyzer = new DataDrivenSupportAnalyzer();

  async analyzeSupportLevels(candles: CandleData[], config: TradingConfigData, symbol: string): Promise<SupportLevel[]> {
    console.log('🔧 Using Logic 2 - Data-Driven Support Analysis with Bybit precision');
    
    try {
      const results = this.analyzer.analyzeSupport(candles, config);
      
      // Format all support level prices using Bybit precision
      const formattedResults: SupportLevel[] = [];
      
      for (const result of results) {
        const formattedPrice = await SupportLevelProcessor.formatSupportLevel(symbol, result.price);
        
        formattedResults.push({
          ...result,
          price: formattedPrice
        });
        
        console.log(`✅ Logic 2 formatted support for ${symbol}: ${result.price} → ${formattedPrice}`);
      }

      return formattedResults;
    } catch (error) {
      console.error(`❌ Error in Logic 2 support analysis for ${symbol}:`, error);
      return [];
    }
  }

  calculateDynamicBounds(candles: CandleData[], config: TradingConfigData): { lowerBound: number; upperBound: number } {
    return this.analyzer.calculateDynamicBounds(candles, config.atr_multiplier);
  }
}

export class TradingLogicFactory {
  private static logics = new Map<string, TradingLogic>();

  static {
    // Initialize the map with instances
    this.logics.set('logic1_base', new Logic1BaseSupport());
    this.logics.set('logic2_data_driven', new Logic2DataDriven());
  }

  static getLogic(logicType: string): TradingLogic {
    const logic = this.logics.get(logicType);
    if (!logic) {
      console.warn(`⚠️ Unknown trading logic type: ${logicType}, falling back to Logic 1`);
      return this.logics.get('logic1_base')!;
    }
    return logic;
  }

  static getAllLogics(): Array<{ key: string; logic: TradingLogic }> {
    return Array.from(this.logics.entries()).map(([key, logic]) => ({ key, logic }));
  }

  static registerLogic(key: string, logic: TradingLogic): void {
    this.logics.set(key, logic);
    console.log(`✅ Registered new trading logic: ${key} - ${logic.name}`);
  }
}
