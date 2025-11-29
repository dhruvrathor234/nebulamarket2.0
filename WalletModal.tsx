
import React, { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  type: 'deposit' | 'withdraw';
  currentBalance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, type, currentBalance, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (type === 'withdraw' && val > currentBalance) {
      setError('Insufficient funds');
      return;
    }
    onConfirm(val);
    setAmount('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-3 rounded-full ${type === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {type === 'deposit' ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 capitalize">{type} Funds</h2>
            <p className="text-sm text-slate-400">Current Balance: ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-8 pr-4 text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.00"
                step="0.01"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
            >
                Cancel
            </button>
            <button
                type="submit"
                className={`flex-1 py-2.5 rounded-lg font-bold transition-all text-white shadow-lg ${
                type === 'deposit' 
                    ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' 
                    : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                }`}
            >
                Confirm {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WalletModal;
    