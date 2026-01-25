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
type Mode = 'leaders' | 'scorecards';

const ScoreHubTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const currentProfile = useStore((s: any) => s.currentProfile);
  const setScorecardView = useStore((s: any) => s.setScorecardView);

  const [mode, setMode] = useState<Mode>('leaders');
  const [focusGolferId, setFocusGolferId] = useState<string | null>(null);
  const [scoreEntryMode, setScoreEntryMode] = useState<'cards' | 'team'>('cards');

  const isOwner = Boolean(currentProfile && event && event.ownerProfileId === currentProfile.id);

  // Find current user's team members for team scoring
  const myTeamGolferIds = useMemo(() => {
    if (!event || !currentProfile) return new Set<string>();
    const teams = (event.games?.nassau || []).flatMap((n: any) => n.teams || []);
    const mine = teams.filter((t: any) => (t.golferIds || []).includes(currentProfile.id));
    return new Set<string>(mine.flatMap((t: any) => t.golferIds || []));
  }, [event?.id, event?.lastModified, currentProfile?.id]);

  if (!event) return null;

  // Calculate scoring progress
  const scoringProgress = useMemo(() => {
    const total = event.golfers.length;
    const withScores = event.scorecards.filter((sc: any) => sc.scores.length > 0).length;
    const complete = event.scorecards.filter((sc: any) => sc.scores.length >= 18).length;
    return { total, withScores, complete };
  }, [event.golfers, event.scorecards]);

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
    setScoreEntryMode('cards');
    setMode('scorecards');
  };

  const handleQuickScore = () => {
    // Quick score for current user
    if (currentProfile) {
      handleEnterScores(currentProfile.id);
    }
  };

  const canQuickTeam = Boolean(currentProfile && myTeamGolferIds.has(currentProfile.id));

  return (
    <div className="space-y-4">
      {/* Mode Toggle + Progress */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toggle */}
        <div className="p-1 bg-gray-100">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setMode('leaders')}
              className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                mode === 'leaders'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="mr-1.5">🏆</span>
              Leaderboard
            </button>
            <button
              onClick={() => setMode('scorecards')}
              className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                mode === 'scorecards'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <span className="mr-1.5">📝</span>
              Enter Scores
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {scoringProgress.total > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-600 font-medium">Scoring Progress</span>
              <span className="text-gray-900 font-bold">
                {scoringProgress.complete}/{scoringProgress.total} complete
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${(scoringProgress.complete / scoringProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!event.isCompleted && currentProfile && mode === 'leaders' && (
        <div className="flex gap-2">
          {/* Quick Score Self */}
          <button
            onClick={handleQuickScore}
            className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md shadow-primary-200 hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Enter My Score
          </button>
          
          {/* Team Scoring (if applicable) */}
          {canQuickTeam && myTeamGolferIds.size > 1 && (
            <button
              onClick={() => {
                setScoreEntryMode('team');
                setMode('scorecards');
              }}
              className="py-3 px-4 bg-white border-2 border-primary-200 text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Team
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {mode === 'leaders' ? (
        <LeaderboardTab eventId={eventId} onEnterScores={handleEnterScores} />
      ) : (
        <>
          {/* Back to Leaderboard */}
          <button
            onClick={() => setMode('leaders')}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Leaderboard
          </button>
          
          <ScorecardTab eventId={eventId} focusGolferId={focusGolferId} initialEntryMode={scoreEntryMode} />
        </>
      )}

      {/* Empty State */}
      {event.golfers.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-semibold text-gray-700 mb-1">No golfers yet</div>
          <p className="text-sm text-gray-500">Add golfers to start scoring</p>
        </div>
      )}

      {/* Help Text */}
      {event.golfers.length > 0 && mode === 'leaders' && (
        <div className="text-center text-xs text-gray-500">
          <span className="font-medium">Tip:</span> Tap any player in the leaderboard to enter their scores
        </div>
      )}
    </div>
  );
};

export default ScoreHubTab;
