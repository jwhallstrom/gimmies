import React from 'react';
import { createPortal } from 'react-dom';
import type { GameMoneyLine } from '../../hooks/useMyEventPayout';
import { formatSignedMoney } from '../../hooks/useMyEventPayout';

interface EventPayoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullPayouts?: () => void;
  myNet: number;
  myBuyin: number;
  myWinnings: number;
  buyinBreakdown: GameMoneyLine[];
  winningsBreakdown: GameMoneyLine[];
}

const EventPayoutSheet: React.FC<EventPayoutSheetProps> = ({
  isOpen,
  onClose,
  onOpenFullPayouts,
  myNet,
  myBuyin,
  myWinnings,
  buyinBreakdown,
  winningsBreakdown,
}) => {
  if (!isOpen) return null;

  const netColor =
    myNet > 0 ? 'text-green-600' : myNet < 0 ? 'text-red-600' : 'text-gray-700';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close payouts"
        onClick={onClose}
      />
      <div
        className="relative mx-auto w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>💰</span>
            <div className="font-bold text-sm text-gray-900 dark:text-white">Your Game $</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-500"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="text-center py-2">
            <div className={`text-3xl font-black tabular-nums ${netColor}`}>
              {formatSignedMoney(myNet)}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Net so far (live estimate)</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-center border border-slate-100 dark:border-slate-700">
              <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                ${myWinnings.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Winnings</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-center border border-slate-100 dark:border-slate-700">
              <div className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                ${myBuyin.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Buy-in</div>
            </div>
          </div>

          {winningsBreakdown.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">By game</div>
              <div className="space-y-1">
                {winningsBreakdown.map((line) => (
                  <div key={line.name} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <span className="text-gray-700 dark:text-slate-300">{line.name}</span>
                    <span className={`font-mono font-bold tabular-nums ${
                      line.amount > 0 ? 'text-green-600' : line.amount < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {formatSignedMoney(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {buyinBreakdown.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Buy-ins</div>
              <div className="space-y-1">
                {buyinBreakdown.map((line) => (
                  <div key={line.name} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-gray-600 dark:text-slate-400">{line.name}</span>
                    <span className="font-mono text-gray-800 dark:text-slate-200 tabular-nums">${line.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {onOpenFullPayouts && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullPayouts();
              }}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
            >
              Open full games & payouts →
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default EventPayoutSheet;
