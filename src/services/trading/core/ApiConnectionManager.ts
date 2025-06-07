
import { TradingLogger } from './TradingLogger';

interface ConnectionHealth {
  isHealthy: boolean;
  lastSuccessTime: number;
  consecutiveFailures: number;
  nextAttemptTime: number;
}

export class ApiConnectionManager {
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private logger: TradingLogger;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly RETRY_DELAYS = [1000, 2000, 5000]; // Progressive delays

  constructor(userId: string) {
    this.logger = new TradingLogger(userId);
  }

  isConnectionHealthy(endpoint: string): boolean {
    const health = this.connectionHealth.get(endpoint);
    if (!health) {
      this.initializeConnection(endpoint);
      return true;
    }

    // Check if circuit breaker should be opened
    if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      const now = Date.now();
      if (now < health.nextAttemptTime) {
        console.log(`🚫 Circuit breaker OPEN for ${endpoint}, waiting until ${new Date(health.nextAttemptTime).toISOString()}`);
        return false;
      } else {
        console.log(`🔄 Circuit breaker attempting HALF-OPEN for ${endpoint}`);
        // Reset for retry attempt
        health.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES - 1;
      }
    }

    return health.isHealthy;
  }

  recordSuccess(endpoint: string): void {
    const health = this.connectionHealth.get(endpoint) || this.initializeConnection(endpoint);
    health.isHealthy = true;
    health.lastSuccessTime = Date.now();
    health.consecutiveFailures = 0;
    health.nextAttemptTime = 0;
    
    console.log(`✅ Connection healthy for ${endpoint}`);
  }

  recordFailure(endpoint: string, error: any): void {
    const health = this.connectionHealth.get(endpoint) || this.initializeConnection(endpoint);
    health.consecutiveFailures++;
    health.isHealthy = false;

    if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      health.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
      console.log(`🔴 Circuit breaker OPENED for ${endpoint} after ${health.consecutiveFailures} failures`);
      this.logger.logError(`Circuit breaker opened for ${endpoint}`, error, {
        consecutiveFailures: health.consecutiveFailures,
        nextAttemptTime: health.nextAttemptTime
      });
    } else {
      console.log(`⚠️ Connection failure ${health.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES} for ${endpoint}`);
    }
  }

  getRetryDelay(attemptNumber: number): number {
    const delayIndex = Math.min(attemptNumber - 1, this.RETRY_DELAYS.length - 1);
    return this.RETRY_DELAYS[delayIndex];
  }

  shouldRetry(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Retry on network errors
    if (errorMessage.includes('failed to fetch') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')) {
      return true;
    }

    // Retry on rate limiting
    if (errorMessage.includes('rate limit') || 
        errorMessage.includes('too many requests')) {
      return true;
    }

    return false;
  }

  private initializeConnection(endpoint: string): ConnectionHealth {
    const health: ConnectionHealth = {
      isHealthy: true,
      lastSuccessTime: Date.now(),
      consecutiveFailures: 0,
      nextAttemptTime: 0
    };
    this.connectionHealth.set(endpoint, health);
    return health;
  }

  getConnectionStatus(): Record<string, ConnectionHealth> {
    const status: Record<string, ConnectionHealth> = {};
    this.connectionHealth.forEach((health, endpoint) => {
      status[endpoint] = { ...health };
    });
    return status;
  }
}
