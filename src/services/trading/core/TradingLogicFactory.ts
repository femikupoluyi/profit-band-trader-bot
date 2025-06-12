
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { SupportLevelAnalyzer } from '../supportLevelAnalyzer';
import { DataDrivenSupportAnalyzer } from './DataDrivenSupportAnalyzer';
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
  analyzeSupportLevels(candles: CandleData[], config: TradingConfigData): SupportLevel[];
  calculateDynamicBounds?(candles: CandleData[], config: TradingConfigData): { lowerBound: number; upperBound: number };
}

export class Logic1BaseSupport implements TradingLogic {
  name = 'Logic 1 - Base Support Detection';
  description = 'Original simple support level detection using price grouping';
  
  private analyzer = new SupportLevelAnalyzer();

  analyzeSupportLevels(candles: CandleData[], config: TradingConfigData): SupportLevel[] {
    console.log('🔧 Using Logic 1 - Base Support Detection');
    
    const result = this.analyzer.identifySupportLevel(candles);
    return result ? [result] : [];
  }
}

export class Logic2DataDriven implements TradingLogic {
  name = 'Logic 2 - Data-Driven Support Analysis';
  description = 'Advanced support detection using swing lows, volume profile, and Fibonacci analysis';
  
  private analyzer = new DataDrivenSupportAnalyzer();

  analyzeSupportLevels(candles: CandleData[], config: TradingConfigData): SupportLevel[] {
    console.log('🔧 Using Logic 2 - Data-Driven Support Analysis');
    
    return this.analyzer.analyzeSupport(candles, config);
  }

  calculateDynamicBounds(candles: CandleData[], config: TradingConfigData): { lowerBound: number; upperBound: number } {
    return this.analyzer.calculateDynamicBounds(candles, config.atr_multiplier);
  }
}

export class TradingLogicFactory {
  // Fix: Properly type the Map to accept both logic types
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
