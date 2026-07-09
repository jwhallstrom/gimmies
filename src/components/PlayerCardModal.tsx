import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import StatusLevelsInfo from './verified/StatusLevelsInfo';
import type { StatusTier } from '../state/types';
import { getProgressToNextTier } from '../utils/verifiedStatus';

export interface PlayerCardData {
  id: string;
  name: string;
  avatar?: string;
  hasProfile: boolean;
  profileId?: string;
  handicap?: number | null;
  roundsPlayed?: number;
  homeCourse?: string;
  statusTier?: StatusTier;
  verifiedStatus?: {
    statusLevel: number;
    verifiedRounds: number;
    badges?: string[];
  };
}

interface PlayerCardModalProps {
  player: PlayerCardData;
  onClose: () => void;
}

const PlayerCardModal: React.FC<PlayerCardModalProps> = ({ player, onClose }) => {
  const navigate = useNavigate();
  const [showStatusLevels, setShowStatusLevels] = useState(false);
  const verifiedRounds = player.verifiedStatus?.verifiedRounds || 0;
  const progress = getProgressToNextTier(verifiedRounds);
  const nextTierRequirement = progress.nextTier ? `${progress.nextTier.minRounds} verified rounds for ${progress.nextTier.name}` : null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-6 pt-6 pb-8 text-center relative ${player.statusTier?.badgeColor || 'bg-gray-500'}`}>
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-white border-4 border-white/30 mb-3">
              {player.avatar ? (
                <img src={player.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                player.name.charAt(0).toUpperCase()
              )}
            </div>

            <h3 className="text-xl font-bold text-white">{player.name}</h3>
            {player.hasProfile && player.statusTier && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-lg">{player.statusTier.emoji}</span>
                <span className="text-white/90 text-sm font-medium">{player.statusTier.name}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            {player.hasProfile ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl py-3">
                    <div className="text-xl font-black text-gray-900 dark:text-white">
                      {player.handicap != null ? player.handicap.toFixed(1) : '-'}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase">Handicap</div>
                  </div>
                  <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl py-3">
                    <div className="text-xl font-black text-gray-900 dark:text-white">
                      {player.roundsPlayed || 0}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase">Rounds</div>
                  </div>
                  <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl py-3">
                    <div className="text-xl font-black text-gray-900 dark:text-white">
                      {verifiedRounds}
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium uppercase">Verified</div>
                  </div>
                </div>

                {player.homeCourse && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 mb-4">
                    <div className="text-[10px] text-gray-500 font-medium uppercase mb-1">Home Course</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{player.homeCourse}</div>
                  </div>
                )}

                {player.statusTier && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Status Progress</span>
                      {(player.statusTier as any).isManualOnly ? (
                        <span className="text-xs text-gray-500">Manual assignment</span>
                      ) : (
                        <span className="text-xs text-gray-500">{verifiedRounds} verified rounds</span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${player.statusTier.badgeColor}`}
                        style={{
                          width: (player.statusTier as any).isManualOnly
                            ? '100%'
                            : `${Math.min(100, progress.progressPercent)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {(player.statusTier as any).isManualOnly || !nextTierRequirement
                        ? player.statusTier.description
                        : `Need ${nextTierRequirement}. ${player.statusTier.description}`}
                    </p>

                    <button
                      onClick={() => setShowStatusLevels(true)}
                      className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      How do status levels work?
                    </button>
                  </div>
                )}

                {player.verifiedStatus?.badges && player.verifiedStatus.badges.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase mb-2">Badges</div>
                    <div className="flex flex-wrap gap-2">
                      {player.verifiedStatus.badges.map((badge: string) => (
                        <span key={badge} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium">
                          Trophy {badge.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">User</div>
                <div className="font-medium text-gray-700 dark:text-gray-300">Guest Player</div>
                <p className="text-sm text-gray-500 mt-1">
                  This player has not created a Gimmies profile yet
                </p>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 space-y-2">
            {player.hasProfile && (
              <button
                onClick={() => {
                  onClose();
                  navigate('/handicap');
                }}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Handicap Tracker
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showStatusLevels && (
        <StatusLevelsInfo
          onClose={() => setShowStatusLevels(false)}
          currentLevel={player.verifiedStatus?.statusLevel || 0}
        />
      )}
    </>,
    document.body
  );
};

export default PlayerCardModal;
