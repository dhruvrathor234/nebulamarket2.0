
import React, { useState, useEffect } from 'react';
import { Settings, Shield, Target, MousePointerClick, TrendingUp, TrendingDown } from 'lucide-react';
import { RiskSettings, Symbol, TradeType } from '../types';
import { ASSETS } from '../constants';

interface RiskPanelProps {
  symbol: Symbol;
  settings: RiskSettings;
  onUpdate: (settings: RiskSettings) => void;
  balance: number;
  onManualTrade: (type: TradeType, lots: number, slDist: number, tpDist: number) => void;
}

const RiskPanel: React.FC<RiskPanelProps> = ({ symbol, settings, onUpdate, balance, onManualTrade }) => {
  
  // Bot Settings Calculations
  const contractSize = ASSETS[symbol].CONTRACT_SIZE;
  const riskAmount = (balance * settings.riskPercentage) / 100;
  const estimatedLotSize = riskAmount / (settings.stopLossDistance * contractSize);

  // Manual Trade State
  const [manualLots, setManualLots] = useState(0.1);
  const [manualSL, setManualSL] = useState(settings.stopLossDistance);
  const [manualTP, setManualTP] = useState(settings.takeProfitDistance);

  // Sync defaults when symbol changes
  useEffect(() => {
    setManualSL(ASSETS[symbol].DEFAULT_STOP_LOSS);
    setManualTP(ASSETS[symbol].DEFAULT_TAKE_PROFIT);
  }, [symbol]);

  const handleChange = (key: keyof RiskSettings, value: number) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg flex flex-col h-full">
      {/* Bot Configuration Section */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center space-x-2 mb-4 text-slate-100 font-semibold">
          <Shield className="text-blue-400" size={18} />
          <h3>AI Bot Configuration ({symbol})</h3>
        </div>

        <div className="space-y-4">
          {/* Risk % */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Risk Per Trade</span>
              <span className="text-blue-400 font-mono">{settings.riskPercentage}% (${riskAmount.toFixed(0)})</span>
            </div>
            <input 
              type="range" min="0.1" max="5" step="0.1"
              value={settings.riskPercentage}
              onChange={(e) => handleChange('riskPercentage', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Bot SL */}
          <div className="space-y-1">
             <div className="flex justify-between text-xs text-slate-400">
              <span>Bot Stop Loss</span>
              <span className="text-red-400 font-mono">{settings.stopLossDistance} pts</span>
            </div>
            <input 
              type="range" min="0.1" max={symbol === 'BTCUSD' ? 2000 : 100} step="0.1"
              value={settings.stopLossDistance}
              onChange={(e) => handleChange('stopLossDistance', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* Bot TP */}
          <div className="space-y-1">
             <div className="flex justify-between text-xs text-slate-400">
              <span>Bot Take Profit</span>
              <span className="text-green-400 font-mono">{settings.takeProfitDistance} pts</span>
            </div>
            <input 
              type="range" min="0.1" max={symbol === 'BTCUSD' ? 5000 : 200} step="0.1"
              value={settings.takeProfitDistance}
              onChange={(e) => handleChange('takeProfitDistance', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
          
          <div className="text-[10px] text-slate-500 text-center bg-slate-900/30 p-1.5 rounded">
             Auto Lot: <span className="text-slate-300 font-mono">{estimatedLotSize.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Manual Execution Section */}
      <div className="p-5 flex flex-col justify-between flex-grow bg-slate-800/50">
        <div className="flex items-center space-x-2 mb-3 text-slate-100 font-semibold">
          <MousePointerClick className="text-purple-400" size={18} />
          <h3>Manual Execution</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Lots</label>
                <input 
                   type="number" step="0.01" min="0.01"
                   value={manualLots}
                   onChange={(e) => setManualLots(parseFloat(e.target.value))}
                   className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-sm text-center font-mono focus:border-purple-500 outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-red-400 uppercase font-bold">SL (pts)</label>
                <input 
                   type="number" step="0.1"
                   value={manualSL}
                   onChange={(e) => setManualSL(parseFloat(e.target.value))}
                   className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-sm text-center font-mono focus:border-red-500 outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-green-400 uppercase font-bold">TP (pts)</label>
                <input 
                   type="number" step="0.1"
                   value={manualTP}
                   onChange={(e) => setManualTP(parseFloat(e.target.value))}
                   className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-sm text-center font-mono focus:border-green-500 outline-none"
                />
             </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
             <button 
               onClick={() => onManualTrade(TradeType.BUY, manualLots, manualSL, manualTP)}
               className="bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-900/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
             >
               <span className="text-lg leading-none flex items-center gap-1"><TrendingUp size={16}/> BUY</span>
             </button>
             <button 
               onClick={() => onManualTrade(TradeType.SELL, manualLots, manualSL, manualTP)}
               className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-red-900/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
             >
               <span className="text-lg leading-none flex items-center gap-1"><TrendingDown size={16}/> SELL</span>
             </button>
        </div>
      </div>
    </div>
  );
};

export default RiskPanel;
