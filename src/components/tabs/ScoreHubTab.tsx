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
 * - Quick Entry: +/- buttons for current hole (starts at par)
 */

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';
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
  const updateScore = useStore((s: any) => s.updateScore);
  const addToast = useStore((s: any) => s.addToast);

  const [focusGolferId, setFocusGolferId] = useState<string | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [entryMode, setEntryMode] = useState<'cards' | 'team'>('cards');
  
  // Quick entry state
  const [quickScore, setQuickScore] = useState<number | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);

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

  // Load course data for par info
  const { course: selectedCourse } = useCourse(event?.course?.courseId);
  
  // Get holes with par info
  const holes = useMemo(() => {
    if (!event) return [];
    const selectedTeeName = event.course?.teeName;
    const selectedTee = selectedCourse?.tees?.find((t: any) => t.name === selectedTeeName);
    const teeWithHoles = selectedTee || selectedCourse?.tees?.[0];
    return teeWithHoles?.holes?.length
      ? teeWithHoles.holes
      : Array.from({ length: 18 }).map((_, i) => ({
          number: i + 1,
          par: 4, // Default par if not loaded
          strokeIndex: i + 1,
        }));
  }, [event?.course?.teeName, selectedCourse]);

  // Find the next hole to enter for quick entry
  const nextHoleInfo = useMemo(() => {
    if (!currentProfile || !event) return { hole: 1, par: 4, existingScore: null };
    const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile.id);
    if (!myScorecard) return { hole: 1, par: 4, existingScore: null };
    
    const firstEmpty = myScorecard.scores.find((s: any) => s.strokes == null);
    const holeNum = firstEmpty ? firstEmpty.hole : 18;
    const holeMeta = holes.find((h: any) => h.number === holeNum);
    const par = holeMeta?.par ?? 4;
    
    // Check if there's an existing score for this hole
    const existingScore = myScorecard.scores.find((s: any) => s.hole === holeNum)?.strokes ?? null;
    
    return { hole: holeNum, par, existingScore };
  }, [event?.scorecards, currentProfile?.id, holes]);

  // Initialize quick score to par when FAB opens
  useEffect(() => {
    if (showFabMenu) {
      // If there's an existing score, use it; otherwise start at par
      setQuickScore(nextHoleInfo.existingScore ?? nextHoleInfo.par);
    }
  }, [showFabMenu, nextHoleInfo.par, nextHoleInfo.existingScore]);

  // Handle quick save
  const handleQuickSave = async () => {
    if (!currentProfile || quickScore === null) return;
    
    setQuickSaving(true);
    try {
      await updateScore(eventId, currentProfile.id, nextHoleInfo.hole, quickScore);
      addToast?.(`Hole ${nextHoleInfo.hole}: ${quickScore} saved!`, 'success', 1500);
      setShowFabMenu(false);
    } catch {
      addToast?.('Could not save score', 'error');
    } finally {
      setQuickSaving(false);
    }
  };

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
                {/* QUICK ENTRY - Inline score entry */}
                <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white">
                      <div className="text-sm font-medium opacity-90">Quick Entry</div>
                      <div className="text-2xl font-black">
                        Hole {nextHoleInfo.hole} <span className="text-lg font-medium opacity-80">• Par {nextHoleInfo.par}</span>
                      </div>
                    </div>
                    <div className="text-right text-white">
                      <div className="text-xs opacity-80">Score</div>
                      <div className={`text-3xl font-black ${
                        quickScore !== null && quickScore < nextHoleInfo.par ? 'text-yellow-300' :
                        quickScore !== null && quickScore > nextHoleInfo.par ? 'text-red-200' :
                        'text-white'
                      }`}>
                        {quickScore ?? nextHoleInfo.par}
                      </div>
                    </div>
                  </div>
                  
                  {/* +/- Controls */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuickScore((s) => Math.max(1, (s ?? nextHoleInfo.par) - 1))}
                      className="w-16 h-16 rounded-2xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-white text-3xl font-bold transition"
                    >
                      −
                    </button>
                    
                    <div className="flex-1 flex items-center justify-center gap-2">
                      {/* Score relative to par indicator */}
                      {quickScore !== null && (
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                          quickScore < nextHoleInfo.par ? 'bg-yellow-400 text-yellow-900' :
                          quickScore === nextHoleInfo.par ? 'bg-white/30 text-white' :
                          quickScore === nextHoleInfo.par + 1 ? 'bg-orange-400 text-orange-900' :
                          'bg-red-400 text-red-900'
                        }`}>
                          {quickScore < nextHoleInfo.par - 1 ? `${quickScore - nextHoleInfo.par} Eagle!` :
                           quickScore === nextHoleInfo.par - 1 ? 'Birdie!' :
                           quickScore === nextHoleInfo.par ? 'Par' :
                           quickScore === nextHoleInfo.par + 1 ? 'Bogey' :
                           quickScore === nextHoleInfo.par + 2 ? 'Double' :
                           `+${quickScore - nextHoleInfo.par}`}
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setQuickScore((s) => Math.min(15, (s ?? nextHoleInfo.par) + 1))}
                      className="w-16 h-16 rounded-2xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-white text-3xl font-bold transition"
                    >
                      +
                    </button>
                  </div>
                  
                  {/* Save Button */}
                  <button
                    onClick={handleQuickSave}
                    disabled={quickSaving}
                    className="w-full mt-3 py-3 bg-white text-green-700 font-extrabold text-lg rounded-2xl shadow-lg hover:bg-green-50 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                  >
                    {quickSaving ? (
                      'Saving...'
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Hole {nextHoleInfo.hole}
                      </>
                    )}
                  </button>
                </div>
                
                {/* Divider */}
                <div className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Or open full scorecard</div>
                </div>

                {/* My Scorecard - Full entry */}
                <button
                  onClick={() => { 
                    setShowFabMenu(false); 
                    handleEnterScores(currentProfile.id, 'cards'); 
                  }}
                  className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-md">
                    <span className="text-xl">🏌️</span>
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900">My Scorecard</div>
                    <div className="text-xs text-gray-500">Enter multiple holes at once</div>
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-md">
                      <span className="text-xl">👥</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">Team Entry</div>
                      <div className="text-xs text-gray-500">
                        Enter team scores • {myTeamGolferIds.size} players
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-md">
                      <span className="text-xl">📋</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">All Scorecards</div>
                      <div className="text-xs text-gray-500">Admin: Edit any player</div>
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
