
import { BybitService } from '../../bybitService';
import { TradingLogger } from './TradingLogger';
import { PositionCloseValidator } from './position/PositionCloseValidator';
import { BybitPositionCloser } from './position/BybitPositionCloser';
import { DatabasePositionUpdater } from './position/DatabasePositionUpdater';

export class ManualCloseService {
  private userId: string;
  private bybitService: BybitService;
  private logger: TradingLogger;
  private validator: PositionCloseValidator;
  private bybitCloser: BybitPositionCloser;
  private dbUpdater: DatabasePositionUpdater;

  constructor(userId: string, bybitService: BybitService) {
    this.userId = userId;
    this.bybitService = bybitService;
    this.logger = new TradingLogger(userId);
    this.validator = new PositionCloseValidator(userId, this.logger);
    this.bybitCloser = new BybitPositionCloser(bybitService, this.logger);
    this.dbUpdater = new DatabasePositionUpdater(userId, this.logger);
  }

  async closePosition(tradeId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔄 Manual close requested for trade ${tradeId}`);
      
      // Step 1: Validate close request
      const validation = await this.validator.validateCloseRequest(tradeId);
      if (!validation.valid) {
        return { success: false, message: validation.error! };
      }

      const trade = validation.trade!;

      // Step 2: Get current market price for P&L calculation
      const currentPrice = await this.getCurrentPrice(trade.symbol, trade.price);

      // Step 3: Execute close order on Bybit
      const closeResult = await this.bybitCloser.executeCloseOrder(trade);
      if (!closeResult.success) {
        return { success: false, message: closeResult.error! };
      }

      // Step 4: Calculate P&L
      const entryPrice = parseFloat(trade.price.toString());
      const quantity = parseFloat(trade.quantity.toString());
      const profitLoss = (currentPrice - entryPrice) * quantity;

      // Step 5: Update local database
      const updateResult = await this.dbUpdater.updateClosedPosition(
        tradeId, 
        profitLoss, 
        closeResult.bybitOrderId!
      );
      
      if (!updateResult.success) {
        return { 
          success: false, 
          message: `${updateResult.error}. Position may be closed on exchange but not updated locally. Contact support.` 
        };
      }

      // Step 6: Log successful close
      await this.logger.log('position_closed', `Manual close executed successfully for ${trade.symbol}`, {
        tradeId,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice,
        closePrice: currentPrice,
        quantity: trade.quantity,
        profitLoss,
        bybitOrderId: closeResult.bybitOrderId,
        closedAt: new Date().toISOString(),
        method: 'manual_api_close'
      });

      const successMessage = `Position closed successfully: ${trade.symbol} P&L: $${profitLoss.toFixed(2)}`;
      console.log(`✅ ${successMessage}`);

      return { 
        success: true, 
        message: successMessage, 
        data: { 
          profitLoss, 
          bybitOrderId: closeResult.bybitOrderId, 
          closePrice: currentPrice 
        } 
      };

    } catch (error) {
      const errorMsg = `Unexpected error during manual close for trade ${tradeId}`;
      console.error(`❌ ${errorMsg}:`, error);
      
      await this.logger.logError(errorMsg, error, {
        tradeId,
        step: 'unknown',
        fullError: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      });
      
      return { 
        success: false, 
        message: `${errorMsg}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private async getCurrentPrice(symbol: string, fallbackPrice: number): Promise<number> {
    try {
      const marketData = await this.bybitService.getMarketPrice(symbol);
      console.log(`📊 Current market price for ${symbol}: $${marketData.price}`);
      return marketData.price;
    } catch (priceError) {
      console.error(`⚠️ Could not fetch current price for ${symbol}:`, priceError);
      return parseFloat(fallbackPrice.toString());
    }
  }
}
