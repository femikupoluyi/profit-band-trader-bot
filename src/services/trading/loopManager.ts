
import { supabase } from '@/integrations/supabase/client';
import { TradingConfigData } from '@/components/trading/config/useTradingConfig';
import { TradingServices } from './serviceInitializer';

export class LoopManager {
  private userId: string;
  private config: TradingConfigData;
  private services: TradingServices | null = null;
  private isRunning = false;
  private loopCount = 0;
  private lastEndOfDayCheck = '';

  constructor(userId: string, config: TradingConfigData) {
    this.userId = userId;
    this.config = config;
  }

  setServices(services: TradingServices): void {
    this.services = services;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.loopCount = 0;
    this.logActivity('info', 'Trading engine started with new strategy');
    console.log('Trading engine started with support line strategy, beginning main loop...');
    
    this.runLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.logActivity('info', 'Trading engine stopped');
    console.log('Trading engine stopped');
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.loopCount++;
        console.log(`Trading loop iteration #${this.loopCount}`);

        if (!this.services) {
          console.log('Services not initialized, waiting 60 seconds...');
          await this.logActivity('warning', 'Trading services not initialized. Please ensure API credentials are configured.');
          await this.sleep(60000);
          continue;
        }

        // Check for end-of-day processing
        await this.checkEndOfDay();

        console.log('Scanning markets...');
        await this.services.marketScanner.scanMarkets();
        
        console.log('Analyzing markets and creating signals...');
        await this.services.signalAnalyzer.analyzeAndCreateSignals();
        
        console.log('Processing signals...');
        await this.services.tradeExecutor.processSignals();
        
        console.log('Monitoring positions...');
        await this.services.positionMonitor.monitorPositions();
        
        console.log(`Loop #${this.loopCount} complete, waiting 30 seconds...`);
        await this.logActivity('info', `Trading loop #${this.loopCount} completed successfully`);
        
        // Wait before next iteration
        await this.sleep(30000); // 30 seconds
      } catch (error) {
        console.error('Error in trading loop:', error);
        await this.logActivity('error', 'Trading loop error', { error: error.message, loopCount: this.loopCount });
        await this.sleep(60000); // Wait 1 minute on error
      }
    }
  }

  private async checkEndOfDay(): Promise<void> {
    try {
      const now = new Date();
      const resetTime = this.config.daily_reset_time || '00:00:00';
      const [hours, minutes] = resetTime.split(':').map(Number);
      
      const resetDateTime = new Date(now);
      resetDateTime.setHours(hours, minutes, 0, 0);
      
      // If we've passed the reset time today and haven't processed it yet
      const todayKey = now.toDateString();
      if (now >= resetDateTime && this.lastEndOfDayCheck !== todayKey) {
        console.log('Performing end-of-day processing...');
        await this.logActivity('info', 'Starting end-of-day processing');
        
        if (this.services?.tradeExecutor) {
          await this.services.tradeExecutor.closeEndOfDayTrades();
        }
        
        this.lastEndOfDayCheck = todayKey;
        await this.logActivity('info', 'End-of-day processing completed');
      }
    } catch (error) {
      console.error('Error in end-of-day check:', error);
      await this.logActivity('error', 'End-of-day processing failed', { error: error.message });
    }
  }

  private async logActivity(type: string, message: string, data?: any): Promise<void> {
    try {
      await (supabase as any)
        .from('trading_logs')
        .insert({
          user_id: this.userId,
          log_type: type,
          message,
          data: data || null,
        });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
