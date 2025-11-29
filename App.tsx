
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, TrendingUp, Newspaper, Activity, Wallet, ShieldAlert, Cpu, Power, BarChart3, Globe, Coins, ArrowDownCircle, ArrowUpCircle, ScanEye } from 'lucide-react';
import { analyzeMarket } from './services/geminiService';
import { fetchRealPrice } from './services/priceService';
import TradingViewWidget from './components/TradingViewWidget';
import StatsCard from './components/StatsCard';
import TradeLog from './components/TradeLog';
import OpenTradesPanel from './components/OpenTradesPanel';
import BotActivityLog from './components/BotActivityLog';
import RiskPanel from './components/RiskPanel';
import WalletModal from './components/WalletModal';
import EconomicCalendarWidget from './components/EconomicCalendarWidget';
import { 
  BotState, 
  Trade, 
  TradeType, 
  MarketAnalysis, 
  NewsSource,
  RiskSettings,
  Symbol
} from './types';
import { 
  INITIAL_BALANCE, 
  CRON_INTERVAL_MS, 
  PRICE_TICK_INTERVAL_MS,
  SIMULATION_DISCLAIMER,
  ASSETS
} from './constants';

const App: React.FC = () => {
  // --- State ---
  const [activeSymbol, setActiveSymbol] = useState<Symbol>('XAUUSD');
  const [enabledSymbols, setEnabledSymbols] = useState<Set<Symbol>>(new Set(['XAUUSD'])); // Only enabled symbols are traded
  
  const [botState, setBotState] = useState<BotState>({
    isRunning: false,
    balance: INITIAL_BALANCE,
    equity: INITIAL_BALANCE,
    lastRunTime: null,
    statusMessage: "Bot is idle. Waiting to start.",
  });

  const [walletModal, setWalletModal] = useState<{ isOpen: boolean; type: 'deposit' | 'withdraw' }>({ 
    isOpen: false, 
    type: 'deposit' 
  });

  // Initialize Risk Settings for ALL assets
  const [riskSettings, setRiskSettings] = useState<Record<Symbol, RiskSettings>>(() => {
    const initial: any = {};
    (Object.keys(ASSETS) as Symbol[]).forEach(sym => {
      initial[sym] = { 
        riskPercentage: 1.0, 
        stopLossDistance: ASSETS[sym].DEFAULT_STOP_LOSS,
        takeProfitDistance: ASSETS[sym].DEFAULT_TAKE_PROFIT 
      };
    });
    return initial;
  });

  // Initialize Prices for ALL assets
  const [prices, setPrices] = useState<Record<Symbol, number>>(() => {
    const initial: any = {};
    (Object.keys(ASSETS) as Symbol[]).forEach(sym => {
      initial[sym] = ASSETS[sym].INITIAL_PRICE;
    });
    return initial;
  });

  const [trades, setTrades] = useState<Trade[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, MarketAnalysis | null>>({});
  
  const [logs, setLogs] = useState<{ id: number; time: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs
  const botStateRef = useRef(botState);
  const pricesRef = useRef(prices);
  const tradesRef = useRef(trades);
  const riskSettingsRef = useRef(riskSettings);
  const enabledSymbolsRef = useRef(enabledSymbols);
  
  // Sync refs
  useEffect(() => {
    botStateRef.current = botState;
    pricesRef.current = prices;
    tradesRef.current = trades;
    riskSettingsRef.current = riskSettings;
    enabledSymbolsRef.current = enabledSymbols;
  }, [botState, prices, trades, riskSettings, enabledSymbols]);

  // --- Helpers ---
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-49), { id: Date.now(), time, message, type }]);
  };

  const toggleSymbolTrading = (e: React.MouseEvent, symbol: Symbol) => {
    e.stopPropagation(); // Prevent changing active view
    setEnabledSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const handleWalletConfirm = (amount: number) => {
    const isDeposit = walletModal.type === 'deposit';
    setBotState(prev => {
        const newBalance = isDeposit ? prev.balance + amount : prev.balance - amount;
        // Equity needs to follow the balance change immediately
        const newEquity = isDeposit ? prev.equity + amount : prev.equity - amount;
        
        return {
            ...prev,
            balance: newBalance,
            equity: newEquity
        };
    });
    addLog(`Wallet: ${isDeposit ? 'Deposited' : 'Withdrew'} $${amount.toFixed(2)}`, "success");
  };

  // --- Manual Trading Handlers ---
  const handleManualOpen = (type: TradeType, lots: number, slDist: number, tpDist: number) => {
    const sym = activeSymbol;
    const price = pricesRef.current[sym];
    
    // Use manual values directly
    if (lots <= 0) {
        addLog(`Manual Trade Failed: Invalid lot size.`, "error");
        return;
    }

    const stopLossPrice = type === TradeType.BUY 
        ? price - slDist 
        : price + slDist;
        
    const takeProfitPrice = type === TradeType.BUY
        ? price + tpDist
        : price - tpDist;

    const newTrade: Trade = {
        id: crypto.randomUUID(),
        symbol: sym,
        type: type,
        entryPrice: price,
        lotSize: lots,
        stopLoss: stopLossPrice,
        takeProfit: takeProfitPrice,
        riskPercentage: 0, // Manual trade
        openTime: Date.now(),
        status: 'OPEN',
        pnl: 0
    };

    setTrades(prev => [...prev, newTrade]);
    addLog(`[${sym}] Manual ${type} Opened. ${lots} Lots @ ${price.toFixed(2)}`, "success");
  };

  const handleManualClose = (tradeId: string) => {
      const trade = tradesRef.current.find(t => t.id === tradeId);
      if (!trade || trade.status !== 'OPEN') return;
      
      const currentPrice = pricesRef.current[trade.symbol];
      const contractSize = ASSETS[trade.symbol].CONTRACT_SIZE;
      
      const diff = trade.type === TradeType.BUY 
        ? currentPrice - trade.entryPrice 
        : trade.entryPrice - currentPrice;
      
      const pnl = diff * contractSize * trade.lotSize;

      const closedTrade: Trade = {
          ...trade,
          status: 'CLOSED',
          closePrice: currentPrice,
          closeTime: Date.now(),
          pnl: pnl
      };

      setTrades(prev => prev.map(t => t.id === tradeId ? closedTrade : t));
      
      // Update Balance immediately
      setBotState(prev => ({
          ...prev,
          balance: prev.balance + pnl,
          equity: prev.balance + pnl
      }));

      addLog(`[${trade.symbol}] Manual Close. PnL: $${pnl.toFixed(2)}`, pnl >= 0 ? "success" : "warning");
  };

  // Handle updating SL/TP for an active trade
  const handleUpdateTrade = (tradeId: string, newSL: number, newTP: number) => {
    setTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return { ...t, stopLoss: newSL, takeProfit: newTP };
      }
      return t;
    }));
    addLog(`[Trade Updated] Adjusted SL/TP for trade #${tradeId.slice(0,4)}`, "info");
  };


  // --- Core Trading & Analysis Logic ---
  const processSymbolLogic = useCallback(async (sym: Symbol, onlyAnalyze: boolean = false) => {
      try {
        if (onlyAnalyze) setIsAnalyzing(true);

        const analysis = await analyzeMarket(sym);
        setAnalyses(prev => ({ ...prev, [sym]: analysis }));
        
        if (onlyAnalyze) {
           addLog(`[${sym}] Analysis Complete. Signal: ${analysis.decision}`, "success");
           setIsAnalyzing(false);
           return; // STOP HERE if strictly manual analysis
        }

        // --- Automated Trading Logic below this point ---
        const currentTrades = tradesRef.current;
        const activeTrade = currentTrades.find(t => t.status === 'OPEN' && t.symbol === sym);
        const price = pricesRef.current[sym];
        const risk = riskSettingsRef.current[sym];

        // 1. Close Signal Logic (Reversal)
        if (activeTrade) {
           if (
            (activeTrade.type === TradeType.BUY && analysis.decision === TradeType.SELL) ||
            (activeTrade.type === TradeType.SELL && analysis.decision === TradeType.BUY)
          ) {
            const contractSize = ASSETS[sym].CONTRACT_SIZE;
            const diff = activeTrade.type === TradeType.BUY ? price - activeTrade.entryPrice : activeTrade.entryPrice - price;
            const pnl = diff * contractSize * activeTrade.lotSize;
            
            const closedTrade: Trade = {
              ...activeTrade,
              status: 'CLOSED',
              closePrice: price,
              closeTime: Date.now(),
              pnl
            };

            setTrades(prev => prev.map(t => t.id === closedTrade.id ? closedTrade : t));
            setBotState(prev => ({ ...prev, balance: prev.balance + pnl }));
            addLog(`[${sym}] Closed ${activeTrade.type} on reversal. PnL: $${pnl.toFixed(2)}`, pnl >= 0 ? "success" : "warning");
            return;
          }
        }

        // 2. Open Signal Logic
        const SENTIMENT_THRESHOLD = 0.4;
        if (!activeTrade && analysis.decision !== TradeType.HOLD) {
          if (Math.abs(analysis.sentimentScore) > SENTIMENT_THRESHOLD) {
            
            const riskAmount = (botStateRef.current.balance * risk.riskPercentage) / 100;
            const contractSize = ASSETS[sym].CONTRACT_SIZE;
            const lotSize = Number((riskAmount / (risk.stopLossDistance * contractSize)).toFixed(2));
            
            if (lotSize <= 0) {
               addLog(`[${sym}] Lot size too small. skipping.`, "warning");
               return;
            }

            const stopLossPrice = analysis.decision === TradeType.BUY 
              ? price - risk.stopLossDistance 
              : price + risk.stopLossDistance;

            const takeProfitPrice = analysis.decision === TradeType.BUY
              ? price + risk.takeProfitDistance
              : price - risk.takeProfitDistance;

            const newTrade: Trade = {
              id: crypto.randomUUID(),
              symbol: sym,
              type: analysis.decision,
              entryPrice: price,
              lotSize: lotSize,
              stopLoss: stopLossPrice,
              takeProfit: takeProfitPrice,
              riskPercentage: risk.riskPercentage,
              openTime: Date.now(),
              status: 'OPEN',
              pnl: 0
            };
            
            setTrades(prev => [...prev, newTrade]);
            addLog(`[${sym}] Opened ${analysis.decision} ${lotSize} Lots @ ${price.toFixed(2)}. TP: ${takeProfitPrice.toFixed(2)}`, "success");
          }
        }
      } catch (error) {
        console.error(error);
        if (onlyAnalyze) setIsAnalyzing(false);
      }
  }, []);

  // --- Real-Time Market Data & PnL Engine ---
  useEffect(() => {
    const interval = setInterval(async () => {
      const allSymbols = Object.keys(ASSETS) as Symbol[];
      let floatingPL = 0;
      let closedTradesDueToSLTP: Trade[] = [];
      let currentTrades = [...tradesRef.current];
      
      // 1. Fetch Real Prices for ALL symbols (needed for PnL even if not viewing)
      const newPrices = { ...pricesRef.current };
      
      // Fetch in batches to avoid browser stalling
      await Promise.all(allSymbols.map(async (sym) => {
        newPrices[sym] = await fetchRealPrice(sym);
      }));
      
      setPrices(newPrices);

      // 2. Calculate PnL & Check Stop Loss / Take Profit
      currentTrades = currentTrades.map(trade => {
        if (trade.status === 'OPEN') {
          const currentPrice = newPrices[trade.symbol];
          const contractSize = ASSETS[trade.symbol].CONTRACT_SIZE;

          const diff = trade.type === TradeType.BUY 
            ? currentPrice - trade.entryPrice 
            : trade.entryPrice - currentPrice;
          
          const profit = diff * contractSize * trade.lotSize; 
          floatingPL += profit;

          // Check Stop Loss
          let slHit = false;
          if (trade.type === TradeType.BUY && currentPrice <= trade.stopLoss) slHit = true;
          if (trade.type === TradeType.SELL && currentPrice >= trade.stopLoss) slHit = true;

          // Check Take Profit
          let tpHit = false;
          if (trade.takeProfit) {
            if (trade.type === TradeType.BUY && currentPrice >= trade.takeProfit) tpHit = true;
            if (trade.type === TradeType.SELL && currentPrice <= trade.takeProfit) tpHit = true;
          }

          if (slHit || tpHit) {
             const closedPnl = profit; // Capture final profit/loss at SL/TP
             const closedTrade: Trade = {
                ...trade,
                status: 'CLOSED',
                closePrice: currentPrice,
                closeTime: Date.now(),
                pnl: closedPnl
             };
             closedTradesDueToSLTP.push(closedTrade);
             return closedTrade;
          }
          
          // Update PnL for Open Trades (so UI shows live numbers)
          return {
             ...trade,
             pnl: profit
          };
        }
        return trade;
      });

      // Always update trades state to reflect live PnL changes in UI
      setTrades(currentTrades);

      // 3. Update Balance if SL/TP hit
      if (closedTradesDueToSLTP.length > 0) {
        const totalClosedPL = closedTradesDueToSLTP.reduce((sum, t) => sum + (t.pnl || 0), 0);
        setBotState(prev => ({
           ...prev,
           balance: prev.balance + totalClosedPL,
           equity: prev.balance + totalClosedPL + floatingPL
        }));
        closedTradesDueToSLTP.forEach(t => {
           const isProfit = (t.pnl || 0) > 0;
           addLog(`[${t.symbol}] ${isProfit ? 'Take Profit Hit!' : 'Stop Loss Hit!'} Closed ${t.type} @ ${t.closePrice?.toFixed(2)}. PnL: $${t.pnl?.toFixed(2)}`, isProfit ? "success" : "error");
        });
      } else {
         setBotState(prev => ({
           ...prev,
           equity: prev.balance + floatingPL
         }));
      }

    }, PRICE_TICK_INTERVAL_MS * 1.5); // Slightly faster update for smoother PnL

    return () => clearInterval(interval);
  }, []);

  // --- Cron Job (Loop for enabled symbols) ---
  const executeBotLoop = useCallback(async () => {
    if (!botStateRef.current.isRunning) return;

    const tradingSymbols = Array.from(enabledSymbolsRef.current);
    if (tradingSymbols.length === 0) {
      addLog("System: No symbols enabled. Please enable a symbol to trade.", "warning");
      return;
    }
    
    // We iterate through enabled symbols
    addLog(`System: Background scan for ${tradingSymbols.join(', ')}`, "info");
    for (const sym of tradingSymbols) {
       await processSymbolLogic(sym, false); // false = Execute Trades
    }
    
    setBotState(prev => ({ ...prev, lastRunTime: Date.now() }));
  }, [processSymbolLogic]);

  // Interval wrapper
  useEffect(() => {
    let intervalId: any;
    if (botState.isRunning) {
      intervalId = setInterval(executeBotLoop, CRON_INTERVAL_MS);
    }
    return () => clearInterval(intervalId);
  }, [botState.isRunning, executeBotLoop]);

  // --- Immediate Logic Triggers ---

  // Trigger analysis immediately when activeSymbol changes IF bot is running
  useEffect(() => {
    if (botState.isRunning) {
       // Auto-enable trading for the new symbol if desired, or just analyze it.
       setEnabledSymbols(prev => new Set(prev).add(activeSymbol));
       
       addLog(`View Changed: Analyzing ${activeSymbol} immediately...`, "info");
       processSymbolLogic(activeSymbol, false);
    }
  }, [activeSymbol, botState.isRunning, processSymbolLogic]);


  // --- Event Handlers ---
  const toggleBot = () => {
    if (!process.env.API_KEY) {
      alert("Please provide an API Key in the code to run the bot.");
      return;
    }
    
    if (!botState.isRunning) {
      // STARTING
      setBotState(prev => ({ 
        ...prev, 
        isRunning: true,
        statusMessage: "Bot running..." 
      }));
      addLog("System started.", "info");

      // Auto-enable current symbol if not enabled
      setEnabledSymbols(prev => new Set(prev).add(activeSymbol));

      // Immediate Analysis
      addLog(`Starting immediate analysis for ${activeSymbol}...`, "info");
      processSymbolLogic(activeSymbol, false);

    } else {
      // STOPPING
      setBotState(prev => ({ 
        ...prev, 
        isRunning: false,
        statusMessage: "Bot stopped." 
      }));
      addLog("System stopped.", "info");
    }
  };

  const handleRiskUpdate = (newSettings: RiskSettings) => {
    setRiskSettings(prev => ({
      ...prev,
      [activeSymbol]: newSettings
    }));
  };

  const currentAnalysis = analyses[activeSymbol];

  // Asset Categories for Selector
  const ASSET_GROUPS = [
    {
      name: "Global Crypto",
      icon: Coins,
      symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD'] as Symbol[]
    },
    {
      name: "Forex & US Stocks",
      icon: Globe,
      symbols: ['XAUUSD', 'EURUSD', 'GBPUSD', 'US500', 'US100', 'TSLA', 'NVDA'] as Symbol[]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-10">
      
      <WalletModal 
        isOpen={walletModal.isOpen} 
        type={walletModal.type} 
        currentBalance={botState.balance} 
        onClose={() => setWalletModal(prev => ({ ...prev, isOpen: false }))} 
        onConfirm={handleWalletConfirm} 
      />

      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            {/* Logo removed as requested */}
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Nebulamarket
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
             
             {/* Wallet Controls */}
             <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
               <button 
                onClick={() => setWalletModal({ isOpen: true, type: 'deposit' })}
                className="px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-500/10 rounded-md flex items-center gap-1 transition-colors"
               >
                 <ArrowDownCircle size={14} /> Deposit
               </button>
               <div className="w-px h-4 bg-slate-800 mx-1"></div>
               <button 
                onClick={() => setWalletModal({ isOpen: true, type: 'withdraw' })}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-md flex items-center gap-1 transition-colors hover:text-white"
               >
                 <ArrowUpCircle size={14} /> Withdraw
               </button>
             </div>

             <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-900 py-1 px-3 rounded-full border border-slate-800">
                <span className={`w-2 h-2 rounded-full ${botState.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span>{botState.isRunning ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}</span>
             </div>

             <div className="flex items-center gap-2">
                {/* Manual Analyze Button */}
                <button
                  onClick={() => processSymbolLogic(activeSymbol, true)}
                  disabled={isAnalyzing}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ScanEye size={18} className={isAnalyzing ? "animate-spin" : ""} />
                  <span>{isAnalyzing ? "SCANNING..." : "ANALYZE NOW"}</span>
                </button>

                {/* Start/Stop Bot Button */}
                <button
                  onClick={toggleBot}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${
                    botState.isRunning 
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                      : 'bg-green-500 text-slate-950 hover:bg-green-400 shadow-green-500/20'
                  }`}
                >
                  {botState.isRunning ? <><Pause size={18} /><span>STOP BOT</span></> : <><Play size={18} /><span>START BOT</span></>}
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 space-y-6 mt-4">
        
        {/* Warning Banner */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg flex items-center space-x-3 text-sm text-yellow-500">
            <ShieldAlert size={18} />
            <p>{SIMULATION_DISCLAIMER} (Chart Prices are Real-Time)</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Account Balance" 
            value={`$${botState.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
            icon={Wallet} 
            trend="neutral"
          />
           <StatsCard 
            title="Equity" 
            value={`$${botState.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} 
            icon={TrendingUp} 
            trend={botState.equity >= botState.balance ? 'up' : 'down'}
          />
          <StatsCard 
            title={`${activeSymbol} Price`} 
            value={`$${prices[activeSymbol]?.toLocaleString()}`} 
            subtext="Live Market Data"
            icon={Activity} 
          />
           <StatsCard 
            title="Active Bot Pairs" 
            value={enabledSymbols.size.toString()} 
            subtext={botState.isRunning ? "Scanning Active..." : "Ready"}
            icon={Newspaper} 
          />
        </div>

        {/* Asset Selector Section */}
        <div className="space-y-4">
          {ASSET_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <group.icon size={12} /> {group.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.symbols.map((sym) => (
                  <div 
                    key={sym}
                    onClick={() => setActiveSymbol(sym)}
                    className={`relative cursor-pointer group flex items-center gap-3 px-4 py-2 rounded-lg border transition-all ${
                      activeSymbol === sym 
                        ? 'bg-slate-800 border-blue-500/50 shadow-md shadow-blue-500/10' 
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${activeSymbol === sym ? 'text-blue-400' : 'text-slate-300'}`}>
                        {ASSETS[sym].NAME}
                      </span>
                      <span className="text-[10px] text-slate-500">{sym}</span>
                    </div>
                    
                    {/* Bot Toggle Switch */}
                    <button
                      onClick={(e) => toggleSymbolTrading(e, sym)}
                      title={enabledSymbols.has(sym) ? "Disable Bot Trading" : "Enable Bot Trading"}
                      className={`ml-2 p-1.5 rounded-full transition-colors ${
                        enabledSymbols.has(sym) 
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                          : 'bg-slate-700 text-slate-500 hover:bg-slate-600'
                      }`}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Chart & Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Chart & Logs */}
          <div className="lg:col-span-2 space-y-6">
            <TradingViewWidget symbol={activeSymbol} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RiskPanel 
                symbol={activeSymbol}
                settings={riskSettings[activeSymbol]} 
                onUpdate={handleRiskUpdate} 
                balance={botState.balance}
                onManualTrade={handleManualOpen}
              />
              <BotActivityLog logs={logs} />
            </div>
          </div>

          {/* Right Column: Analysis & Sources */}
          <div className="space-y-6 flex flex-col h-full">
            {/* AI Insight Card */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg">
              <h3 className="text-slate-100 font-semibold mb-3 flex items-center gap-2">
                <Cpu size={16} className="text-purple-400"/> Gemini Insight ({activeSymbol})
              </h3>
              {currentAnalysis ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                     <div className={`text-3xl font-bold font-mono ${
                        currentAnalysis.decision === 'BUY' ? 'text-green-500' : 
                        currentAnalysis.decision === 'SELL' ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {currentAnalysis.decision}
                     </div>
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                        currentAnalysis.sentimentCategory === 'POSITIVE' ? 'bg-green-500/20 text-green-400' :
                        currentAnalysis.sentimentCategory === 'NEGATIVE' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                     }`}>
                       {currentAnalysis.sentimentCategory}
                     </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-700/30 p-3 rounded-lg">
                    "{currentAnalysis.reasoning}"
                  </p>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-sm italic gap-2 text-center p-4">
                  <BarChart3 size={24} className="opacity-50" />
                  <p>Click "Analyze Now" to get instant insights or start the bot.</p>
                </div>
              )}
            </div>

            {/* News Sources List */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-lg h-[300px] overflow-hidden flex flex-col">
              <h3 className="text-slate-100 font-semibold mb-3 flex items-center gap-2">
                <Newspaper size={16} className="text-blue-400"/> Live Sources ({activeSymbol})
              </h3>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-2">
                {currentAnalysis?.sources && currentAnalysis.sources.length > 0 ? (
                  currentAnalysis.sources.map((source: NewsSource, idx: number) => (
                    <a 
                      key={idx} 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-700/50 group"
                    >
                      <p className="text-xs font-medium text-slate-300 group-hover:text-blue-300 truncate mb-1">
                        {source.title}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {new URL(source.url).hostname}
                      </p>
                    </a>
                  ))
                ) : (
                  <div className="text-center text-slate-600 text-xs py-10">
                    Waiting for analysis...
                  </div>
                )}
              </div>
            </div>

            {/* Economic Calendar Widget (New) */}
            <EconomicCalendarWidget />
          </div>
        </div>

        {/* Trades Table Area */}
        <div className="grid grid-cols-1 gap-6">
            <OpenTradesPanel 
              trades={trades} 
              prices={prices} 
              onCloseTrade={handleManualClose}
              onUpdateTrade={handleUpdateTrade}
            />
            <div className="h-[300px]">
                <TradeLog trades={trades} />
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;
