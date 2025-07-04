
import { TradingLogger } from './TradingLogger';
import { DatabaseHelper } from './DatabaseHelper';
import { OrderExecution } from './OrderExecution';
import { ConfigurationService } from './ConfigurationService';
import { SignalFetcher } from './SignalFetcher';
import { SignalAnalysisCore } from './SignalAnalysisCore';
import { PositionValidator } from './PositionValidator';
import { EnhancedBybitClient } from './bybit/EnhancedBybitClient';
import { BybitService } from '../../bybitService';

/**
 * PHASE 2 ENHANCED: Expanded ServiceContainer with proper dependency injection
 * Centralized service management for consistent architecture
 */
export class ServiceContainer {
  private static loggers: Map<string, TradingLogger> = new Map();
  private static databaseHelpers: Map<string, DatabaseHelper> = new Map();
  private static orderExecutions: Map<string, OrderExecution> = new Map();
  private static configurationServices: Map<string, ConfigurationService> = new Map();
  private static signalFetchers: Map<string, SignalFetcher> = new Map();
  private static signalAnalysisCores: Map<string, SignalAnalysisCore> = new Map();
  private static positionValidators: Map<string, PositionValidator> = new Map();
  private static enhancedBybitClients: Map<string, EnhancedBybitClient> = new Map();

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

  static getPositionValidator(userId: string): PositionValidator {
    if (!this.positionValidators.has(userId)) {
      this.positionValidators.set(userId, new PositionValidator(userId));
    }
    return this.positionValidators.get(userId)!;
  }

  /**
   * PHASE 3: Get Enhanced Bybit Client with validation and retry logic
   */
  static getEnhancedBybitClient(
    userId: string, 
    apiKey: string, 
    apiSecret: string, 
    isDemoTrading: boolean = true, 
    apiUrl?: string
  ): EnhancedBybitClient {
    const key = `${userId}_${apiKey.substring(0, 8)}_${isDemoTrading}`;
    if (!this.enhancedBybitClients.has(key)) {
      this.enhancedBybitClients.set(
        key, 
        new EnhancedBybitClient(apiKey, apiSecret, isDemoTrading, apiUrl, userId)
      );
    }
    return this.enhancedBybitClients.get(key)!;
  }

  static clearCache(userId?: string): void {
    if (userId) {
      this.loggers.delete(userId);
      this.databaseHelpers.delete(userId);
      this.configurationServices.delete(userId);
      this.signalFetchers.delete(userId);
      this.signalAnalysisCores.delete(userId);
      this.positionValidators.delete(userId);
      
      // Clear order executions for this user
      for (const key of this.orderExecutions.keys()) {
        if (key.startsWith(userId)) {
          this.orderExecutions.delete(key);
        }
      }

      // Clear enhanced Bybit clients for this user
      for (const key of this.enhancedBybitClients.keys()) {
        if (key.startsWith(userId)) {
          this.enhancedBybitClients.delete(key);
        }
      }
    } else {
      this.loggers.clear();
      this.databaseHelpers.clear();
      this.orderExecutions.clear();
      this.configurationServices.clear();
      this.signalFetchers.clear();
      this.signalAnalysisCores.clear();
      this.positionValidators.clear();
      this.enhancedBybitClients.clear();
    }
  }
}
