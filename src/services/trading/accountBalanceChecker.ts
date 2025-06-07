
import { BybitService } from '../bybitService';

export class AccountBalanceChecker {
  private bybitService: BybitService;

  constructor(bybitService: BybitService) {
    this.bybitService = bybitService;
  }

  async checkAccountBalance(symbol: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking account balance for ${symbol}...`);
      
      const balanceData = await this.bybitService.getAccountBalance();
      
      if (balanceData.retCode === 0 && balanceData.result?.list?.[0]?.coin) {
        const coins = balanceData.result.list[0].coin;
        const baseSymbol = symbol.replace('USDT', ''); // e.g., 'BTC' from 'BTCUSDT'
        
        const coinBalance = coins.find((coin: any) => coin.coin === baseSymbol);
        
        if (coinBalance) {
          const availableBalance = parseFloat(coinBalance.walletBalance || '0');
          console.log(`💰 ${baseSymbol} balance: ${availableBalance}`);
          return availableBalance > 0;
        } else {
          console.log(`❌ No ${baseSymbol} balance found in account`);
          return false;
        }
      }
      
      console.log(`❌ Failed to get balance data from Bybit`);
      return false;
    } catch (error) {
      console.error(`Error checking account balance for ${symbol}:`, error);
      return false;
    }
  }
}
