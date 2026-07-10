import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import RoundRecapCard from '../RoundRecapCard';
import type { RoundRecap } from '../../utils/roundRecap';
import { shareRecapImage } from '../../utils/shareRecap';

interface EventHighlightsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recap: RoundRecap;
  isLive?: boolean;
}

const EventHighlightsSheet: React.FC<EventHighlightsSheetProps> = ({
  isOpen,
  onClose,
  recap,
  isLive = true,
}) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      await shareRecapImage(recap);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  }, [recap]);

  if (!isOpen || !recap.highlights.length) return null;

  const title = isLive ? 'Live Highlights' : 'Round Highlights';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close highlights"
        onClick={onClose}
      />
      <div
        className="relative mx-auto w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg" aria-hidden>
              ⭐
            </span>
            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-900 dark:text-white">{title}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {recap.courseName}
                {isLive && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    Updating live
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-500 disabled:opacity-50"
              title="Share highlights"
              aria-label="Share highlights"
            >
              {sharing ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              )}
            </button>
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
        </div>

        <div className="p-3 max-h-[min(72vh,640px)] overflow-y-auto">
          <RoundRecapCard recap={recap} hideHeader showShare={false} variant="feed" />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EventHighlightsSheet;
