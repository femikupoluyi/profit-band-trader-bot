
import { TradeRepository } from './database/TradeRepository';
import { SignalRepository } from './database/SignalRepository';
import { DatabaseConnection } from './database/DatabaseConnection';

export class DatabaseQueryHelper {
  private tradeRepository: TradeRepository;
  private signalRepository: SignalRepository;

  constructor(userId: string) {
    this.tradeRepository = new TradeRepository(userId);
    this.signalRepository = new SignalRepository(userId);
  }

  // Trade operations
  async getTrades(userId: string, filters?: {
    symbol?: string;
    status?: string[];
    limit?: number;
  }) {
    return this.tradeRepository.getTrades(userId, filters);
  }

  async createTrade(tradeData: {
    user_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    order_type: 'market' | 'limit';
    status: string;
    bybit_order_id?: string;
  }) {
    return this.tradeRepository.createTrade(tradeData);
  }

  async updateTrade(tradeId: string, updateData: {
    price?: number;
    quantity?: number;
    status?: string;
    buy_fill_price?: number;
    profit_loss?: number;
    bybit_order_id?: string;
  }) {
    return this.tradeRepository.updateTrade(tradeId, updateData);
  }

  // Signal operations
  async getSignals(userId: string, filters?: {
    symbol?: string;
    processed?: boolean;
    limit?: number;
  }) {
    return this.signalRepository.getSignals(userId, filters);
  }

  async createSignal(signalData: {
    user_id: string;
    symbol: string;
    signal_type: string;
    price: number;
    confidence?: number;
    reasoning?: string;
  }) {
    return this.signalRepository.createSignal(signalData);
  }

  // Connection utilities
  static async testConnection(): Promise<boolean> {
    return DatabaseConnection.testConnection();
  }

  static getClient() {
    return DatabaseConnection.getClient();
  }
}
