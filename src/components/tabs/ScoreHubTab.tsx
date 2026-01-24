import React, { useMemo, useState } from 'react';
import useStore from '../../state/store';
import LeaderboardTab from './LeaderboardTab';
import ScorecardTab from './ScorecardTab';

type Props = { eventId: string };

type Mode = 'leaders' | 'scorecards';

const ScoreHubTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) => s.events.find((e: any) => e.id === eventId) || s.completedEvents.find((e: any) => e.id === eventId));
  const currentProfile = useStore((s: any) => s.currentProfile);
  const setScorecardView = useStore((s: any) => s.setScorecardView);

  const [mode, setMode] = useState<Mode>('leaders');
  const [focusGolferId, setFocusGolferId] = useState<string | null>(null);
  const [scoreEntryMode, setScoreEntryMode] = useState<'cards' | 'team'>('cards');
  const [showQuick, setShowQuick] = useState(false);

  const isOwner = Boolean(currentProfile && event && event.ownerProfileId === currentProfile.id);

  const myTeamGolferIds = useMemo(() => {
    if (!event || !currentProfile) return new Set<string>();
    const teams = (event.games?.nassau || []).flatMap((n: any) => n.teams || []);
    const mine = teams.filter((t: any) => (t.golferIds || []).includes(currentProfile.id));
    return new Set<string>(mine.flatMap((t: any) => t.golferIds || []));
  }, [event?.id, event?.lastModified, currentProfile?.id]);

  if (!event) return null;

  const handleEnterScores = (golferId: string) => {
    // Choose the most permissive *reasonable* scorecard view for the current user.
    if (isOwner) {
      setScorecardView(eventId, 'admin');
    } else if (currentProfile) {
      if (myTeamGolferIds.has(golferId)) setScorecardView(eventId, 'team');
      else setScorecardView(eventId, 'individual');
    }

    setFocusGolferId(golferId);
    setScoreEntryMode('cards');
    setMode('scorecards');
  };

  const canQuickTeam = Boolean(currentProfile && myTeamGolferIds.has(currentProfile.id));

  return (
    <div className="space-y-3">
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex gap-1 text-[12px] font-extrabold rounded-lg overflow-hidden border border-primary-200 bg-primary-50">
          <button
            type="button"
            onClick={() => setMode('leaders')}
            className={`px-3 py-2 ${mode === 'leaders' ? 'bg-primary-600 text-white' : 'text-primary-700 hover:bg-primary-100'}`}
          >
            Leaders
          </button>
          <button
            type="button"
            onClick={() => setMode('scorecards')}
            className={`px-3 py-2 ${mode === 'scorecards' ? 'bg-primary-600 text-white' : 'text-primary-700 hover:bg-primary-100'}`}
          >
            Score
          </button>
        </div>

        <div className="text-[11px] text-slate-600 text-right leading-tight">
          <div className="font-bold text-slate-700">Tap a player → enter score</div>
          <div className="text-[10px]">No need for separate tabs</div>
        </div>
      </div>

      {mode === 'leaders' ? (
        <LeaderboardTab eventId={eventId} onEnterScores={handleEnterScores} />
      ) : (
        <ScorecardTab eventId={eventId} focusGolferId={focusGolferId} initialEntryMode={scoreEntryMode} />
      )}

      {/* Quick action: minimal taps to start scoring */}
      {currentProfile && !event.isCompleted && (
        <div className="fixed right-4 bottom-[5.75rem] z-40">
          <button
            type="button"
            onClick={() => setShowQuick(true)}
            className="px-4 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold shadow-lg shadow-primary-900/25 border border-primary-700/30"
            title="Add score"
          >
            + Score
          </button>
        </div>
      )}

      {showQuick && currentProfile && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setShowQuick(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Quick score</div>
              <div className="font-extrabold text-slate-900">How do you want to enter?</div>
            </div>
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  // My score (fastest path)
                  if (isOwner) setScorecardView(eventId, 'admin');
                  else setScorecardView(eventId, 'individual');
                  setScoreEntryMode('cards');
                  setFocusGolferId(currentProfile.id);
                  setMode('scorecards');
                  setShowQuick(false);
                }}
                className="w-full px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold"
              >
                My score
              </button>

              <button
                type="button"
                disabled={!canQuickTeam}
                onClick={() => {
                  // Team entry (one screen, per hole)
                  if (isOwner) setScorecardView(eventId, 'admin');
                  else setScorecardView(eventId, 'team');
                  setScoreEntryMode('team');
                  setFocusGolferId(currentProfile.id);
                  setMode('scorecards');
                  setShowQuick(false);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-extrabold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                title={canQuickTeam ? 'Enter team hole scores' : 'You are not on a team yet'}
              >
                Team entry
              </button>

              <button
                type="button"
                onClick={() => setShowQuick(false)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreHubTab;

