/**
 * StatusProgress - Shows progress toward next verification level
 * 
 * A visual progress bar with tier information.
 * Great for profile pages and post-event summaries.
 */

import React from 'react';
import { GolferProfile } from '../../state/types';
import { getStatusDisplay, getProgressToNextTier } from '../../utils/verifiedStatus';

interface StatusProgressProps {
  profile: GolferProfile | undefined;
  showTierInfo?: boolean;
  compact?: boolean;
  className?: string;
  onShowAllLevels?: () => void;
}

export const StatusProgress: React.FC<StatusProgressProps> = ({
  profile,
  showTierInfo = true,
  compact = false,
  className = '',
  onShowAllLevels
}) => {
  const { tier, verifiedRounds } = getStatusDisplay(profile);
  const progress = getProgressToNextTier(verifiedRounds);
  const isManualTier = !!tier.isManualOnly;
  const nextTier = progress.nextTier;
  const showProgressToNext = !isManualTier && nextTier !== null;
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-lg">{tier.emoji}</span>
        <div className="flex-1">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${tier.badgeColor} transition-all duration-500`}
              style={{ width: `${showProgressToNext ? progress.progressPercent : 100}%` }}
            />
          </div>
        </div>
        {showProgressToNext && (
          <span className="text-xs text-gray-500">{progress.roundsToNext} to go</span>
        )}
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {/* Current Tier Header */}
      <div className={`${tier.badgeColor} px-4 py-3 text-white`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{tier.emoji}</span>
          <div className="flex-1">
            <div className="font-bold text-lg">{tier.name}</div>
            <div className="text-xs opacity-90">Level {tier.level} • {verifiedRounds} verified rounds</div>
          </div>
        </div>
      </div>
      
      {/* Progress Section */}
      <div className="p-4">
        {showProgressToNext ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Next:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {nextTier.emoji} {nextTier.name}
                </span>
              </div>
              <span className="text-sm text-gray-600">
                {progress.roundsToNext} rounds to go
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div 
                className={`h-full ${tier.badgeColor} transition-all duration-500 ease-out`}
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-500">
              {progress.progressPercent}% complete • Play verified events to level up
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <div className="text-2xl mb-1">👑</div>
            <p className="text-sm font-semibold text-gray-900">
              {isManualTier ? 'Founder Status Active' : 'Maximum Level Achieved!'}
            </p>
            <p className="text-xs text-gray-500">
              {isManualTier ? 'Reserved manual assignment' : "You've reached legendary status"}
            </p>
          </div>
        )}
        
        {/* Tier Info */}
        {showTierInfo && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 mb-3">{tier.description}</p>
            
            {tier.perks.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Your Perks
                </div>
                <div className="space-y-1">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span className="text-gray-700">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* View All Levels Link */}
            {onShowAllLevels && (
              <button
                onClick={onShowAllLevels}
                className="mt-4 w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center gap-1.5 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                View All Status Levels
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusProgress;
