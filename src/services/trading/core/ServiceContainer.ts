
import { TradingLogger } from './TradingLogger';
import { DatabaseHelper } from './DatabaseHelper';
import { OrderExecution } from './OrderExecution';
import { ConfigurationService } from './ConfigurationService';
import { SignalFetcher } from './SignalFetcher';
import { SignalAnalysisCore } from './SignalAnalysisCore';
import { BybitService } from '../../bybitService';

export class ServiceContainer {
  private static loggers: Map<string, TradingLogger> = new Map();
  private static databaseHelpers: Map<string, DatabaseHelper> = new Map();
  private static orderExecutions: Map<string, OrderExecution> = new Map();
  private static configurationServices: Map<string, ConfigurationService> = new Map();
  private static signalFetchers: Map<string, SignalFetcher> = new Map();
  private static signalAnalysisCores: Map<string, SignalAnalysisCore> = new Map();

  static getLogger(userId: string): TradingLogger {
    if (!this.loggers.has(userId)) {
      this.loggers.set(userId, new TradingLogger(userId));
    }
    return this.loggers.get(userId)!;
  }

  static getDatabaseHelper(userId: string): DatabaseHelper {
    if (!this.databaseHelpers.has(userId)) {
      this.databaseHelpers.set(userId, new DatabaseHelper(userId));
    }
    return this.databaseHelpers.get(userId)!;
  }

  static getOrderExecution(userId: string, bybitService: BybitService): OrderExecution {
    const key = `${userId}_${bybitService.constructor.name}`;
    if (!this.orderExecutions.has(key)) {
      this.orderExecutions.set(key, new OrderExecution(userId, bybitService));
    }
    return this.orderExecutions.get(key)!;
  }

  static getConfigurationService(userId: string): ConfigurationService {
    if (!this.configurationServices.has(userId)) {
      this.configurationServices.set(userId, new ConfigurationService(userId));
    }
    return this.configurationServices.get(userId)!;
  }

  static getSignalFetcher(userId: string): SignalFetcher {
    if (!this.signalFetchers.has(userId)) {
      this.signalFetchers.set(userId, new SignalFetcher(userId));
    }
    return this.signalFetchers.get(userId)!;
  }

  static getSignalAnalysisCore(userId: string): SignalAnalysisCore {
    if (!this.signalAnalysisCores.has(userId)) {
      this.signalAnalysisCores.set(userId, new SignalAnalysisCore(userId));
    }
    return this.signalAnalysisCores.get(userId)!;
  }

  static clearCache(userId?: string): void {
    if (userId) {
      this.loggers.delete(userId);
      this.databaseHelpers.delete(userId);
      this.configurationServices.delete(userId);
      this.signalFetchers.delete(userId);
      this.signalAnalysisCores.delete(userId);
      
      // Clear order executions for this user
      for (const key of this.orderExecutions.keys()) {
        if (key.startsWith(userId)) {
          this.orderExecutions.delete(key);
        }
      }
    } else {
      this.loggers.clear();
      this.databaseHelpers.clear();
      this.orderExecutions.clear();
      this.configurationServices.clear();
      this.signalFetchers.clear();
      this.signalAnalysisCores.clear();
    }
  }
}
