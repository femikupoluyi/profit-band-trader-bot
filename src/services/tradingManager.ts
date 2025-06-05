
import { MainTradingEngine } from './trading/core/MainTradingEngine';
import { BybitService } from './bybitService';
import { supabase } from '@/integrations/supabase/client';
import { TradingLogger } from './trading/core/TradingLogger';

class TradingManager {
  private engines: Map<string, MainTradingEngine> = new Map();

  async startTradingForUser(userId: string): Promise<void> {
    const logger = new TradingLogger(userId);
    
    try {
      console.log(`Starting trading for user: ${userId}`);
      await logger.logSuccess(`Starting trading for user: ${userId}`);
      
      // Stop existing engine if running
      if (this.engines.has(userId)) {
        await this.stopTradingForUser(userId);
      }

      // Get user's API credentials
      const { data: credentials, error } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Database error fetching credentials:', error);
        await logger.logError('Database error fetching credentials', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!credentials) {
        console.error('No API credentials found for user:', userId);
        await logger.logError('No API credentials found', new Error('Credentials not found'), { userId });
        throw new Error('User API credentials not found. Please configure your API keys first.');
      }

      if (!credentials.api_key || !credentials.api_secret) {
        console.error('Incomplete API credentials for user:', userId);
        await logger.logError('Incomplete API credentials', new Error('Missing API key or secret'), { userId });
        throw new Error('API credentials are incomplete. Please check your API key and secret.');
      }

      console.log(`Creating BybitService for user ${userId} with demo trading: ${credentials.testnet || true}`);
      await logger.logSuccess(`Creating BybitService with demo trading: ${credentials.testnet || true}`);

      // Create and initialize new engine
      const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
      bybitService.setLogger(logger);
      
      const engine = new MainTradingEngine(userId, bybitService);
      
      await engine.initialize();
      await engine.start();
      
      this.engines.set(userId, engine);
      
      console.log(`Trading started successfully for user: ${userId}`);
      await logger.logSuccess(`Trading started successfully for user: ${userId}`);
      
    } catch (error) {
      console.error(`Failed to start trading for user ${userId}:`, error);
      await logger.logError(`Failed to start trading engine`, error);
      throw error;
    }
  }

  async stopTradingForUser(userId: string): Promise<void> {
    const logger = new TradingLogger(userId);
    
    try {
      const engine = this.engines.get(userId);
      if (engine) {
        await engine.stop();
        this.engines.delete(userId);
        console.log(`Trading stopped for user: ${userId}`);
        await logger.logSuccess(`Trading stopped for user: ${userId}`);
      }
    } catch (error) {
      console.error(`Failed to stop trading for user ${userId}:`, error);
      await logger.logError(`Failed to stop trading`, error);
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
    const logger = new TradingLogger(userId);
    
    console.log(`🔄 MANUAL CLOSE REQUESTED - User: ${userId}, Trade: ${tradeId}`);
    await logger.logSuccess(`MANUAL CLOSE REQUESTED`, {
      userId,
      tradeId,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Check if engine is running, if not create a temporary one
      let engine = this.engines.get(userId);
      let isTemporaryEngine = false;
      
      if (!engine) {
        console.log('🔧 No running engine found, creating temporary engine for manual close');
        await logger.logSuccess('Creating temporary engine for manual close', { tradeId });
        
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error) {
            console.error('❌ Database error fetching credentials:', error);
            await logger.logError('Database error fetching credentials for manual close', error, { tradeId });
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('❌ No API credentials found for user:', userId);
            await logger.logError('No API credentials found for manual close', new Error('Credentials not found'), { tradeId });
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          bybitService.setLogger(logger);
          
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          isTemporaryEngine = true;
          console.log('✅ Temporary engine created for manual close');
          await logger.logSuccess('Temporary engine created successfully', { tradeId });
          
        } catch (error) {
          console.error('❌ Failed to create temporary engine for manual close:', error);
          await logger.logError('Failed to create engine for manual close', error, { tradeId });
          throw new Error('Failed to initialize trading engine for manual close');
        }
      } else {
        console.log('✅ Using existing running engine for manual close');
        await logger.logSuccess('Using existing running engine', { tradeId });
      }
      
      // Execute manual close
      console.log('🔄 EXECUTING MANUAL CLOSE...');
      await logger.logSuccess('Starting manual close execution', { tradeId });
      
      await engine.manualClosePosition(tradeId);
      
      console.log('✅ MANUAL CLOSE COMPLETED SUCCESSFULLY');
      await logger.log('position_closed', 'Manual close completed successfully', { 
        tradeId,
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ MANUAL CLOSE FAILED:', error);
      await logger.logError('Manual close failed', error, { tradeId });
      throw error;
    }
  }

  async simulateEndOfDay(userId: string): Promise<void> {
    const logger = new TradingLogger(userId);
    
    console.log('🌅 MANUAL EOD SIMULATION REQUESTED - User:', userId);
    await logger.logSuccess('MANUAL EOD SIMULATION REQUESTED', {
      userId,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Check if engine is running, if not create a temporary one for EOD
      let engine = this.engines.get(userId);
      
      if (!engine) {
        console.log('🔧 No running engine found, creating temporary engine for EOD simulation');
        await logger.logSuccess('Creating temporary engine for EOD simulation');
        
        try {
          // Get user's API credentials
          const { data: credentials, error } = await supabase
            .from('api_credentials')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error) {
            console.error('❌ Database error fetching credentials:', error);
            await logger.logError('Database error fetching credentials for EOD', error);
            throw new Error(`Database error: ${error.message}`);
          }

          if (!credentials) {
            console.error('❌ No API credentials found for user:', userId);
            await logger.logError('No API credentials found for EOD', new Error('Credentials not found'));
            throw new Error('User API credentials not found. Please configure your API keys first.');
          }

          const bybitService = new BybitService(credentials.api_key, credentials.api_secret, credentials.testnet || true);
          bybitService.setLogger(logger);
          
          engine = new MainTradingEngine(userId, bybitService);
          await engine.initialize();
          console.log('✅ Temporary engine created for EOD simulation');
          await logger.logSuccess('Temporary engine created successfully for EOD');
          
        } catch (error) {
          console.error('❌ Failed to create temporary engine for EOD:', error);
          await logger.logError('Failed to create engine for EOD simulation', error);
          throw new Error('Failed to initialize trading engine for EOD simulation');
        }
      } else {
        console.log('✅ Using existing running engine for EOD simulation');
        await logger.logSuccess('Using existing running engine for EOD');
      }
      
      // Execute EOD simulation
      console.log('🌅 EXECUTING EOD SIMULATION...');
      await logger.logSuccess('Starting EOD simulation execution');
      
      await engine.simulateEndOfDay();
      
      console.log('✅ EOD SIMULATION COMPLETED SUCCESSFULLY');
      await logger.log('position_closed', 'Manual EOD simulation completed successfully', {
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ EOD SIMULATION FAILED:', error);
      await logger.logError('EOD simulation failed', error);
      throw error;
    }
  }
}

export const tradingManager = new TradingManager();
