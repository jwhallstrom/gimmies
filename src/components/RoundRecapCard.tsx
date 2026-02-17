/**
 * RoundRecapCard — Displays round highlights grouped by category
 *
 * Sections: Scoring · Highlights · Course Analysis · Money
 * Each highlight is expandable to show detail rows when available.
 * Supports compact mode (top 4 highlights, no sections) for inline previews.
 */

import React, { useState, useCallback } from 'react';
import type {
  RoundRecap,
  RoundRecapHighlight,
  HighlightCategory,
} from '../utils/roundRecap';
import { shareRecapImage } from '../utils/shareRecap';

interface Props {
  recap: RoundRecap;
  compact?: boolean;
  onShare?: () => void;
}

// ── Colour palette per highlight type ────────────────────────────────────────

const highlightColors: Record<
  string,
  { bg: string; border: string; text: string; darkBg: string; darkBorder: string; darkText: string }
> = {
  low_score:       { bg: 'bg-yellow-50',  border: 'border-yellow-200',  text: 'text-yellow-800',  darkBg: 'dark:bg-yellow-900/20',  darkBorder: 'dark:border-yellow-800',  darkText: 'dark:text-yellow-300' },
  net_winner:      { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   darkBg: 'dark:bg-amber-900/20',   darkBorder: 'dark:border-amber-800',   darkText: 'dark:text-amber-300' },
  vs_handicap:     { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-800',    darkBg: 'dark:bg-cyan-900/20',    darkBorder: 'dark:border-cyan-800',    darkText: 'dark:text-cyan-300' },
  front_back:      { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-800',   darkBg: 'dark:bg-slate-800/30',   darkBorder: 'dark:border-slate-700',   darkText: 'dark:text-slate-300' },
  aces:            { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-800',  darkBg: 'dark:bg-purple-900/20',  darkBorder: 'dark:border-purple-800',  darkText: 'dark:text-purple-300' },
  eagles:          { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    darkBg: 'dark:bg-blue-900/20',    darkBorder: 'dark:border-blue-800',    darkText: 'dark:text-blue-300' },
  birdies:         { bg: 'bg-green-50',   border: 'border-green-200',   text: 'text-green-800',   darkBg: 'dark:bg-green-900/20',   darkBorder: 'dark:border-green-800',   darkText: 'dark:text-green-300' },
  pars_streak:     { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-800',  darkBg: 'dark:bg-orange-900/20',  darkBorder: 'dark:border-orange-800',  darkText: 'dark:text-orange-300' },
  hole_difficulty: { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800',  darkBg: 'dark:bg-indigo-900/20',  darkBorder: 'dark:border-indigo-800',  darkText: 'dark:text-indigo-300' },
  par_performance: { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-800',    darkBg: 'dark:bg-teal-900/20',    darkBorder: 'dark:border-teal-800',    darkText: 'dark:text-teal-300' },
  scoring_dist:    { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-800',  darkBg: 'dark:bg-violet-900/20',  darkBorder: 'dark:border-violet-800',  darkText: 'dark:text-violet-300' },
  money_winner:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', darkBg: 'dark:bg-emerald-900/20', darkBorder: 'dark:border-emerald-800', darkText: 'dark:text-emerald-300' },
  skins:           { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', darkBg: 'dark:bg-emerald-900/20', darkBorder: 'dark:border-emerald-800', darkText: 'dark:text-emerald-300' },
  team_winner:     { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-800',  darkBg: 'dark:bg-indigo-900/20',  darkBorder: 'dark:border-indigo-800',  darkText: 'dark:text-indigo-300' },
  game_highlight:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', darkBg: 'dark:bg-emerald-900/20', darkBorder: 'dark:border-emerald-800', darkText: 'dark:text-emerald-300' },
  high_score:      { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-700',    darkBg: 'dark:bg-gray-800/30',    darkBorder: 'dark:border-gray-700',    darkText: 'dark:text-gray-400' },
};

const defaultColors = highlightColors.low_score;

const categoryMeta: Record<HighlightCategory, { label: string; icon: string }> = {
  scoring:    { label: 'Scoring',         icon: '🏆' },
  highlights: { label: 'Highlights',      icon: '⭐' },
  analysis:   { label: 'Course Analysis', icon: '📊' },
  money:      { label: 'Money',           icon: '💰' },
};

const CATEGORY_ORDER: HighlightCategory[] = ['scoring', 'highlights', 'analysis', 'money'];

// ── Sub-components ───────────────────────────────────────────────────────────

const HighlightRow: React.FC<{
  highlight: RoundRecapHighlight;
  compact: boolean;
}> = ({ highlight, compact }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = highlightColors[highlight.type] || defaultColors;
  const hasDetails = highlight.details && highlight.details.length > 0;

  return (
    <div
      className={`${colors.bg} ${colors.darkBg} ${colors.border} ${colors.darkBorder} border rounded-lg transition-all ${
        compact ? 'p-2' : 'p-3'
      } ${hasDetails ? 'cursor-pointer' : ''}`}
      onClick={() => hasDetails && setExpanded((prev) => !prev)}
      role={hasDetails ? 'button' : undefined}
      tabIndex={hasDetails ? 0 : undefined}
      onKeyDown={
        hasDetails
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpanded((prev) => !prev);
              }
            }
          : undefined
      }
    >
      {/* Main row */}
      <div className="flex items-start gap-3">
        <span className={compact ? 'text-lg' : 'text-2xl'}>{highlight.emoji}</span>
        <div className="flex-1 min-w-0">
          <div
            className={`font-semibold ${colors.text} ${colors.darkText} ${
              compact ? 'text-sm' : ''
            }`}
          >
            {highlight.title}
          </div>
          <div
            className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            {highlight.description}
          </div>
        </div>
        {hasDetails && !compact && (
          <svg
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 mt-1 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>

      {/* Expandable detail rows */}
      {expanded && hasDetails && !compact && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
          {highlight.details!.map((d, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">{d.label}</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Card ────────────────────────────────────────────────────────────────

const RoundRecapCard: React.FC<Props> = ({ recap, compact = false, onShare }) => {
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }
    setSharing(true);
    try {
      await shareRecapImage(recap);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  }, [onShare, recap]);

  if (!recap.highlights.length) return null;

  // ─── Compact mode: flat list of top highlights ───
  if (compact) {
    const shown = recap.highlights.slice(0, 4);
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-2.5 text-white flex items-center gap-2">
          <span className="text-lg">🏁</span>
          <h3 className="font-bold text-sm">Round Recap</h3>
        </div>
        <div className="p-3 space-y-2">
          {shown.map((h, i) => (
            <HighlightRow key={i} highlight={h} compact />
          ))}
          {recap.highlights.length > 4 && (
            <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-1">
              +{recap.highlights.length - 4} more highlights
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Full mode: grouped by category with section headers ───
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    meta: categoryMeta[cat],
    items: recap.highlights.filter((h) => h.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏁</span>
            <div>
              <h3 className="font-bold">Round Recap</h3>
              <p className="text-xs text-primary-200">
                {recap.courseName} &middot;{' '}
                {new Date(recap.date).toLocaleDateString()}
                {recap.coursePar ? ` · Par ${recap.coursePar}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Share recap"
          >
            {sharing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Grouped highlights */}
      <div className="p-4 space-y-5">
        {grouped.map((group) => (
          <div key={group.category}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{group.meta.icon}</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {group.meta.label}
              </h4>
            </div>
            <div className="space-y-2">
              {group.items.map((h, i) => (
                <HighlightRow key={i} highlight={h} compact={false} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoundRecapCard;
