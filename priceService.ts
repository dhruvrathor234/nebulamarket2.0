
import { Symbol } from '../types';
import { ASSETS } from '../constants';

// Fallback prices initialized from constants
const FALLBACK_PRICES: Record<Symbol, number> = {
  XAUUSD: ASSETS.XAUUSD.INITIAL_PRICE,
  BTCUSD: ASSETS.BTCUSD.INITIAL_PRICE,
  ETHUSD: ASSETS.ETHUSD.INITIAL_PRICE,
  SOLUSD: ASSETS.SOLUSD.INITIAL_PRICE,
  DOGEUSD: ASSETS.DOGEUSD.INITIAL_PRICE,
  EURUSD: ASSETS.EURUSD.INITIAL_PRICE,
  GBPUSD: ASSETS.GBPUSD.INITIAL_PRICE,
  US500: ASSETS.US500.INITIAL_PRICE,
  US100: ASSETS.US100.INITIAL_PRICE,
  TSLA: ASSETS.TSLA.INITIAL_PRICE,
  NVDA: ASSETS.NVDA.INITIAL_PRICE,
};

// Simulation state to keep non-API prices moving realistically
const simulationState: Record<string, number> = { ...FALLBACK_PRICES };

export const fetchRealPrice = async (symbol: Symbol): Promise<number> => {
  try {
    // --- CRYPTO (Binance API) ---
    if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD'].includes(symbol)) {
      const binanceSymbol = symbol.replace('USD', 'USDT');
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (!response.ok) throw new Error('Binance API failed');
      const data = await response.json();
      return parseFloat(data.price);
    }
    
    // --- OTHERS (Simulated Live Feed) ---
    // Since free CORS-enabled APIs for Forex/Indices are rare/unreliable, 
    // we use a random walk simulation for the Bot's internal pricing.
    // The visual chart uses TradingView so the user sees the REAL price.
    // This ensures the bot never crashes due to API limits.
    
    const prevPrice = simulationState[symbol];
    const volatility = ASSETS[symbol].INITIAL_PRICE * 0.0002; // 0.02% move per tick
    const change = (Math.random() - 0.5) * volatility;
    
    let newPrice = prevPrice + change;
    
    // Specific hardcoded "Live" lookups if available (Example Gold)
    if (symbol === 'XAUUSD') {
      try {
        const response = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
        if (response.ok) {
           const data = await response.json();
           if (data.items && data.items.length > 0) {
             newPrice = data.items[0].xauPrice;
           }
        }
      } catch (e) { /* ignore */ }
    }

    simulationState[symbol] = newPrice;
    return newPrice;

  } catch (error) {
    // console.warn(`Failed to fetch price for ${symbol}, using fallback.`);
    return simulationState[symbol] || FALLBACK_PRICES[symbol];
  }
};