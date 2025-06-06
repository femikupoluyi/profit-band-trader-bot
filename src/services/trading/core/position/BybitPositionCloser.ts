
import { BybitService } from '../../../bybitService';
import { ConfigurableFormatter } from '../ConfigurableFormatter';
import { TradingLogger } from '../TradingLogger';

export class BybitPositionCloser {
  private bybitService: BybitService;
  private logger: TradingLogger;

  constructor(bybitService: BybitService, logger: TradingLogger) {
    this.bybitService = bybitService;
    this.logger = logger;
  }

  async executeCloseOrder(trade: any): Promise<{ success: boolean; bybitOrderId?: string; error?: string }> {
    try {
      const quantity = parseFloat(trade.quantity.toString());
      const formattedQuantity = await ConfigurableFormatter.formatQuantity(trade.symbol, quantity);

      const closeOrderParams = {
        category: 'spot' as const,
        symbol: trade.symbol,
        side: 'Sell' as const,
        orderType: 'Market' as const,
        qty: formattedQuantity
      };

      console.log(`📝 Executing Bybit close order for ${trade.symbol}:`, closeOrderParams);

      const bybitResponse = await this.bybitService.placeOrder(closeOrderParams);
      console.log(`📡 Bybit close order response:`, bybitResponse);

      if (!bybitResponse || bybitResponse.retCode !== 0) {
        const errorMsg = `Bybit order failed for ${trade.symbol}: ${bybitResponse?.retMsg || 'Unknown error'}`;
        await this.logger.logError('Bybit close order failed', new Error(errorMsg), {
          tradeId: trade.id,
          symbol: trade.symbol,
          bybitResponse,
          retCode: bybitResponse?.retCode,
          retMsg: bybitResponse?.retMsg
        });
        return { success: false, error: errorMsg };
      }

      const bybitOrderId = bybitResponse.result?.orderId;
      if (!bybitOrderId) {
        const errorMsg = `Bybit order succeeded but no order ID returned for ${trade.symbol}`;
        await this.logger.logError('Bybit close order - no order ID', new Error(errorMsg), {
          tradeId: trade.id,
          symbol: trade.symbol,
          bybitResponse
        });
        return { success: false, error: errorMsg };
      }

      return { success: true, bybitOrderId };
    } catch (error) {
      const errorMsg = `Bybit API call failed for ${trade.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.logger.logError('Bybit close order - API exception', error, {
        tradeId: trade.id,
        symbol: trade.symbol
      });
      return { success: false, error: errorMsg };
    }
  }
}
