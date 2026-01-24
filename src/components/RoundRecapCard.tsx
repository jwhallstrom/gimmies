/**
 * RoundRecapCard - Displays round highlights in a shareable card format
 * 
 * Shows:
 * - Low score
 * - Birdies/Eagles/Aces
 * - Skins
 * - Streaks
 * - Fun stats
 */

import React from 'react';
import type { RoundRecap, RoundRecapHighlight } from '../utils/roundRecap';

interface Props {
  recap: RoundRecap;
  compact?: boolean;
  onShare?: () => void;
}

const highlightColors: Record<string, { bg: string; border: string; text: string }> = {
  low_score: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  aces: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  eagles: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  birdies: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  pars_streak: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  skins: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  team_winner: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800' },
  high_score: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

const RoundRecapCard: React.FC<Props> = ({ recap, compact = false, onShare }) => {
  if (recap.highlights.length === 0) {
    return null;
  }
  
  const displayHighlights = compact ? recap.highlights.slice(0, 3) : recap.highlights;
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏁</span>
            <div>
              <h3 className="font-bold">Round Recap</h3>
              {!compact && (
                <p className="text-xs text-primary-200">
                  {recap.courseName} • {new Date(recap.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Share recap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Highlights */}
      <div className={`p-4 ${compact ? 'space-y-2' : 'space-y-3'}`}>
        {displayHighlights.map((highlight, index) => {
          const colors = highlightColors[highlight.type] || highlightColors.low_score;
          
          return (
            <div 
              key={index}
              className={`${colors.bg} ${colors.border} border rounded-lg ${compact ? 'p-2' : 'p-3'} flex items-start gap-3`}
            >
              <span className={compact ? 'text-lg' : 'text-2xl'}>{highlight.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${colors.text} ${compact ? 'text-sm' : ''}`}>
                  {highlight.title}
                </div>
                <div className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {highlight.description}
                </div>
              </div>
            </div>
          );
        })}
        
        {compact && recap.highlights.length > 3 && (
          <div className="text-center text-sm text-gray-500">
            +{recap.highlights.length - 3} more highlights
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundRecapCard;
