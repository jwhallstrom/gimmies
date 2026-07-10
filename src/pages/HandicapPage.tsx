import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { applyESCAdjustment, formatHandicapIndex, isRoundEligibleForHandicapIndex } from '../utils/handicap';
import { loadCoursesIntoCache } from '../hooks/useCourses';

const HandicapPage: React.FC = () => {
  const { currentProfile, getProfileRounds, loadEventsFromCloud, recalculateAllDifferentials, calculateAndUpdateHandicap } = useStore();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [coursesReady, setCoursesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCoursesIntoCache()
      .then(() => { if (!cancelled) setCoursesReady(true); })
      .catch(() => { if (!cancelled) setCoursesReady(true); });
    return () => { cancelled = true; };
  }, []);

  const individualRounds = currentProfile?.individualRounds || [];
  const eligibleRounds = useMemo(
    () => individualRounds.filter((r) => isRoundEligibleForHandicapIndex(r)),
    [individualRounds]
  );

  useEffect(() => {
    if (!currentProfile?.id || !coursesReady) return;

    let cancelled = false;
    setIsRefreshing(true);

    const refreshHandicap = async () => {
      try {
        await loadCoursesIntoCache();
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          await loadEventsFromCloud();
        }
        if (cancelled) return;
        recalculateAllDifferentials();
        calculateAndUpdateHandicap(currentProfile.id);
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    };

    void refreshHandicap();
    return () => { cancelled = true; };
  }, [currentProfile?.id, coursesReady, loadEventsFromCloud, recalculateAllDifferentials, calculateAndUpdateHandicap]);

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-slate-300">Please create a profile to track your handicap.</p>
      </div>
    );
  }

  const rounds = getProfileRounds(currentProfile.id);
  const roundsUntilIndex = Math.max(0, 3 - eligibleRounds.length);
  const hasCalculatedIndex =
    eligibleRounds.length >= 3 && typeof currentProfile.handicapIndex === 'number';

  const latestHistory = currentProfile.handicapHistory && currentProfile.handicapHistory.length > 0
    ? currentProfile.handicapHistory[currentProfile.handicapHistory.length - 1]
    : null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreBadgeColor = (gross: number, par: number = 72) => {
    const diff = gross - par;
    if (diff <= -2) return 'bg-purple-100 text-purple-800';
    if (diff === -1) return 'bg-blue-100 text-blue-800';
    if (diff === 0) return 'bg-green-100 text-green-800';
    if (diff === 1) return 'bg-yellow-100 text-yellow-800';
    if (diff === 2) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header with Handicap Index */}
      <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-200">Handicap Tracker</h1>
            <p className="text-gray-600 dark:text-slate-300 mt-1">Track your individual rounds and handicap progression</p>
            {isRefreshing && (
              <p className="text-xs text-primary-600 dark:text-primary-300 mt-2">Recalculating from your rounds…</p>
            )}
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {hasCalculatedIndex
                ? formatHandicapIndex(currentProfile.handicapIndex)
                : '--'
              }
            </div>
            <div className="text-sm text-gray-500 dark:text-slate-400">Current Index</div>
            {!hasCalculatedIndex && rounds.length > 0 && (
              <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 max-w-[140px]">
                {eligibleRounds.length === 0
                  ? 'Scores saved — waiting on course rating data'
                  : `${eligibleRounds.length} of 3 scored rounds${roundsUntilIndex > 0 ? ` (${roundsUntilIndex} more needed)` : ''}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-lg shadow-md p-4 border border-primary-900/5 dark:border-slate-800">
          <div className="text-xl font-bold text-primary-600">{rounds.length}</div>
          <div className="text-sm text-gray-600 dark:text-slate-300">Total Rounds</div>
        </div>
        <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-lg shadow-md p-4 border border-primary-900/5 dark:border-slate-800">
          <div className="text-xl font-bold text-primary-600">{eligibleRounds.length}</div>
          <div className="text-sm text-gray-600 dark:text-slate-300">Scored for Index</div>
        </div>
        <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-lg shadow-md p-4 border border-primary-900/5 dark:border-slate-800">
          <div className="text-xl font-bold text-primary-600">
            {currentProfile.stats.averageScore > 0 ? currentProfile.stats.averageScore.toFixed(1) : '--'}
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-300">Average Score</div>
        </div>
        <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-lg shadow-md p-4 border border-primary-900/5 dark:border-slate-800">
          <div className="text-xl font-bold text-primary-600">
            {currentProfile.stats.bestScore > 0 ? currentProfile.stats.bestScore : '--'}
          </div>
          <div className="text-sm text-gray-600 dark:text-slate-300">Best Score</div>
        </div>
      </div>

      {/* Recent Rounds */}
      <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-xl shadow-md border border-primary-900/5 dark:border-slate-800">
        <div className="p-6 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Recent Rounds</h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-slate-800">
          {rounds.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p>No rounds recorded yet.</p>
              <p className="text-sm mt-1">Add your first round to start tracking your handicap!</p>
            </div>
          ) : (
            rounds.map((round) => (
              <div key={round.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {round.type === 'event' && round.eventId ? (
                          <Link
                            to={`/event/${round.eventId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                          >
                            Event →
                          </Link>
                        ) : (
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Individual
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/handicap/round/${round.id}`} className="hover:text-primary-700">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {round.courseName}
                          </p>
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {formatDate(round.date)} • {round.teeName}
                          {round.eventName && ` • ${round.eventName}`}
                        </p>
                        {latestHistory && latestHistory.usedRoundIds && latestHistory.usedRoundIds.includes(round.id) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700">Used in Index</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link 
                    to={`/handicap/round/${round.id}`}
                    className="w-[86px] sm:w-[92px] flex items-center justify-end gap-2 flex-shrink-0 hover:text-primary-700"
                  >
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        getScoreBadgeColor(round.grossScore)
                      }`}>
                        {round.grossScore}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        {(() => {
                          const complete = round.scores.every(s => typeof s.strokes === 'number');
                          if (!complete) return <>Adj: --</>;
                          const adjustedGross = round.scores.reduce((sum, s) => {
                            const raw = (s.strokes as number);
                            const hs = s.handicapStrokes || 0;
                            const adj = (typeof s.adjustedStrokes === 'number')
                              ? s.adjustedStrokes
                              : applyESCAdjustment(raw, s.par, hs);
                            return sum + adj;
                          }, 0);
                          return <>Adj: {adjustedGross}</>;
                        })()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Diff: {typeof round.scoreDifferential === 'number' ? round.scoreDifferential.toFixed(1) : '--'}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Handicap History - Show if available */}
      {currentProfile.handicapHistory && currentProfile.handicapHistory.length > 0 && (
        <div className="bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 backdrop-blur rounded-xl shadow-md border border-primary-900/5 dark:border-slate-800">
          <div className="p-6 border-b border-gray-200 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Handicap History</h2>
          </div>
          
          <div className="p-4">
            <div className="space-y-2">
              {currentProfile.handicapHistory.slice(-5).reverse().map((history, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600 dark:text-slate-300">
                    {formatDate(history.date)}
                  </span>
                  <span className="font-medium text-primary-600 dark:text-primary-300">
                    {formatHandicapIndex(history.handicapIndex, { fallback: '—' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Orange FAB - Add New Round */}
      <button
        onClick={() => navigate('/handicap/add-round')}
        className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
        title="Add New Round"
        aria-label="Add new round"
      >
        +
      </button>
    </div>
  );
};

export default HandicapPage;
