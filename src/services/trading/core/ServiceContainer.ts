
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { DatabaseQueryHelper } from './DatabaseQueryHelper';
import { SignalAnalysisCore } from './SignalAnalysisCore';
import { OrderExecution } from './OrderExecution';

/**
 * Centralized service container to reduce circular dependencies
 */
export class ServiceContainer {
  private static instances = new Map<string, any>();

  static getLogger(userId: string): TradingLogger {
    const key = `logger_${userId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new TradingLogger(userId));
    }
    return this.instances.get(key);
  }

  static getDatabaseHelper(userId: string): DatabaseQueryHelper {
    const key = `db_${userId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new DatabaseQueryHelper(userId));
    }
    return this.instances.get(key);
  }

  static getSignalAnalysisCore(userId: string): SignalAnalysisCore {
    const key = `signal_core_${userId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new SignalAnalysisCore(userId));
    }
    return this.instances.get(key);
  }

  static getOrderExecution(userId: string, bybitService: BybitService): OrderExecution {
    const key = `order_exec_${userId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new OrderExecution(userId, bybitService));
    }
    return this.instances.get(key);
  }

  static clearInstances(): void {
    this.instances.clear();
  }

  static clearUserInstances(userId: string): void {
    const keysToDelete = Array.from(this.instances.keys()).filter(key => key.includes(userId));
    keysToDelete.forEach(key => this.instances.delete(key));
  }
}
