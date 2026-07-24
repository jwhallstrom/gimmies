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
import { getTee, getHole } from '../../data/cloudCourses';
import LeaderboardTab from './LeaderboardTab';
import ScorecardTab from './ScorecardTab';
import EventChatSheet from '../event/EventChatSheet';
import EventCourseStatsSheet from '../event/EventCourseStatsSheet';
import EventHighlightsSheet from '../event/EventHighlightsSheet';
import { useMyEventPayout } from '../../hooks/useMyEventPayout';
import { useEventCourseStats } from '../../hooks/useEventCourseStats';
import { generateRoundRecap } from '../../utils/roundRecap';
import {
  getLeaderboardInsightsExpanded,
  setLeaderboardInsightsExpanded,
} from '../../utils/leaderboardInsights';
import { flushPendingScorecardSync } from '../../state/slices/eventSlice';

type Props = {
  eventId: string;
  isTabActive?: boolean;
  chatUnread?: number;
  onOpenFullChat?: () => void;
  onOpenGamesTab?: (subTab?: 'games' | 'payouts') => void;
  onChatRead?: () => void;
};

const ScoreHubTab: React.FC<Props> = ({
  eventId,
  isTabActive = true,
  chatUnread = 0,
  onOpenFullChat,
  onOpenGamesTab,
  onChatRead,
}) => {
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const currentProfile = useStore((s: any) => s.currentProfile);
  const profiles = useStore((s: any) => s.profiles);
  const setScorecardView = useStore((s: any) => s.setScorecardView);
  const updateScore = useStore((s: any) => s.updateScore);
  const addToast = useStore((s: any) => s.addToast);

  const [focusGolferId, setFocusGolferId] = useState<string | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [showStatsSheet, setShowStatsSheet] = useState(false);
  const [showHighlightsSheet, setShowHighlightsSheet] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(() => getLeaderboardInsightsExpanded());
  const [entryMode, setEntryMode] = useState<'cards' | 'team'>('cards');
  
  const payout = useMyEventPayout(eventId);
  const courseStats = useEventCourseStats(eventId);

  const recap = useMemo(() => {
    if (!event) return null;
    return generateRoundRecap(event, profiles);
  }, [event, profiles]);

  const showHighlightsChip = Boolean(recap && recap.highlights.length > 0);

  const toggleInsights = () => {
    setInsightsExpanded((prev) => {
      const next = !prev;
      setLeaderboardInsightsExpanded(next);
      return next;
    });
  };
  
  // Quick entry state
  const [quickScore, setQuickScore] = useState<number | null>(null);
  const [quickSaving, setQuickSaving] = useState(false);

  const isOwner = Boolean(currentProfile && event && event.ownerProfileId === currentProfile.id);
  const isParticipant = Boolean(
    currentProfile && Array.isArray(event?.golfers) && event.golfers.some((g: any) => g.profileId === currentProfile.id)
  );
  const allowSharedScoreEntry = event?.settings?.allowSharedScoreEntry !== false;
  const guestGolfers = useMemo(() => {
    if (!event || !Array.isArray(event.golfers)) return [];
    return event.golfers.filter((g: any) => !g.profileId);
  }, [event?.id, event?.lastModified, event?.golfers]);
  const hasGuestGolfers = guestGolfers.length > 0;

  // Find current user's team members for team scoring
  const myTeamGolferIds = useMemo(() => {
    if (!event || !currentProfile) return new Set<string>();
    const teams = (event.games?.nassau || []).flatMap((n: any) => n.teams || []);
    const mine = teams.filter((t: any) => (t.golferIds || []).includes(currentProfile.id));
    return new Set<string>(mine.flatMap((t: any) => t.golferIds || []));
  }, [event?.id, event?.lastModified, currentProfile?.id]);

  if (!event) return null;

  const handleEnterScores = (golferId: string, mode: 'cards' | 'team' | 'admin' = 'cards') => {
    // When clicking on a specific player, show ONLY that player's scorecard (individual mode)
    // User can then toggle to team/admin view if they want to see more
    if (mode === 'admin') {
      // Admin mode explicitly requested - show all players (owner only)
      setScorecardView(eventId, 'admin');
    } else if (mode === 'team') {
      // Team mode explicitly requested - show all team members
      setScorecardView(eventId, 'team');
    } else {
      // Default: show only the clicked player's scorecard
      setScorecardView(eventId, 'individual');
    }

    setEntryMode(mode === 'admin' ? 'cards' : mode);
    setFocusGolferId(golferId);
  };

  // Check if user is on a team (for showing team entry option)
  const hasTeam = myTeamGolferIds.size > 1;

  // Load course data for par info
  const { course: selectedCourse, loading: courseLoading } = useCourse(event?.course?.courseId);
  
  // Resolve holes/pars the same way scorecard + getHole do (fuzzy tee match).
  // Never invent par=4 while a real course is still loading — that caused the
  // orange-+ quick entry to show wrong pars vs scorecard mode.
  const holes = useMemo(() => {
    if (!event) return [];
    const cachedTee = getTee(event.course?.courseId, event.course?.teeName);
    const liveTee =
      selectedCourse?.tees?.find((t: any) => t.name === event.course?.teeName) ||
      selectedCourse?.tees?.find(
        (t: any) => t.name?.trim().toLowerCase() === event.course?.teeName?.trim().toLowerCase()
      ) ||
      selectedCourse?.tees?.[0];
    const teeWithHoles = (cachedTee?.holes?.length ? cachedTee : null) || liveTee;

    if (teeWithHoles?.holes?.length) {
      return teeWithHoles.holes.map((h: any, i: number) => ({
        number: typeof h.number === 'number' ? h.number : i + 1,
        par: typeof h.par === 'number' ? h.par : undefined,
        strokeIndex: h.strokeIndex ?? i + 1,
      }));
    }

    return Array.from({ length: 18 }).map((_, i) => ({
      number: i + 1,
      par: event.course?.courseId ? undefined : 4,
      strokeIndex: i + 1,
    }));
  }, [event?.course?.courseId, event?.course?.teeName, selectedCourse]);

  // Track which hole the quick entry widget is showing (null = auto / next empty)
  const [quickEntryHole, setQuickEntryHole] = useState<number | null>(null);

  // Find the next empty hole for quick entry
  const nextEmptyHole = useMemo(() => {
    if (!currentProfile || !event) return 1;
    const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile.id);
    if (!myScorecard) return 1;
    const firstEmpty = myScorecard.scores.find((s: any) => s.strokes == null);
    return firstEmpty ? firstEmpty.hole : null;
  }, [event?.scorecards, currentProfile?.id]);

  const holesCompleted = useMemo(() => {
    if (!currentProfile || !event) return 0;
    const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile.id);
    if (!myScorecard) return 0;
    return myScorecard.scores.filter((s: any) => s.strokes != null).length;
  }, [event?.scorecards, currentProfile?.id]);

  const totalHoles = holes.length || 18;

  const nextHoleInfo = useMemo(() => {
    const holeNum = quickEntryHole ?? nextEmptyHole ?? 18;
    const holeMeta = holes.find((h: any) => h.number === holeNum);
    const fromCourse = event?.course?.courseId
      ? getHole(event.course.courseId, holeNum, event.course.teeName)?.par
      : undefined;
    const par =
      typeof holeMeta?.par === 'number'
        ? holeMeta.par
        : typeof fromCourse === 'number'
          ? fromCourse
          : null;

    if (!currentProfile || !event) return { hole: holeNum, par, existingScore: null };
    const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile.id);
    const existingScore = myScorecard?.scores.find((s: any) => s.hole === holeNum)?.strokes ?? null;

    return { hole: holeNum, par, existingScore };
  }, [event?.scorecards, event?.course?.courseId, event?.course?.teeName, currentProfile?.id, holes, quickEntryHole, nextEmptyHole]);

  // Flush pending score syncs if the tab is backgrounded / closed mid-entry
  useEffect(() => {
    const flush = () => flushPendingScorecardSync(() => useStore.getState(), eventId);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [eventId]);

  // Reset quick entry hole when FAB opens
  useEffect(() => {
    if (showFabMenu) {
      setQuickEntryHole(null);
    }
  }, [showFabMenu]);

  // Update quick score whenever the displayed hole changes
  useEffect(() => {
    if (showFabMenu) {
      const fallbackPar = nextHoleInfo.par ?? 4;
      setQuickScore(nextHoleInfo.existingScore ?? fallbackPar);
    }
  }, [showFabMenu, nextHoleInfo.hole, nextHoleInfo.par, nextHoleInfo.existingScore]);

  // Handle quick save — saves current hole and auto-advances to next
  const handleQuickSave = async () => {
    if (!currentProfile || quickScore === null) return;

    const savedHole = nextHoleInfo.hole;
    setQuickSaving(true);
    try {
      await updateScore(eventId, currentProfile.id, savedHole, quickScore);

      if (savedHole >= totalHoles) {
        addToast?.(`Hole ${savedHole} saved — all done! 🎉`, 'success', 2000);
        setShowFabMenu(false);
      } else {
        addToast?.(`Hole ${savedHole}: ${quickScore} ✓`, 'success', 800);
        setQuickEntryHole(savedHole + 1);
      }
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
          <LeaderboardTab
            eventId={eventId}
            onEnterScores={handleEnterScores}
            chatUnread={chatUnread}
            onOpenChat={() => setShowChatSheet(true)}
            showMoneyChip={payout.showMoneyChip}
            myNet={payout.myNet}
            onOpenPayouts={() => onOpenGamesTab?.('games')}
            showStatsChip={courseStats.showStatsChip}
            onOpenStats={() => setShowStatsSheet(true)}
            showHighlightsChip={showHighlightsChip}
            onOpenHighlights={() => setShowHighlightsSheet(true)}
            insightsExpanded={insightsExpanded}
            onToggleInsights={toggleInsights}
          />

          {/* Orange FAB - matches home page design. Only show when this tab is active to avoid covering chat. */}
          {!event.isCompleted && currentProfile && isTabActive && (
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
                <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 relative">
                  {/* Close button */}
                  <button
                    onClick={() => setShowFabMenu(false)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center transition z-10"
                    aria-label="Close quick entry"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="flex items-center justify-between mb-3 pr-10">
                    <div className="text-white">
                      <div className="text-sm font-medium opacity-90 flex items-center gap-2">
                        Quick Entry
                        <span className="opacity-70">{holesCompleted} / {totalHoles}</span>
                      </div>
                      <div className="text-2xl font-black">
                        Hole {nextHoleInfo.hole}{' '}
                        <span className="text-lg font-medium opacity-80">
                          • {nextHoleInfo.par != null ? `Par ${nextHoleInfo.par}` : courseLoading ? 'Loading par…' : 'Par —'}
                        </span>
                      </div>
                    </div>
                    {quickScore !== null && nextHoleInfo.par != null && (
                      <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${
                        quickScore <= nextHoleInfo.par - 2 ? 'bg-amber-400 text-amber-950' :
                        quickScore < nextHoleInfo.par ? 'bg-red-500 text-white' :
                        quickScore === nextHoleInfo.par ? 'bg-white/30 text-white' :
                        quickScore === nextHoleInfo.par + 1 ? 'bg-blue-300 text-blue-900' :
                        'bg-blue-500 text-white'
                      }`}>
                        {quickScore <= nextHoleInfo.par - 2 ? 'Eagle!' :
                         quickScore === nextHoleInfo.par - 1 ? 'Birdie!' :
                         quickScore === nextHoleInfo.par ? 'Par' :
                         quickScore === nextHoleInfo.par + 1 ? 'Bogey' :
                         quickScore === nextHoleInfo.par + 2 ? 'Double' :
                         `+${quickScore - nextHoleInfo.par}`}
                      </div>
                    )}
                  </div>

                  {/* Hole progress dots */}
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: totalHoles }).map((_, i) => {
                      const holeNum = i + 1;
                      const myScorecard = event.scorecards.find((sc: any) => sc.golferId === currentProfile?.id);
                      const hasScore = myScorecard?.scores.find((s: any) => s.hole === holeNum)?.strokes != null;
                      const isCurrent = holeNum === nextHoleInfo.hole;
                      return (
                        <button
                          key={holeNum}
                          onClick={() => setQuickEntryHole(holeNum)}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            isCurrent ? 'bg-white scale-y-150' :
                            hasScore ? 'bg-white/60' :
                            'bg-white/20'
                          }`}
                          aria-label={`Go to hole ${holeNum}`}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Hole navigation arrows + score controls */}
                  <div className="flex items-center gap-2">
                    {/* Previous hole */}
                    <button
                      onClick={() => setQuickEntryHole(Math.max(1, nextHoleInfo.hole - 1))}
                      disabled={nextHoleInfo.hole <= 1}
                      className="w-10 h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white transition"
                      aria-label="Previous hole"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Score -/+ and number */}
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => setQuickScore((s) => Math.max(1, (s ?? nextHoleInfo.par ?? 4) - 1))}
                        className="w-14 h-16 rounded-2xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-white text-3xl font-bold transition"
                      >
                        −
                      </button>

                      <div className="flex-1 flex items-center justify-center">
                        <div className={`text-7xl font-black tabular-nums ${
                          nextHoleInfo.par != null && quickScore !== null && quickScore < nextHoleInfo.par ? 'text-red-300' :
                          nextHoleInfo.par != null && quickScore !== null && quickScore > nextHoleInfo.par ? 'text-blue-200' :
                          'text-white'
                        }`}>
                          {quickScore ?? nextHoleInfo.par ?? '—'}
                        </div>
                      </div>

                      <button
                        onClick={() => setQuickScore((s) => Math.min(15, (s ?? nextHoleInfo.par ?? 4) + 1))}
                        className="w-14 h-16 rounded-2xl bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center text-white text-3xl font-bold transition"
                      >
                        +
                      </button>
                    </div>

                    {/* Next hole */}
                    <button
                      onClick={() => setQuickEntryHole(Math.min(totalHoles, nextHoleInfo.hole + 1))}
                      disabled={nextHoleInfo.hole >= totalHoles}
                      className="w-10 h-16 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white transition"
                      aria-label="Next hole"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Save Button — shows intent to advance */}
                  <button
                    onClick={handleQuickSave}
                    disabled={quickSaving}
                    className="w-full mt-3 py-3.5 bg-white text-green-700 font-extrabold text-lg rounded-2xl shadow-lg hover:bg-green-50 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                  >
                    {quickSaving ? (
                      'Saving...'
                    ) : nextHoleInfo.hole >= totalHoles ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Save &amp; Finish
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Hole {nextHoleInfo.hole}
                        <svg className="w-4 h-4 ml-1 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
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

                {/* Admin / shared: All Players */}
                {(isOwner || (isParticipant && allowSharedScoreEntry)) && (
                  <button
                    onClick={() => { 
                      setShowFabMenu(false);
                      handleEnterScores(currentProfile.id, 'admin'); 
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-md">
                      <span className="text-xl">📋</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">All Scorecards</div>
                      <div className="text-xs text-gray-500">
                        {isOwner ? 'Admin: Edit any player' : 'Enter scores for anyone in the group'}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Guest scores - when shared entry is off, still allow guest entry */}
                {!isOwner && isParticipant && !allowSharedScoreEntry && hasGuestGolfers && (
                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      const firstGuestId = guestGolfers[0]?.customName || guestGolfers[0]?.displayName;
                      if (firstGuestId) handleEnterScores(firstGuestId, 'admin');
                    }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-md">
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">Guest Scores</div>
                      <div className="text-xs text-gray-500">
                        Enter scores for guests • {guestGolfers.length} guest{guestGolfers.length !== 1 ? 's' : ''}
                      </div>
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

        </div>
      )}

      <EventChatSheet
        eventId={eventId}
        isOpen={showChatSheet}
        onClose={() => {
          setShowChatSheet(false);
          onChatRead?.();
        }}
        onOpenFullChat={onOpenFullChat}
        unreadCount={chatUnread}
      />

      {courseStats.event && (
        <EventCourseStatsSheet
          isOpen={showStatsSheet}
          onClose={() => setShowStatsSheet(false)}
          event={courseStats.event}
          holes={courseStats.holes}
          holeParByNumber={courseStats.holeParByNumber}
          playersWithScores={courseStats.playersWithScores}
          totalPar={courseStats.totalPar}
        />
      )}

      {recap && recap.highlights.length > 0 && (
        <EventHighlightsSheet
          isOpen={showHighlightsSheet}
          onClose={() => setShowHighlightsSheet(false)}
          recap={recap}
          isLive={!event.isCompleted}
        />
      )}
    </div>
  );
};

export default ScoreHubTab;
