import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useStore from '../../state/store';
import { strokesForHole, courseHandicap } from '../../games/handicap';
import { useCourse } from '../../hooks/useCourse';
import { useAuthMode } from '../../hooks/useAuthMode';

type Props = {
  eventId: string;
  /** Optional: scroll/highlight a specific golfer card */
  focusGolferId?: string | null;
  /** Optional: choose initial entry mode (used by quick actions) */
  initialEntryMode?: 'cards' | 'team';
  /** Callback when user is done editing and wants to exit */
  onDone?: () => void;
};

const ScorecardTab: React.FC<Props> = ({ eventId, focusGolferId, initialEntryMode, onDone }) => {
  const { events, completedEvents, profiles, currentProfile, updateScore, canEditScore, setScorecardView, addToast } = useStore();
  const { isGuest } = useAuthMode();
  const event = events.find((e: any) => e.id === eventId) || completedEvents.find((e: any) => e.id === eventId);
  
  // Track which cell just saved (for flash feedback)
  const [savedCell, setSavedCell] = useState<string | null>(null);
  const [hasEdited, setHasEdited] = useState(false);
  
  if (!event) return null;

  const safeNassauGames = Array.isArray(event.games?.nassau) ? event.games.nassau : [];

  // Load only the selected course from DynamoDB (faster than loading full catalog)
  const { course: selectedCourse, loading: coursesLoading } = useCourse(event.course.courseId);
  
  // Handle score update with visual feedback
  const handleScoreUpdate = (golferId: string, hole: number, value: number | null) => {
    updateScore(eventId, golferId, hole, value);
    setHasEdited(true);
    
    // Flash the cell green briefly
    const cellKey = `${golferId}-${hole}`;
    setSavedCell(cellKey);
    setTimeout(() => setSavedCell(null), 600);
  };
  
  // Done handler with feedback
  const handleDone = () => {
    if (hasEdited) {
      addToast?.('Scores saved!', 'success', 1500);
    }
    onDone?.();
  };

  // Determine holes for rendering:
  // - Prefer the selected tee's holes from cloud data
  // - Fallback to any tee's holes for the course
  // - Fallback to 18 generic holes (par 4)
  const selectedTeeName = event.course.teeName;
  const selectedTee = selectedCourse?.tees.find(t => t.name === selectedTeeName);
  const teeWithHoles = selectedTee || selectedCourse?.tees?.[0];
  const holes = teeWithHoles?.holes?.length
    ? teeWithHoles.holes
    : Array.from({ length: 18 }).map((_, i) => ({
        number: i + 1,
        // If a real course is selected but holes haven't loaded yet, don't show incorrect par=4.
        // For true "custom course" events (no courseId), keep the historical par=4 default.
        par: event.course.courseId ? undefined : 4,
        strokeIndex: i + 1,
      }));
  const front = holes.slice(0, 9);
  const back = holes.slice(9);
  const [view, setView] = useState<'front'|'back'|'full'>('full');
  const [entryMode, setEntryMode] = useState<'cards' | 'team'>('cards');
  const [teamHole, setTeamHole] = useState(1);
  const [flashGolferId, setFlashGolferId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // On very small screens default to full to avoid horizontal scroll.
  useEffect(()=>{
    if (typeof window !== 'undefined' && window.innerWidth < 640) setView('full');
  },[]);

  const showFront = view === 'front' || view === 'full';
  const showBack = view === 'back' || view === 'full';

  // Filter golfers based on scorecard view permissions
  // When focusGolferId is set and we're in 'individual' mode, show ONLY that golfer
  const visibleGolfers = event.golfers.filter(eventGolfer => {
    const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
    // Use displayName snapshot first (for cross-device compatibility), fall back to profile lookup, then customName
    const displayName = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
    if (!displayName) return false;

    const golferId = eventGolfer.profileId || eventGolfer.customName;
    if (!golferId) return false; // Ensure golferId is defined

    // If user clicked on a specific player and view is 'individual', show ONLY that player
    if (focusGolferId && event.scorecardView === 'individual') {
      return golferId === focusGolferId;
    }

    const isEventOwner = currentProfile?.id === event.ownerProfileId;
    const isCurrentUser = golferId === currentProfile?.id;

    // Event owner permissions
    if (isEventOwner) {
      if (event.scorecardView === 'individual') {
        // Only show owner's own scorecard (or focused player if set)
        return focusGolferId ? golferId === focusGolferId : isCurrentUser;
      } else if (event.scorecardView === 'team') {
        // Show owner's team in Nassau games
        if (!currentProfile) return false;

        // Find all teams in Nassau games that include the current user (owner)
        const userTeams = safeNassauGames.flatMap(nassau =>
          nassau.teams?.filter(team => team.golferIds.includes(currentProfile.id)) || []
        );

        // Get all golfer IDs from the user's teams
        const teamGolferIds = userTeams.flatMap(team => team.golferIds);
        return teamGolferIds.includes(golferId);
      } else if (event.scorecardView === 'admin') {
        // Show all golfers
        return true;
      }
    }

    // Non-owner permissions
    if (!isEventOwner) {
      // Can always see their own scorecard
      if (isCurrentUser) return true;

      const isParticipant = !!currentProfile && Array.isArray(event.golfers)
        && event.golfers.some((g: any) => g.profileId === currentProfile.id);
      const allowShared = event.settings?.allowSharedScoreEntry !== false;

      // Shared score entry: participants can open any scorecard (admin/focus views)
      if (isParticipant && allowShared) {
        if (event.scorecardView === 'admin') return true;
        if (focusGolferId && golferId === focusGolferId) return true;
      }

      // Participants can see guest scorecards (so they can enter guest scores)
      const isGuestGolfer = !eventGolfer.profileId;
      if (isParticipant && isGuestGolfer) {
        if (event.scorecardView === 'admin') return true;
        if (focusGolferId && golferId === focusGolferId) return true;
      }

      // Can see team members if they're on a team together in Nassau games
      if (currentProfile) {
        const userTeams = safeNassauGames.flatMap(nassau =>
          nassau.teams?.filter(team => team.golferIds.includes(currentProfile.id)) || []
        );
        const teamGolferIds = userTeams.flatMap(team => team.golferIds);
        return teamGolferIds.includes(golferId);
      }
    }

    return false;
  });

  const isEventOwner = currentProfile?.id === event.ownerProfileId;
  const hasNassauGames = safeNassauGames.length > 0;
  const isTeamScorecard = event.scorecardView === 'team' && hasNassauGames;
  const isParticipant = !!currentProfile && Array.isArray(event.golfers)
    && event.golfers.some((g: any) => g.profileId === currentProfile.id);
  const allowSharedScoreEntry = event.settings?.allowSharedScoreEntry !== false;
  const hasGuestGolfers = Array.isArray(event.golfers) && event.golfers.some((g: any) => !g.profileId);
  const canUseGuestScorecards = Boolean(
    isEventOwner || (isParticipant && (allowSharedScoreEntry || hasGuestGolfers))
  );

  // Auto-switch from team view to individual if no Nassau games exist
  React.useEffect(() => {
    if (event.scorecardView === 'team' && !hasNassauGames && isEventOwner) {
      setScorecardView(eventId, 'individual');
    }
  }, [event.scorecardView, hasNassauGames, isEventOwner, eventId, setScorecardView]);

  // Keep team entry mode safe: if view isn't "team", fall back to cards.
  useEffect(() => {
    if (entryMode === 'team' && !isTeamScorecard) setEntryMode('cards');
  }, [entryMode, isTeamScorecard]);

  // Allow parent to request an initial entry mode.
  useEffect(() => {
    if (!initialEntryMode) return;
    if (initialEntryMode === 'team' && !isTeamScorecard) return;
    setEntryMode(initialEntryMode);
  }, [initialEntryMode, isTeamScorecard]);

  // Scroll/highlight a golfer when requested.
  useEffect(() => {
    if (!focusGolferId) return;
    // Wait a tick so layout has mounted.
    const t = window.setTimeout(() => {
      const el = cardRefs.current[focusGolferId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setFlashGolferId(focusGolferId);
        window.setTimeout(() => setFlashGolferId(null), 1400);
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [focusGolferId]);

  const teamHoleMeta = useMemo(() => holes.find((h: any) => h.number === teamHole) || null, [holes, teamHole]);

  return (
    <div className={`overflow-x-auto rounded-lg shadow-inner bg-white/95 backdrop-blur border border-primary-900/10 ${onDone && !event.isCompleted ? 'pb-20' : ''}`}>
      {/* Slim info header when editing */}
      {onDone && !event.isCompleted && (
        <div className="sticky top-0 z-20 bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-2 flex items-center gap-2 shadow-md">
          <span className="text-lg">⛳</span>
          <div className="text-white">
            <div className="font-bold text-sm">Entering Scores</div>
            <div className="text-[10px] text-white/80">Tap a cell to enter • Auto-saves</div>
          </div>
        </div>
      )}
      
      {event.isCompleted && (
        <div className="bg-green-50 border-b border-green-200 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="font-medium">✓ Event Completed</span>
            <span className="text-xs">This scorecard is read-only</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2 flex-wrap">
        <div className="flex gap-1 text-[11px] font-medium rounded-md overflow-hidden border border-primary-200 bg-primary-50">
          {(['front','back','full'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)}
              className={`px-2 py-1 capitalize tracking-wide ${view===v? 'bg-primary-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>{v}</button>
          ))}
        </div>

        {/* Team entry: faster for updating multiple teammates per hole */}
        {isTeamScorecard && visibleGolfers.length > 1 && (
          <div className="flex gap-1 text-[11px] font-extrabold rounded-md overflow-hidden border border-primary-200 bg-primary-50">
            <button
              type="button"
              onClick={() => setEntryMode('cards')}
              className={`px-2 py-1 tracking-wide ${entryMode === 'cards' ? 'bg-primary-600 text-white' : 'text-primary-700 hover:bg-primary-100'}`}
            >
              Scorecards
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('team')}
              className={`px-2 py-1 tracking-wide ${entryMode === 'team' ? 'bg-primary-600 text-white' : 'text-primary-700 hover:bg-primary-100'}`}
            >
              Team entry
            </button>
          </div>
        )}

        {/* Scorecard View Toggle - Available to all users if Nassau games exist */}
        {hasNassauGames && (
          <div className="flex gap-1 text-[11px] font-medium rounded-md overflow-hidden border border-primary-200 bg-primary-50">
            <button key="individual" onClick={()=>setScorecardView(eventId, 'individual')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='individual'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              individual
            </button>
            <button key="team" onClick={()=>setScorecardView(eventId, 'team')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='team'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              team
            </button>
            {canUseGuestScorecards && (
              <button key="admin" onClick={()=>setScorecardView(eventId, 'admin')}
                className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='admin'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
                {isEventOwner ? 'admin' : allowSharedScoreEntry ? 'all' : 'guests'}
              </button>
            )}
          </div>
        )}

        {/* Individual / guest view for non-Nassau events */}
        {!hasNassauGames && canUseGuestScorecards && (
          <div className="flex gap-1 text-[11px] font-medium rounded-md overflow-hidden border border-primary-200 bg-primary-50">
            <button key="individual" onClick={()=>setScorecardView(eventId, 'individual')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='individual'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              individual
            </button>
            <button key="admin" onClick={()=>setScorecardView(eventId, 'admin')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='admin'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              {isEventOwner ? 'admin' : allowSharedScoreEntry ? 'all' : 'guests'}
            </button>
          </div>
        )}

        <div className="text-[8px] sm:text-[9px] flex flex-wrap gap-1 leading-tight">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-amber-400 block"></span> Eagle</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-red-500 block"></span> Birdie</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-neutral-200 border border-neutral-300 block"></span> Par</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-blue-200 block"></span> Bogey</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-blue-400 block"></span> Dbl</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-blue-700 block"></span> 3+</span>
        </div>
      </div>

      {/* Team entry view */}
      {entryMode === 'team' && isTeamScorecard ? (
        <div className="p-3 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">Team entry</div>
                <div className="font-extrabold text-slate-900">
                  Hole {teamHole}{teamHoleMeta?.par ? ` • Par ${teamHoleMeta.par}` : ''}
                </div>
                <div className="text-[11px] text-slate-600">Enter your team’s scores for this hole.</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTeamHole((h) => Math.max(1, h - 1))}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setTeamHole((h) => Math.min(18, h + 1))}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleGolfers.map((eventGolfer: any) => {
                const profile = eventGolfer.profileId ? profiles.find((p: any) => p.id === eventGolfer.profileId) : null;
                const name = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
                const gid = eventGolfer.profileId || eventGolfer.customName;
                if (!name || !gid) return null;
                const canEdit = !isGuest && canEditScore(eventId, gid) && !event.isCompleted;
                const sc = event.scorecards.find((s: any) => s.golferId === gid);
                const existing = sc?.scores?.find((s: any) => s.hole === teamHole)?.strokes ?? null;
                return (
                  <label key={gid} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-slate-900 truncate">{name}</div>
                      {!canEdit && <div className="text-[10px] text-slate-500">Read-only</div>}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={existing == null ? '' : existing}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const strokes = raw === '' ? null : Number(raw);
                        handleScoreUpdate(gid, teamHole, Number.isFinite(strokes as number) ? (strokes as number) : null);
                      }}
                      disabled={!canEdit}
                      className={`w-20 text-center text-lg font-black border rounded-xl px-2 py-2 bg-white disabled:opacity-50 transition-all ${savedCell === `${gid}-${teamHole}` ? 'border-green-500 ring-2 ring-green-300' : 'border-slate-300'}`}
                      aria-label={`Score for ${name} on hole ${teamHole}`}
                      placeholder="—"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* All views now use the stacked card layout */
        <div className="space-y-3 p-1 sm:p-2">
        {visibleGolfers.map((eventGolfer: any) => {
          const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
          const displayName = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
          if (!displayName) return null;

          const golferId = eventGolfer.profileId || eventGolfer.customName;
          const canEdit = !isGuest && canEditScore(eventId, golferId) && !event.isCompleted;
          const sc = event.scorecards.find((s: any) => s.golferId === golferId)!;

          // Calculate score to par
          const allScores = sc.scores.map((s: any) => s.strokes);
          const allComplete = allScores.every((v: any) => v != null);
          const totalScore = allComplete ? allScores.reduce((a: number, b: number) => a + b, 0) : null;
          const parsKnown = holes.every((h: any) => typeof h.par === 'number');
          const coursePar = parsKnown ? holes.reduce((a: number, h: any) => a + (h.par as number), 0) : null;
          const scoreToPar = totalScore != null && coursePar != null ? totalScore - coursePar : null;

          return (
            <div
              key={golferId}
              ref={(el) => { cardRefs.current[golferId] = el; }}
              className={`bg-white rounded-lg border overflow-hidden shadow-sm transition-shadow ${
                flashGolferId === golferId ? 'border-primary-600 shadow-md ring-2 ring-primary-200' : 'border-primary-200'
              }`}
            >
                {/* Golfer header */}
                <div className="bg-primary-700 px-2 sm:px-3 py-2 border-b border-primary-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{displayName}</span>
                      {scoreToPar != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          scoreToPar < 0 ? 'bg-red-500 text-white' :
                          scoreToPar === 0 ? 'bg-white/90 text-gray-800' :
                          'bg-gray-600 text-white'
                        }`}>
                          {scoreToPar === 0 ? 'E' : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white font-medium">
                      {(() => {
                        const handicap = eventGolfer.handicapOverride ?? (profile?.handicapIndex ?? null);
                        return handicap != null ? `CH ${courseHandicap(event, golferId, profiles)?.toFixed(1) || 'N/A'}` : '';
                      })()}
                      {!canEdit && <span className="ml-2 bg-white/20 px-1 rounded text-white/80">Read-only</span>}
                    </div>
                  </div>
                </div>

                {/* Desktop optimization: show Front/Back side-by-side in full view */}
                <div className={`${view === 'full' ? 'lg:grid lg:grid-cols-2' : ''}`}>
                {/* Front 9 - only show if view is 'front' or 'full' */}
                {(view === 'front' || view === 'full') && (
                <div className={`p-2 sm:p-3 ${view === 'full' ? 'lg:border-r lg:border-slate-200' : ''}`}>
                  <div className="text-xs font-semibold text-slate-600 mb-1 sm:mb-2">Front Nine</div>
                  {coursesLoading && event.course.courseId && !teeWithHoles?.holes?.length && (
                    <div className="text-[10px] text-slate-500 mb-1">Loading course pars…</div>
                  )}
                  <div className="space-y-0.5 sm:space-y-1">
                    {/* Hole numbers 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Hole</div>
                      {front.map((hole: any) => (
                        <div key={`hole-${hole.number}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center">
                          {hole.number}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 lg:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center ml-0.5 sm:ml-1">Out</div>
                    </div>
                    
                    {/* Par 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Par</div>
                      {front.map((hole: any) => (
                        <div key={`par-${hole.number}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-100 rounded">
                          {typeof hole.par === 'number' ? hole.par : '—'}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 lg:w-12 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 sm:ml-1 font-semibold">
                        {front.every((h: any) => typeof h.par === 'number')
                          ? front.reduce((a: number, h: any) => a + (h.par as number), 0)
                          : '—'}
                      </div>
                    </div>
                    
                    {/* Scores 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-700 py-1">Score</div>
                      {sc.scores.slice(0, 9).map((s: any) => {
                        const holeMeta = holes.find((h: any) => h.number === s.hole);
                        const par = typeof holeMeta?.par === 'number' ? holeMeta.par : null;
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const diff = gross != null && par != null ? gross - par : null;
                        // Golf convention: Red = under par (birdie), Blue = over par (bogey)
                        let colorClass = 'bg-white text-gray-900';
                        if (diff != null) {
                          if (diff <= -2) colorClass = 'bg-amber-400 text-amber-950 font-bold';       // Eagle+: gold
                          else if (diff === -1) colorClass = 'bg-red-500 text-white font-semibold';    // Birdie: RED
                          else if (diff === 0) colorClass = 'bg-neutral-100 text-gray-900';            // Par: neutral
                          else if (diff === 1) colorClass = 'bg-blue-200 text-blue-900';               // Bogey: blue
                          else if (diff === 2) colorClass = 'bg-blue-400 text-white font-semibold';    // Double: darker blue
                          else if (diff >= 3) colorClass = 'bg-blue-700 text-white font-semibold';     // Triple+: darkest blue
                        }
                        
                        const cellKey = `${golferId}-${s.hole}`;
                        const isJustSaved = savedCell === cellKey;
                        
                        return (
                          <div key={s.hole} className="w-7 sm:w-8 lg:w-10 xl:w-12 relative">
                            {hcpStrokes > 0 && (
                              <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                                {Array.from({ length: hcpStrokes }).map((_, i) => (
                                  <span key={i} className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-primary-700 block"></span>
                                ))}
                              </div>
                            )}
                            {/* Save flash indicator */}
                            {isJustSaved && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center animate-ping">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            <input
                              className={`w-full h-7 sm:h-8 lg:h-10 px-0.5 py-0 text-center text-[10px] sm:text-xs lg:text-sm outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition-all rounded border ${isJustSaved ? 'border-green-500 ring-2 ring-green-300' : 'border-slate-200'} ${colorClass} ${hcpStrokes > 0 ? 'pl-2 sm:pl-3' : ''} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={gross ?? ''}
                              disabled={!canEdit}
                              inputMode="numeric"
                              aria-label={`${displayName} hole ${s.hole} score`}
                              title={`${displayName} hole ${s.hole} score`}
                              data-golfer={golferId}
                              data-hole={s.hole}
                              onFocus={e => {
                                if (e.target.value) {
                                  e.target.select();
                                }
                              }}
                              onChange={e => {
                                if (!canEdit) return;
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const val = raw === '' ? '' : raw;
                                const numeric = val === '' ? null : parseInt(val, 10);
                                handleScoreUpdate(golferId, s.hole, numeric);
                                const shouldAdvance = (val.length === 1 && val !== '1') || val.length === 2;
                                if (shouldAdvance) {
                                  const next = document.querySelector(`input[data-golfer='${golferId}'][data-hole='${s.hole + 1}']`) as HTMLInputElement | null;
                                  if (next) {
                                    requestAnimationFrame(() => { next.focus(); next.select(); });
                                  }
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 lg:w-14 h-7 sm:h-8 lg:h-10 flex items-center justify-center text-[10px] sm:text-xs font-black bg-primary-600 text-white rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const frontScores = sc.scores.slice(0, 9).map((s: any) => s.strokes).filter((v: any) => v != null) as number[];
                          return frontScores.length > 0 ? frontScores.reduce((a: number, b: number) => a + b, 0) : '—';
                        })()}
                      </div>
                    </div>

                    {/* Net Scores 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-bold text-primary-800 py-1">Net</div>
                      {sc.scores.slice(0, 9).map((s: any) => {
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const net = gross != null ? gross - hcpStrokes : null;
                        
                        return (
                          <div key={`net-${s.hole}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs py-1 text-center text-primary-800 font-bold">
                            {net !== null ? net : ''}
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 lg:w-14 h-7 sm:h-8 lg:h-10 flex items-center justify-center text-[10px] sm:text-xs font-black bg-primary-500 text-white rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const frontNets = sc.scores.slice(0, 9).map((s: any) => {
                            const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                            const gross = s.strokes;
                            return gross != null ? gross - hcpStrokes : null;
                          }).filter((v: any) => v != null) as number[];
                          return frontNets.length > 0 ? frontNets.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Back 9 - only show if view is 'back' or 'full' */}
                {(view === 'back' || view === 'full') && (
                <div className={`p-2 sm:p-3 ${view === 'full' ? 'border-t border-slate-200 lg:border-t-0 lg:border-l lg:border-slate-200' : ''}`}>
                  <div className="text-xs font-semibold text-slate-600 mb-1 sm:mb-2">Back Nine</div>
                  {coursesLoading && event.course.courseId && !teeWithHoles?.holes?.length && (
                    <div className="text-[10px] text-slate-500 mb-1">Loading course pars…</div>
                  )}
                  <div className="space-y-0.5 sm:space-y-1">
                    {/* Hole numbers 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Hole</div>
                      {back.map((hole: any) => (
                        <div key={`hole-${hole.number}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center">
                          {hole.number}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 lg:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center ml-0.5 sm:ml-1">In</div>
                    </div>
                    
                    {/* Par 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Par</div>
                      {back.map((hole: any) => (
                        <div key={`par-${hole.number}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-100 rounded">
                          {typeof hole.par === 'number' ? hole.par : '—'}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 lg:w-12 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 sm:ml-1 font-semibold">
                        {back.every((h: any) => typeof h.par === 'number')
                          ? back.reduce((a: number, h: any) => a + (h.par as number), 0)
                          : '—'}
                      </div>
                    </div>
                    
                    {/* Scores 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-semibold text-slate-700 py-1">Score</div>
                      {sc.scores.slice(9, 18).map((s: any) => {
                        const holeMeta = holes.find((h: any) => h.number === s.hole);
                        const par = typeof holeMeta?.par === 'number' ? holeMeta.par : null;
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const diff = gross != null && par != null ? gross - par : null;
                        // Golf convention: Red = under par (birdie), Blue = over par (bogey)
                        let colorClass = 'bg-white text-gray-900';
                        if (diff != null) {
                          if (diff <= -2) colorClass = 'bg-amber-400 text-amber-950 font-bold';       // Eagle+: gold
                          else if (diff === -1) colorClass = 'bg-red-500 text-white font-semibold';    // Birdie: RED
                          else if (diff === 0) colorClass = 'bg-neutral-100 text-gray-900';            // Par: neutral
                          else if (diff === 1) colorClass = 'bg-blue-200 text-blue-900';               // Bogey: blue
                          else if (diff === 2) colorClass = 'bg-blue-400 text-white font-semibold';    // Double: darker blue
                          else if (diff >= 3) colorClass = 'bg-blue-700 text-white font-semibold';     // Triple+: darkest blue
                        }
                        
                        const cellKey = `${golferId}-${s.hole}`;
                        const isJustSaved = savedCell === cellKey;
                        
                        return (
                          <div key={s.hole} className="w-7 sm:w-8 lg:w-10 xl:w-12 relative">
                            {hcpStrokes > 0 && (
                              <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                                {Array.from({ length: hcpStrokes }).map((_, i) => (
                                  <span key={i} className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-primary-700 block"></span>
                                ))}
                              </div>
                            )}
                            {/* Save flash indicator */}
                            {isJustSaved && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center animate-ping">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            <input
                              className={`w-full h-7 sm:h-8 lg:h-10 px-0.5 py-0 text-center text-[10px] sm:text-xs lg:text-sm outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition-all rounded border ${isJustSaved ? 'border-green-500 ring-2 ring-green-300' : 'border-slate-200'} ${colorClass} ${hcpStrokes > 0 ? 'pl-2 sm:pl-3' : ''} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={gross ?? ''}
                              disabled={!canEdit}
                              inputMode="numeric"
                              aria-label={`${displayName} hole ${s.hole} score`}
                              title={`${displayName} hole ${s.hole} score`}
                              data-golfer={golferId}
                              data-hole={s.hole}
                              onFocus={e => {
                                if (e.target.value) {
                                  e.target.select();
                                }
                              }}
                              onChange={e => {
                                if (!canEdit) return;
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const val = raw === '' ? '' : raw;
                                const numeric = val === '' ? null : parseInt(val, 10);
                                handleScoreUpdate(golferId, s.hole, numeric);
                                const shouldAdvance = (val.length === 1 && val !== '1') || val.length === 2;
                                if (shouldAdvance) {
                                  const next = document.querySelector(`input[data-golfer='${golferId}'][data-hole='${s.hole + 1}']`) as HTMLInputElement | null;
                                  if (next) {
                                    requestAnimationFrame(() => { next.focus(); next.select(); });
                                  }
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 lg:w-14 h-7 sm:h-8 lg:h-10 flex items-center justify-center text-[10px] sm:text-xs font-black bg-primary-600 text-white rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const backScores = sc.scores.slice(9, 18).map((s: any) => s.strokes).filter((v: any) => v != null) as number[];
                          return backScores.length > 0 ? backScores.reduce((a: number, b: number) => a + b, 0) : '—';
                        })()}
                      </div>
                    </div>

                    {/* Net Scores 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 lg:w-14 text-[10px] sm:text-xs font-bold text-primary-800 py-1">Net</div>
                      {sc.scores.slice(9, 18).map((s: any) => {
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const net = gross != null ? gross - hcpStrokes : null;
                        
                        return (
                          <div key={`net-${s.hole}`} className="w-7 sm:w-8 lg:w-10 xl:w-12 text-[10px] sm:text-xs py-1 text-center text-primary-800 font-bold">
                            {net !== null ? net : ''}
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 lg:w-14 h-7 sm:h-8 lg:h-10 flex items-center justify-center text-[10px] sm:text-xs font-black bg-primary-500 text-white rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const backNets = sc.scores.slice(9, 18).map((s: any) => {
                            const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                            const gross = s.strokes;
                            return gross != null ? gross - hcpStrokes : null;
                          }).filter((v: any) => v != null) as number[];
                          return backNets.length > 0 ? backNets.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                )}
                </div>

                {/* Total - show only in 'full' view */}
                {view === 'full' && (
                <div className="px-3 py-2 bg-primary-700 border-t border-primary-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">Total</span>
                    <span className="text-lg font-black text-white">
                      {(() => {
                        const allScores = sc.scores.map((s: any) => s.strokes).filter((v: any) => v != null) as number[];
                        return allScores.length > 0 ? allScores.reduce((a: number, b: number) => a + b, 0) : '—';
                      })()}
                    </span>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fixed bottom Done CTA - always visible, no scrolling needed */}
      {onDone && !event.isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-slate-900/95 via-slate-900/90 to-transparent">
          <button
            onClick={handleDone}
            className="w-full max-w-lg mx-auto flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold text-lg rounded-2xl shadow-xl shadow-green-900/30 hover:from-green-600 hover:to-emerald-700 active:scale-[0.98] transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default ScorecardTab;
