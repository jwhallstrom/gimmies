import React from 'react';
import { createPortal } from 'react-dom';
import CourseStatsPanel, { type CourseStatsPlayer } from './CourseStatsPanel';

type HoleMeta = { number: number; par?: number };

interface EventCourseStatsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  event: { scorecards: Array<{ scores?: Array<{ hole: number; strokes?: number | null }> }> };
  holes: HoleMeta[];
  holeParByNumber: Record<number, number>;
  playersWithScores: CourseStatsPlayer[];
  totalPar: number | null;
}

const EventCourseStatsSheet: React.FC<EventCourseStatsSheetProps> = ({
  isOpen,
  onClose,
  event,
  holes,
  holeParByNumber,
  playersWithScores,
  totalPar,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close course stats"
        onClick={onClose}
      />
      <div
        className="relative mx-auto w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-slate-50 dark:from-emerald-900/20 dark:to-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              📊
            </span>
            <div className="font-bold text-sm text-gray-900 dark:text-white">Hole-by-Hole Stats</div>
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

        <div className="max-h-[min(72vh,640px)] overflow-y-auto">
          <CourseStatsPanel
            event={event}
            holes={holes}
            holeParByNumber={holeParByNumber}
            playersWithScores={playersWithScores}
            totalPar={totalPar}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EventCourseStatsSheet;
