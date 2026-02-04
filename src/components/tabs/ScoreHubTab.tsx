/**
 * ScoreHubTab - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Cleaner toggle between Leaders/Score
 * - Better visual hierarchy
 * - Quick action buttons that are obvious
 * - Mobile-first with large tap targets
 * - Orange FAB with action sheet (matches home page)
 * - Save feedback with Done button
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../state/store';
import LeaderboardTab from './LeaderboardTab';
import ScorecardTab from './ScorecardTab';

type Props = { eventId: string };

const ScoreHubTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const currentProfile = useStore((s: any) => s.currentProfile);
  const setScorecardView = useStore((s: any) => s.setScorecardView);

  const [focusGolferId, setFocusGolferId] = useState<string | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [entryMode, setEntryMode] = useState<'cards' | 'team'>('cards');

  const isOwner = Boolean(currentProfile && event && event.ownerProfileId === currentProfile.id);

  // Find current user's team members for team scoring
  const myTeamGolferIds = useMemo(() => {
    if (!event || !currentProfile) return new Set<string>();
    const teams = (event.games?.nassau || []).flatMap((n: any) => n.teams || []);
    const mine = teams.filter((t: any) => (t.golferIds || []).includes(currentProfile.id));
    return new Set<string>(mine.flatMap((t: any) => t.golferIds || []));
  }, [event?.id, event?.lastModified, currentProfile?.id]);

  if (!event) return null;

  // Calculate scoring progress (compact)
  const scoringProgress = useMemo(() => {
    const total = event.golfers.length;
    const complete = event.scorecards.filter((sc: any) => sc.scores.length >= 18).length;
    return { total, complete };
  }, [event.golfers.length, event.scorecards]);

  const handleEnterScores = (golferId: string, mode: 'cards' | 'team' = 'cards') => {
    // Set appropriate scorecard view based on permissions
    if (isOwner) {
      setScorecardView(eventId, 'admin');
    } else if (currentProfile) {
      if (myTeamGolferIds.has(golferId)) {
        setScorecardView(eventId, 'team');
      } else {
        setScorecardView(eventId, 'individual');
      }
    }

    setEntryMode(mode);
    setFocusGolferId(golferId);
  };

  // Check if user is on a team (for showing team entry option)
  const hasTeam = myTeamGolferIds.size > 1;

  // Find the next hole to enter for quick entry hint
  const nextHole = useMemo(() => {
    if (!currentProfile || !event) return 1;
    const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile.id);
    if (!myScorecard) return 1;
    const firstEmpty = myScorecard.scores.find((s: any) => s.strokes == null);
    return firstEmpty ? firstEmpty.hole : 18;
  }, [event?.scorecards, currentProfile?.id]);

  return (
    <div>
      {/* Score entry view (when user taps a player or uses quick action) */}
      {focusGolferId ? (
        <ScorecardTab 
          eventId={eventId} 
          focusGolferId={focusGolferId} 
          initialEntryMode={entryMode}
          onDone={() => setFocusGolferId(null)}
        />
      ) : (
        <div className="relative">
          <LeaderboardTab eventId={eventId} onEnterScores={handleEnterScores} />

          {/* Orange FAB - matches home page design */}
          {!event.isCompleted && currentProfile && (
            <button
              onClick={() => setShowFabMenu(true)}
              className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
              title="Score actions"
              aria-label="Score actions"
            >
              <span className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`}>+</span>
            </button>
          )}

          {/* FAB Action Sheet */}
          {showFabMenu && createPortal(
            <div 
              className="fixed inset-0 z-50 flex items-end justify-center"
              onClick={() => setShowFabMenu(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              
              {/* Action Sheet */}
              <div 
                className="relative w-full max-w-md mx-4 mb-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
              >
                {/* My Score - Primary action */}
                <button
                  onClick={() => { 
                    setShowFabMenu(false); 
                    handleEnterScores(currentProfile.id, 'cards'); 
                  }}
                  className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
                    <span className="text-2xl">🏌️</span>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg text-gray-900">My Scorecard</div>
                    <div className="text-sm text-gray-500">
                      Enter your score • Hole {nextHole}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Team Scorecard - Only show if on a team */}
                {hasTeam && (
                  <button
                    onClick={() => { 
                      setShowFabMenu(false); 
                      handleEnterScores(currentProfile.id, 'team'); 
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
                      <span className="text-2xl">👥</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-lg text-gray-900">Team Entry</div>
                      <div className="text-sm text-gray-500">
                        Enter scores for your team • {myTeamGolferIds.size} players
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Admin: All Players - Only for event owner */}
                {isOwner && (
                  <button
                    onClick={() => { 
                      setShowFabMenu(false);
                      setScorecardView(eventId, 'admin');
                      handleEnterScores(currentProfile.id, 'cards'); 
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
                      <span className="text-2xl">📋</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-lg text-gray-900">All Scorecards</div>
                      <div className="text-sm text-gray-500">Admin: Edit any player's score</div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Cancel */}
                <button
                  onClick={() => setShowFabMenu(false)}
                  className="w-full p-4 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 transition"
                >
                  <span className="font-bold text-gray-500">Cancel</span>
                </button>
              </div>
            </div>,
            document.body
          )}

          {/* Optional tiny progress (non-blocking) */}
          {scoringProgress.total > 0 && (
            <div className="fixed left-4 bottom-24 z-30 text-[11px] text-slate-500 bg-white/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
              {scoringProgress.complete}/{scoringProgress.total} complete
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScoreHubTab;
