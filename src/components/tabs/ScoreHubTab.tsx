/**
 * ScoreHubTab - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Cleaner toggle between Leaders/Score
 * - Better visual hierarchy
 * - Quick action buttons that are obvious
 * - Mobile-first with large tap targets
 */

import React, { useMemo, useState } from 'react';
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

  const handleEnterScores = (golferId: string) => {
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

    setFocusGolferId(golferId);
  };

  return (
    <div>
      {/* Score entry view (when user taps a player or uses quick action) */}
      {focusGolferId ? (
        <>
          <button
            onClick={() => setFocusGolferId(null)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Leaderboard
          </button>
          <ScorecardTab eventId={eventId} focusGolferId={focusGolferId} initialEntryMode="cards" />
        </>
      ) : (
        <div className="relative">
          <LeaderboardTab eventId={eventId} onEnterScores={handleEnterScores} />

          {/* Floating action: enter my score (pencil) */}
          {!event.isCompleted && currentProfile && (
            <button
              onClick={() => handleEnterScores(currentProfile.id)}
              className="fixed right-4 bottom-24 z-40 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-200 hover:bg-primary-700 transition-colors flex items-center justify-center"
              title="Enter my score"
              aria-label="Enter my score"
            >
              <span className="text-2xl leading-none" aria-hidden="true">✏️</span>
            </button>
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
