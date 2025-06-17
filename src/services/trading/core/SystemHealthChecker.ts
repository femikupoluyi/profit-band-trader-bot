
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  isHealthy: boolean;
  issues: string[];
  checks: {
    configuration: boolean;
    bybitConnectivity: boolean;
    databaseConnectivity: boolean;
    marketDataAvailability: boolean;
    instrumentInfo: boolean;
  };
  details: {
    configurationDetails?: any;
    bybitTestResults?: any;
    databaseTestResults?: any;
    marketDataTestResults?: any;
    instrumentTestResults?: any;
  };
}

export class SystemHealthChecker {
  private userId: string;
  private logger: TradingLogger;
  private bybitService: BybitService;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
  }

  async performComprehensiveHealthCheck(config: TradingConfigData): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const checks = {
      configuration: false,
      bybitConnectivity: false,
      databaseConnectivity: false,
      marketDataAvailability: false,
      instrumentInfo: false
    };
    const details: any = {};

    console.log('\n🏥 ===== COMPREHENSIVE SYSTEM HEALTH CHECK =====');
    
    // Check 1: Configuration validation
    console.log('📋 Check 1: Configuration Validation');
    try {
      const configResult = await this.checkConfiguration(config);
      checks.configuration = configResult.isValid;
      details.configurationDetails = configResult;
      
      if (!configResult.isValid) {
        issues.push(...configResult.issues);
        console.log('❌ Configuration check failed:', configResult.issues);
      } else {
        console.log('✅ Configuration validation passed');
      }
    } catch (error) {
      issues.push(`Configuration check error: ${error.message}`);
      console.log('❌ Configuration check error:', error);
    }
    
    // Check 2: Bybit service connectivity
    console.log('🔌 Check 2: Bybit Service Connectivity');
    try {
      const bybitResult = await this.checkBybitConnectivity(config.trading_pairs);
      checks.bybitConnectivity = bybitResult.isConnected;
      details.bybitTestResults = bybitResult;
      
      if (!bybitResult.isConnected) {
        issues.push(...bybitResult.issues);
        console.log('❌ Bybit connectivity check failed:', bybitResult.issues);
      } else {
        console.log('✅ Bybit connectivity check passed');
      }
    } catch (error) {
      issues.push(`Bybit connectivity error: ${error.message}`);
      console.log('❌ Bybit connectivity error:', error);
    }
    
    // Check 3: Database connectivity
    console.log('💾 Check 3: Database Connectivity');
    try {
      const dbResult = await this.checkDatabaseConnectivity();
      checks.databaseConnectivity = dbResult.isConnected;
      details.databaseTestResults = dbResult;
      
      if (!dbResult.isConnected) {
        issues.push(...dbResult.issues);
        console.log('❌ Database connectivity check failed:', dbResult.issues);
      } else {
        console.log('✅ Database connectivity check passed');
      }
    } catch (error) {
      issues.push(`Database connectivity error: ${error.message}`);
      console.log('❌ Database connectivity error:', error);
    }
    
    // Check 4: Market data availability
    console.log('📈 Check 4: Market Data Availability');
    try {
      const marketResult = await this.checkMarketDataAvailability(config.trading_pairs);
      checks.marketDataAvailability = marketResult.isAvailable;
      details.marketDataTestResults = marketResult;
      
      if (!marketResult.isAvailable) {
        issues.push(...marketResult.issues);
        console.log('❌ Market data availability check failed:', marketResult.issues);
      } else {
        console.log('✅ Market data availability check passed');
      }
    } catch (error) {
      issues.push(`Market data availability error: ${error.message}`);
      console.log('❌ Market data availability error:', error);
    }
    
    // Check 5: Instrument information
    console.log('🔧 Check 5: Instrument Information');
    try {
      const instrumentResult = await this.checkInstrumentInfo(config.trading_pairs);
      checks.instrumentInfo = instrumentResult.isAvailable;
      details.instrumentTestResults = instrumentResult;
      
      if (!instrumentResult.isAvailable) {
        issues.push(...instrumentResult.issues);
        console.log('❌ Instrument info check failed:', instrumentResult.issues);
      } else {
        console.log('✅ Instrument info check passed');
      }
    } catch (error) {
      issues.push(`Instrument info error: ${error.message}`);
      console.log('❌ Instrument info error:', error);
    }
    
    const isHealthy = issues.length === 0;
    console.log(`🏥 Overall Health Status: ${isHealthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);
    
    if (!isHealthy) {
      console.log('📋 Issues Summary:', issues);
    }
    
    console.log('===== COMPREHENSIVE SYSTEM HEALTH CHECK COMPLETE =====\n');
    
    const result: HealthCheckResult = {
      isHealthy,
      issues,
      checks,
      details
    };
    
    await this.logger.logSystemInfo('System health check completed', result);
    
    return result;
  }

  private async checkConfiguration(config: TradingConfigData): Promise<{isValid: boolean, issues: string[], details: any}> {
    const issues: string[] = [];
    const details: any = {
      tradingPairs: config.trading_pairs?.length || 0,
      maxOrderAmount: config.max_order_amount_usd,
      takeProfitPercent: config.take_profit_percent,
      isActive: config.is_active,
      tradingLogicType: config.trading_logic_type
    };
    
    if (!config.trading_pairs || config.trading_pairs.length === 0) {
      issues.push('No trading pairs configured');
    }
    if (!config.max_order_amount_usd || config.max_order_amount_usd <= 0) {
      issues.push('Invalid max order amount');
    }
    if (!config.take_profit_percent || config.take_profit_percent <= 0) {
      issues.push('Invalid take profit percentage');
    }
    if (!config.trading_logic_type) {
      issues.push('No trading logic type specified');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      details
    };
  }

  private async checkBybitConnectivity(tradingPairs: string[]): Promise<{isConnected: boolean, issues: string[], results: any[]}> {
    const issues: string[] = [];
    const results: any[] = [];
    const testSymbols = tradingPairs.slice(0, 3); // Test first 3 pairs
    
    for (const symbol of testSymbols) {
      try {
        const marketPrice = await this.bybitService.getMarketPrice(symbol);
        
        if (!marketPrice || !marketPrice.price || marketPrice.price <= 0) {
          issues.push(`Invalid market price for ${symbol}: ${marketPrice?.price}`);
          results.push({ symbol, success: false, price: marketPrice?.price, error: 'Invalid price' });
        } else {
          results.push({ symbol, success: true, price: marketPrice.price });
        }
      } catch (error) {
        issues.push(`Market price fetch failed for ${symbol}: ${error.message}`);
        results.push({ symbol, success: false, error: error.message });
      }
    }
    
    return {
      isConnected: issues.length === 0,
      issues,
      results
    };
  }

  private async checkDatabaseConnectivity(): Promise<{isConnected: boolean, issues: string[], testResults: any}> {
    const issues: string[] = [];
    const testResults: any = {};
    
    try {
      // Test trading_signals table
      const { data: signals, error: signalsError } = await supabase
        .from('trading_signals')
        .select('count')
        .eq('user_id', this.userId)
        .limit(1);
      
      if (signalsError) {
        issues.push(`Trading signals table access failed: ${signalsError.message}`);
        testResults.signals = { success: false, error: signalsError.message };
      } else {
        testResults.signals = { success: true, count: signals?.length || 0 };
      }
      
      // Test trading_logs table
      const { data: logs, error: logsError } = await supabase
        .from('trading_logs')
        .select('count')
        .eq('user_id', this.userId)
        .limit(1);
      
      if (logsError) {
        issues.push(`Trading logs table access failed: ${logsError.message}`);
        testResults.logs = { success: false, error: logsError.message };
      } else {
        testResults.logs = { success: true, count: logs?.length || 0 };
      }
      
      // Test trades table
      const { data: trades, error: tradesError } = await supabase
        .from('trades')
        .select('count')
        .eq('user_id', this.userId)
        .limit(1);
      
      if (tradesError) {
        issues.push(`Trades table access failed: ${tradesError.message}`);
        testResults.trades = { success: false, error: tradesError.message };
      } else {
        testResults.trades = { success: true, count: trades?.length || 0 };
      }
      
    } catch (error) {
      issues.push(`Database connectivity test failed: ${error.message}`);
      testResults.general = { success: false, error: error.message };
    }
    
    return {
      isConnected: issues.length === 0,
      issues,
      testResults
    };
  }

  private async checkMarketDataAvailability(tradingPairs: string[]): Promise<{isAvailable: boolean, issues: string[], results: any[]}> {
    const issues: string[] = [];
    const results: any[] = [];
    const testSymbols = tradingPairs.slice(0, 2); // Test first 2 pairs
    
    for (const symbol of testSymbols) {
      try {
        // Test both current price and historical data if available
        const marketPrice = await this.bybitService.getMarketPrice(symbol);
        
        if (!marketPrice || !marketPrice.price) {
          issues.push(`No market data available for ${symbol}`);
          results.push({ symbol, success: false, error: 'No market data' });
        } else {
          results.push({ 
            symbol, 
            success: true, 
            currentPrice: marketPrice.price,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        issues.push(`Market data fetch failed for ${symbol}: ${error.message}`);
        results.push({ symbol, success: false, error: error.message });
      }
    }
    
    return {
      isAvailable: issues.length === 0,
      issues,
      results
    };
  }

  private async checkInstrumentInfo(tradingPairs: string[]): Promise<{isAvailable: boolean, issues: string[], results: any[]}> {
    const issues: string[] = [];
    const results: any[] = [];
    const testSymbols = tradingPairs.slice(0, 2); // Test first 2 pairs
    
    for (const symbol of testSymbols) {
      try {
        // Import here to avoid circular dependency
        const { BybitInstrumentService } = await import('./BybitInstrumentService');
        const instrumentInfo = await BybitInstrumentService.getInstrumentInfo(symbol);
        
        if (!instrumentInfo) {
          issues.push(`No instrument info available for ${symbol}`);
          results.push({ symbol, success: false, error: 'No instrument info' });
        } else {
          results.push({ 
            symbol, 
            success: true, 
            tickSize: instrumentInfo.tickSize,
            basePrecision: instrumentInfo.basePrecision,
            minOrderQty: instrumentInfo.minOrderQty,
            minOrderAmt: instrumentInfo.minOrderAmt
          });
        }
      } catch (error) {
        issues.push(`Instrument info fetch failed for ${symbol}: ${error.message}`);
        results.push({ symbol, success: false, error: error.message });
      }
    }
    
    return {
      isAvailable: issues.length === 0,
      issues,
      results
    };
  }
}
