/**
 * StatusLevelsInfo - Gamification status levels explainer
 * 
 * Shows users:
 * - All status tiers and their requirements
 * - How to progress (verified rounds)
 * - Perks at each level
 * - What makes a "verified round"
 * 
 * Common UX pattern from video games: progression system explainer
 */

import React from 'react';
import { STATUS_TIERS } from '../../state/types';

interface Props {
  onClose: () => void;
  currentLevel?: number;
}

const StatusLevelsInfo: React.FC<Props> = ({ onClose, currentLevel = 0 }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-5 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                🏆 Status Levels
              </h2>
              <p className="text-emerald-100 text-sm mt-0.5">
                Your journey through Gimmies status tiers
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* How It Works */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-lg">⚡</span> How It Works
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Play <strong>verified rounds</strong> with other Gimmies users to level up your status. 
              Higher status = more trust in wagering and community recognition.
            </p>
          </div>

          {/* What's a Verified Round */}
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-lg">✓</span> What's a Verified Round?
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Only scores from <strong>Gimmies events</strong> count (not manual handicap entries)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Play with <strong>2+ other Gimmies accounts</strong> (guests don't count)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Event must be <strong>completed and closed</strong> with all scores finalized</span>
              </li>
            </ul>
            <p className="text-xs text-gray-500 mt-3 italic">
              This ensures verified rounds reflect real competitive play with verified golfers.
            </p>
          </div>

          {/* Status Tiers */}
          <div className="px-5 py-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🎖️</span> Status Tiers
            </h3>
            
            <div className="space-y-3">
              {STATUS_TIERS.map((tier, index) => {
                const isCurrentLevel = currentLevel === tier.level;
                const isUnlocked = currentLevel >= tier.level;
                
                return (
                  <div 
                    key={tier.level}
                    className={`rounded-xl border-2 transition-all ${
                      isCurrentLevel 
                        ? 'border-primary-500 bg-primary-50 shadow-md' 
                        : isUnlocked
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-gray-200 bg-white'
                    }`}
                  >
                    {/* Tier Header */}
                    <div className={`px-4 py-3 flex items-center gap-3 ${
                      index < STATUS_TIERS.length - 1 ? 'border-b border-inherit' : ''
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${tier.badgeColor}`}>
                        {tier.emoji}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{tier.name}</span>
                          {isCurrentLevel && (
                            <span className="px-1.5 py-0.5 bg-primary-600 text-white text-[9px] font-bold rounded">
                              YOU
                            </span>
                          )}
                          {isUnlocked && !isCurrentLevel && (
                            <span className="text-green-600 text-xs">✓</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {tier.isManualOnly
                            ? 'Manual assignment only'
                            : tier.minRounds === 0
                              ? `0-${tier.maxRounds} verified rounds`
                              : tier.maxRounds
                                ? `${tier.minRounds}-${tier.maxRounds} verified rounds`
                                : `${tier.minRounds}+ verified rounds`
                          }
                        </div>
                      </div>
                    </div>
                    
                    {/* Description & Perks */}
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-600 mb-2">{tier.description}</p>
                      {tier.perks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {tier.perks.map((perk, i) => (
                            <span 
                              key={i}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                isUnlocked 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {isUnlocked ? '✓ ' : '🔒 '}{perk}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why This Matters */}
          <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
              <span className="text-lg">💡</span> Why Status Matters
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed">
              Higher status builds <strong>trust</strong> in the Gimmies community. 
              When you play money games, opponents know your handicap is backed by 
              real, verified rounds—not sandbagging. It's golf integrity, gamified.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-white border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusLevelsInfo;
