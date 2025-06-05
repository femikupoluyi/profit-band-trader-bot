
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
    console.log(`🔄 MANUAL CLOSE REQUESTED - User: ${userId}, Trade: ${tradeId}`);
    
    try {
      // Enhanced logging at the start
      await this.logDebug(userId, 'MANUAL CLOSE START', `Manual close requested for trade ${tradeId}`, {
        userId,
        tradeId,
        timestamp: new Date().toISOString(),
        action: 'manual_close_init'
      });

      // Check if engine is running, if not create a temporary one
      let engine = this.engines.get(userId);
      let isTemporaryEngine = false;
      
      if (!engine) {
        console.log('🔧 No running engine found, creating temporary engine for manual close');
        await this.logDebug(userId, 'ENGINE CREATION', 'Creating temporary engine for manual close', { tradeId });
        
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (error) {
            console.error('❌ Database error fetching credentials:', error);
            await this.logDebug(userId, 'CREDENTIAL ERROR', `Database error: ${error.message}`, { tradeId, error: error.message });
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('❌ No API credentials found for user:', userId);
            await this.logDebug(userId, 'NO CREDENTIALS', 'No API credentials found', { tradeId });
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          isTemporaryEngine = true;
          console.log('✅ Temporary engine created for manual close');
          await this.logDebug(userId, 'ENGINE CREATED', 'Temporary engine created successfully', { tradeId });
        } catch (error) {
          console.error('❌ Failed to create temporary engine for manual close:', error);
          
          await this.logDebug(userId, 'ENGINE CREATION FAILED', `Failed to create engine: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            tradeId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          throw new Error('Failed to initialize trading engine for manual close');
        }
      } else {
        console.log('✅ Using existing running engine for manual close');
        await this.logDebug(userId, 'USING EXISTING ENGINE', 'Using existing running engine', { tradeId });
      }
      
      // Execute manual close with enhanced logging
      console.log('🔄 EXECUTING MANUAL CLOSE...');
      await this.logDebug(userId, 'EXECUTING CLOSE', 'Starting manual close execution', { tradeId });
      
      await engine.manualClosePosition(tradeId);
      
      console.log('✅ MANUAL CLOSE COMPLETED SUCCESSFULLY');
      await this.logDebug(userId, 'MANUAL CLOSE SUCCESS', 'Manual close completed successfully', { 
        tradeId,
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ MANUAL CLOSE FAILED:', error);
      
      // Enhanced error logging
      await this.logDebug(userId, 'MANUAL CLOSE FAILED', `Manual close failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        tradeId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    console.log('🌅 MANUAL EOD SIMULATION REQUESTED - User:', userId);
    
    try {
      // Enhanced logging at the start
      await this.logDebug(userId, 'EOD SIMULATION START', 'Manual EOD simulation requested', {
        userId,
        timestamp: new Date().toISOString(),
        action: 'eod_simulation_init'
      });
      
      // Check if engine is running, if not create a temporary one for EOD
      let engine = this.engines.get(userId);
      
      if (!engine) {
        console.log('🔧 No running engine found, creating temporary engine for EOD simulation');
        await this.logDebug(userId, 'EOD ENGINE CREATION', 'Creating temporary engine for EOD simulation', {});
        
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (error) {
            console.error('❌ Database error fetching credentials:', error);
            await this.logDebug(userId, 'EOD CREDENTIAL ERROR', `Database error: ${error.message}`, { error: error.message });
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('❌ No API credentials found for user:', userId);
            await this.logDebug(userId, 'EOD NO CREDENTIALS', 'No API credentials found', {});
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          console.log('✅ Temporary engine created for EOD simulation');
          await this.logDebug(userId, 'EOD ENGINE CREATED', 'Temporary engine created successfully for EOD', {});
        } catch (error) {
          console.error('❌ Failed to create temporary engine for EOD:', error);
          
          await this.logDebug(userId, 'EOD ENGINE CREATION FAILED', `Failed to create engine: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          throw new Error('Failed to initialize trading engine for EOD simulation');
        }
      } else {
        console.log('✅ Using existing running engine for EOD simulation');
        await this.logDebug(userId, 'EOD USING EXISTING ENGINE', 'Using existing running engine for EOD', {});
      }
      
      // Execute EOD simulation with enhanced logging
      console.log('🌅 EXECUTING EOD SIMULATION...');
      await this.logDebug(userId, 'EOD EXECUTING', 'Starting EOD simulation execution', {});
      
      await engine.simulateEndOfDay();
      
      console.log('✅ EOD SIMULATION COMPLETED SUCCESSFULLY');
      await this.logDebug(userId, 'EOD SIMULATION SUCCESS', 'Manual EOD simulation completed successfully', {
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ EOD SIMULATION FAILED:', error);
      
      // Enhanced error logging
      await this.logDebug(userId, 'EOD SIMULATION FAILED', `EOD simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  private async logDebug(userId: string, type: string, message: string, data?: any): Promise<void> {
    try {
      console.log(`🔍 DEBUG LOG [${type}]: ${message}`, data);
      
      await supabase
        .from('trading_logs')
        .insert({
          user_id: userId,
          log_type: 'signal_processed',
          message: `[${type}] ${message}`,
          data: {
            debugType: type,
            ...data,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('❌ Failed to log debug message:', error);
    }
  }
}

export const tradingManager = new TradingManager();
