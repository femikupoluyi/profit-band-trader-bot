
import { TradingLogger } from './TradingLogger';

export class TradingLoopScheduler {
  private isRunning = false;
  private mainLoopInterval: NodeJS.Timeout | null = null;
  private logger: TradingLogger;

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  start(intervalSeconds: number, executeFunction: () => Promise<void>): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.scheduleLoop(intervalSeconds, executeFunction);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.mainLoopInterval) {
      clearTimeout(this.mainLoopInterval);
      this.mainLoopInterval = null;
    }
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  private scheduleLoop(intervalSeconds: number, executeFunction: () => Promise<void>): void {
    if (!this.isRunning) return;

    const validInterval = Math.max(1, Math.min(intervalSeconds, 3600)); // Between 1 second and 1 hour
    
    this.mainLoopInterval = setTimeout(async () => {
      try {
        await executeFunction();
        
        if (this.isRunning) {
          this.scheduleLoop(intervalSeconds, executeFunction);
        }
      } catch (error) {
        console.error('❌ Error in trading loop:', error);
        await this.logger.logError('Trading loop execution error', error);
        
        if (this.isRunning) {
          this.scheduleLoop(intervalSeconds, executeFunction);
        }
      }
    }, validInterval * 1000);
  }
}
