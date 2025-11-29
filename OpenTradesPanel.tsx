
import React, { useState } from 'react';
import { Trade, TradeType, Symbol } from '../types';
import { TrendingUp, TrendingDown, Activity, XCircle, Pencil, Check, X } from 'lucide-react';

interface OpenTradesPanelProps {
  trades: Trade[];
  prices: Record<Symbol, number>;
  onCloseTrade: (tradeId: string) => void;
  onUpdateTrade: (tradeId: string, newSL: number, newTP: number) => void;
}

const TradeRow: React.FC<{ 
  trade: Trade; 
  currentPrice: number; 
  isProfit: boolean; 
  onClose: () => void;
  onUpdate: (id: string, sl: number, tp: number) => void;
}> = ({ trade, currentPrice, isProfit, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [sl, setSl] = useState<string>(trade.stopLoss.toString());
  const [tp, setTp] = useState<string>(trade.takeProfit?.toString() || '');

  const handleSave = () => {
    const numSL = parseFloat(sl);
    const numTP = parseFloat(tp);
    if (!isNaN(numSL) && !isNaN(numTP)) {
      onUpdate(trade.id, numSL, numTP);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setSl(trade.stopLoss.toString());
    setTp(trade.takeProfit?.toString() || '');
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors flex flex-col md:flex-row md:justify-between md:items-center gap-3">
      
      {/* Basic Info */}
      <div className="flex flex-col gap-1 min-w-[150px]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-200 text-sm">{trade.symbol}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${trade.type === TradeType.BUY ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {trade.type}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            #{trade.id.slice(0,4)}
          </span>
        </div>
        <div className="flex gap-3 text-[11px] text-slate-400 font-mono">
           <span className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">Entry</span>
              <span className="text-slate-300">{trade.entryPrice.toFixed(2)}</span>
          </span>
          <span className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">Current</span>
              <span className={isProfit ? 'text-green-300/80' : 'text-red-300/80'}>
                   {currentPrice.toFixed(2)}
              </span>
          </span>
           <span className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase">Size</span>
              <span className="text-slate-300">{trade.lotSize.toFixed(2)} Lots</span>
          </span>
        </div>
      </div>

      {/* Editable SL/TP Section */}
      <div className="flex-1 flex items-center gap-4 bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
        {!isEditing ? (
          <>
            <div className="flex gap-4 flex-1">
              <div className="flex flex-col">
                 <span className="text-[9px] text-red-400/70 uppercase font-bold">Stop Loss</span>
                 <span className="text-xs text-slate-300 font-mono">{trade.stopLoss.toFixed(2)}</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] text-green-400/70 uppercase font-bold">Take Profit</span>
                 <span className="text-xs text-slate-300 font-mono">{trade.takeProfit?.toFixed(2) || '---'}</span>
              </div>
            </div>
            <button 
               onClick={() => setIsEditing(true)}
               className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
               title="Edit SL/TP"
            >
              <Pencil size={14} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <div className="flex flex-col flex-1">
                <label className="text-[9px] text-red-400 uppercase">SL</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-1 text-xs text-slate-200 h-6"
                />
            </div>
            <div className="flex flex-col flex-1">
                <label className="text-[9px] text-green-400 uppercase">TP</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-1 text-xs text-slate-200 h-6"
                />
            </div>
            <div className="flex items-end gap-1 pb-0.5">
               <button onClick={handleSave} className="p-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded"><Check size={14} /></button>
               <button onClick={handleCancel} className="p-1 bg-slate-700 text-slate-400 hover:bg-slate-600 rounded"><X size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* PnL & Close */}
      <div className="flex items-center gap-4 justify-between md:justify-end min-w-[120px]">
        <div className="text-right">
          <div className={`font-mono font-bold text-lg ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
            {isProfit ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
             USD
          </div>
        </div>
        
        <button 
          onClick={onClose}
          title="Close Position"
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"
        >
          <XCircle size={20} />
        </button>
      </div>
    </div>
  );
}

const OpenTradesPanel: React.FC<OpenTradesPanelProps> = ({ trades, prices, onCloseTrade, onUpdateTrade }) => {
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const netPnL = openTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col overflow-hidden mb-6">
      {/* Header with Net PnL */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-400" />
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Live Positions</h2>
          <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
            {openTrades.length} Active
          </span>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border ${netPnL >= 0 ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          <span className="text-xs text-slate-400 font-medium">Net PnL:</span>
          <span className="font-mono font-bold text-lg flex items-center">
            {netPnL >= 0 ? <TrendingUp size={16} className="mr-1"/> : <TrendingDown size={16} className="mr-1"/>}
            {netPnL >= 0 ? '+' : ''}{netPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Trades List */}
      <div className="overflow-y-auto max-h-[300px] p-3 space-y-2 custom-scrollbar bg-slate-800">
        {openTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
            <Activity size={24} className="opacity-20" />
            <span className="text-sm italic">No active trades running.</span>
          </div>
        ) : (
          openTrades.map(trade => (
             <TradeRow 
                key={trade.id}
                trade={trade}
                currentPrice={prices[trade.symbol] || trade.entryPrice}
                isProfit={(trade.pnl || 0) >= 0}
                onClose={() => onCloseTrade(trade.id)}
                onUpdate={onUpdateTrade}
             />
          ))
        )}
      </div>
    </div>
  );
};

export default OpenTradesPanel;
