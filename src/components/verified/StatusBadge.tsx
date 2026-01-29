/**
 * StatusBadge - Displays user's verified status tier
 * 
 * A compact badge showing the user's verification level.
 * Tappable to show detailed tooltip/modal on mobile.
 */

import React, { useState } from 'react';
import { GolferProfile, StatusTier } from '../../state/types';
import { getStatusDisplay, getProgressToNextTier } from '../../utils/verifiedStatus';

interface StatusBadgeProps {
  profile: GolferProfile | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  profile,
  size = 'md',
  showLabel = false,
  showTooltip = true,
  className = ''
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const { tier, verifiedRounds } = getStatusDisplay(profile);
  const progress = getProgressToNextTier(verifiedRounds);
  
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  const badgeColors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  
  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => showTooltip && setShowInfo(!showInfo)}
        className={`inline-flex items-center gap-1 rounded-full border font-semibold transition-all ${sizeClasses[size]} ${badgeColors[tier.color]} hover:opacity-90`}
        title={showTooltip ? `${tier.name} - ${verifiedRounds} verified rounds` : undefined}
      >
        <span>{tier.emoji}</span>
        {showLabel && <span>{tier.name}</span>}
      </button>
      
      {/* Tooltip/Info Popover */}
      {showInfo && showTooltip && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowInfo(false)} 
          />
          <div className="absolute z-50 left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className={`px-4 py-3 ${tier.badgeColor} text-white`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{tier.emoji}</span>
                <div>
                  <div className="font-bold">{tier.name}</div>
                  <div className="text-xs opacity-90">Level {tier.level}</div>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">{tier.description}</p>
              
              {/* Progress to next */}
              {progress.nextTier && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress to {progress.nextTier.name}</span>
                    <span>{progress.roundsToNext} rounds to go</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${tier.badgeColor} transition-all`}
                      style={{ width: `${progress.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Stats */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-500">Verified Rounds</span>
                <span className="text-sm font-bold text-gray-900">{verifiedRounds}</span>
              </div>
              
              {/* Perks */}
              {tier.perks.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Perks</div>
                  <div className="flex flex-wrap gap-1">
                    {tier.perks.map((perk, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                        {perk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">
                Play events with friends to increase your verified status
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatusBadge;
