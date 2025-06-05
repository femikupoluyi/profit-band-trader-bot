
import { MainTradingEngine } from './trading/core/MainTradingEngine';
import { BybitService } from './bybitService';
import { supabase } from '@/integrations/supabase/client';

class TradingManager {
  private engines: Map<string, MainTradingEngine> = new Map();

  async startTradingForUser(userId: string): Promise<void> {
    try {
      console.log(`Starting trading for user: ${userId}`);
      
      // Stop existing engine if running
      if (this.engines.has(userId)) {
        await this.stopTradingForUser(userId);
      }

      // Get user's API credentials with better error handling
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Database error fetching credentials:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!credentials) {
        console.error('No API credentials found for user:', userId);
        throw new Error('User API credentials not found. Please configure your API keys first.');
      }

      if (!credentials.api_key || !credentials.api_secret) {
        console.error('Incomplete API credentials for user:', userId);
        throw new Error('API credentials are incomplete. Please check your API key and secret.');
      }

      console.log(`Creating BybitService for user ${userId} with demo trading: ${credentials.testnet || true}`);

      // Create and initialize new engine
      const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
      const engine = new MainTradingEngine(userId, bybitService);
      
      await engine.initialize();
      await engine.start();
      
      this.engines.set(userId, engine);
      
      console.log(`Trading started successfully for user: ${userId}`);
    } catch (error) {
      console.error(`Failed to start trading for user ${userId}:`, error);
      
      // Log to database
      try {
        await supabase
          .from('trading_logs')
          .insert({
            user_id: userId,
            log_type: 'system_error',
            message: `Failed to start trading engine: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
      } catch (logError) {
        console.error('Failed to log trading start error:', logError);
      }
      
      throw error;
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    try {
      const engine = this.engines.get(userId);
      if (engine) {
        await engine.stop();
        this.engines.delete(userId);
        console.log(`Trading stopped for user: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to stop trading for user ${userId}:`, error);
      throw error;
    }
  }

  async restartTradingForUser(userId: string): Promise<void> {
    await this.stopTradingForUser(userId);
    await this.startTradingForUser(userId);
  }

  isRunningForUser(userId: string): boolean {
    const engine = this.engines.get(userId);
    return engine ? engine.isEngineRunning() : false;
  }

  getEngineForUser(userId: string): MainTradingEngine | undefined {
    return this.engines.get(userId);
  }

  async manualClosePosition(userId: string, tradeId: string): Promise<void> {
    console.log(`🔄 Manual close requested for user ${userId}, trade ${tradeId}`);
    
    try {
      // Check if engine is running, if not create a temporary one
      let engine = this.engines.get(userId);
      let isTemporaryEngine = false;
      
      if (!engine) {
        console.log('No running engine found, creating temporary engine for manual close');
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (error) {
            console.error('Database error fetching credentials:', error);
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('No API credentials found for user:', userId);
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          isTemporaryEngine = true;
          console.log('✅ Temporary engine created for manual close');
        } catch (error) {
          console.error('Failed to create temporary engine for manual close:', error);
          
          // Log to database
          await supabase
            .from('trading_logs')
            .insert({
              user_id: userId,
              log_type: 'system_error',
              message: `Failed to create engine for manual close: ${error instanceof Error ? error.message : 'Unknown error'}`,
              data: { tradeId, error: error instanceof Error ? error.message : 'Unknown error' }
            });
          
          throw new Error('Failed to initialize trading engine for manual close');
        }
      }
      
      // Execute manual close
      console.log('🔄 Executing manual close...');
      await engine.manualClosePosition(tradeId);
      console.log('✅ Manual close completed successfully');
      
      // Log success
      await supabase
        .from('trading_logs')
        .insert({
          user_id: userId,
          log_type: 'position_closed',
          message: `Manual close completed successfully for trade ${tradeId}`,
          data: { tradeId, method: 'manual_close' }
        });
      
    } catch (error) {
      console.error('❌ Manual close failed:', error);
      
      // Log error to database
      try {
        await supabase
          .from('trading_logs')
          .insert({
            user_id: userId,
            log_type: 'system_error',
            message: `Manual close failed for trade ${tradeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: { tradeId, error: error instanceof Error ? error.message : 'Unknown error' }
          });
      } catch (logError) {
        console.error('Failed to log manual close error:', logError);
      }
      
      throw error;
    }
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    console.log('🌅 Manual EOD simulation requested for user:', userId);
    
    try {
      // Always log the start of simulation
      await supabase
        .from('trading_logs')
        .insert({
          user_id: userId,
          log_type: 'signal_processed',
          message: 'Manual EOD simulation started',
          data: { simulationType: 'manual_eod', timestamp: new Date().toISOString() }
        });
      
      // Check if engine is running, if not create a temporary one for EOD
      let engine = this.engines.get(userId);
      let isTemporaryEngine = false;
      
      if (!engine) {
        console.log('No running engine found, creating temporary engine for EOD simulation');
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (error) {
            console.error('Database error fetching credentials:', error);
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('No API credentials found for user:', userId);
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          isTemporaryEngine = true;
          console.log('✅ Temporary engine created for EOD simulation');
        } catch (error) {
          console.error('Failed to create temporary engine for EOD:', error);
          
          // Log error to database
          await supabase
            .from('trading_logs')
            .insert({
              user_id: userId,
              log_type: 'system_error',
              message: `Failed to create engine for EOD simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
              data: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
          
          throw new Error('Failed to initialize trading engine for EOD simulation');
        }
      }
      
      // Execute EOD simulation
      console.log('🌅 Executing EOD simulation...');
      await engine.simulateEndOfDay();
      console.log('✅ EOD simulation completed successfully');
      
      // Log success
      await supabase
        .from('trading_logs')
        .insert({
          user_id: userId,
          log_type: 'position_closed',
          message: 'Manual EOD simulation completed successfully',
          data: { simulationType: 'manual_eod_completed', timestamp: new Date().toISOString() }
        });
      
    } catch (error) {
      console.error('❌ EOD simulation failed:', error);
      
      // Log error to database
      try {
        await supabase
          .from('trading_logs')
          .insert({
            user_id: userId,
            log_type: 'system_error',
            message: `EOD simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
      } catch (logError) {
        console.error('Failed to log EOD simulation error:', logError);
      }
      
      throw error;
    }
  }
}

export const tradingManager = new TradingManager();
