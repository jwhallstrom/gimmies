import React, { useState, useEffect } from 'react';
import useStore from '../../state/store';
import { strokesForHole, courseHandicap } from '../../games/handicap';
import { useCourse } from '../../hooks/useCourse';

type Props = { eventId: string };

const ScorecardTab: React.FC<Props> = ({ eventId }) => {
  const { events, completedEvents, profiles, currentProfile, updateScore, canEditScore, setScorecardView } = useStore();
  const event = events.find((e: any) => e.id === eventId) || completedEvents.find((e: any) => e.id === eventId);
  if (!event) return null;

  // Load only the selected course from DynamoDB (faster than loading full catalog)
  const { course: selectedCourse, loading: coursesLoading } = useCourse(event.course.courseId);

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

  // On very small screens default to full to avoid horizontal scroll.
  useEffect(()=>{
    if (typeof window !== 'undefined' && window.innerWidth < 640) setView('full');
  },[]);

  const showFront = view === 'front' || view === 'full';
  const showBack = view === 'back' || view === 'full';

  // Filter golfers based on scorecard view permissions
  const visibleGolfers = event.golfers.filter(eventGolfer => {
    const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
    // Use displayName snapshot first (for cross-device compatibility), fall back to profile lookup, then customName
    const displayName = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
    if (!displayName) return false;

    const golferId = eventGolfer.profileId || eventGolfer.customName;
    if (!golferId) return false; // Ensure golferId is defined

    const isEventOwner = currentProfile?.id === event.ownerProfileId;
    const isCurrentUser = golferId === currentProfile?.id;

    // Event owner permissions
    if (isEventOwner) {
      if (event.scorecardView === 'individual') {
        // Only show owner's own scorecard
        return isCurrentUser;
      } else if (event.scorecardView === 'team') {
        // Show owner's team in Nassau games
        if (!currentProfile) return false;

        // Find all teams in Nassau games that include the current user (owner)
        const userTeams = event.games.nassau.flatMap(nassau =>
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

      // Can see team members if they're on a team together in Nassau games
      if (currentProfile) {
        const userTeams = event.games.nassau.flatMap(nassau =>
          nassau.teams?.filter(team => team.golferIds.includes(currentProfile.id)) || []
        );
        const teamGolferIds = userTeams.flatMap(team => team.golferIds);
        return teamGolferIds.includes(golferId);
      }
    }

    return false;
  });

  const isEventOwner = currentProfile?.id === event.ownerProfileId;
  const hasNassauGames = event.games.nassau.length > 0;

  // Auto-switch from team view to individual if no Nassau games exist
  React.useEffect(() => {
    if (event.scorecardView === 'team' && !hasNassauGames && isEventOwner) {
      setScorecardView(eventId, 'individual');
    }
  }, [event.scorecardView, hasNassauGames, isEventOwner, eventId, setScorecardView]);

  return (
    <div className="overflow-x-auto rounded-lg shadow-inner bg-white/95 backdrop-blur border border-primary-900/10">
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
            {isEventOwner && (
              <button key="admin" onClick={()=>setScorecardView(eventId, 'admin')}
                className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='admin'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
                admin
              </button>
            )}
          </div>
        )}

        {/* Individual View Only for non-Nassau events or when no Nassau games */}
        {!hasNassauGames && isEventOwner && (
          <div className="flex gap-1 text-[11px] font-medium rounded-md overflow-hidden border border-primary-200 bg-primary-50">
            <button key="individual" onClick={()=>setScorecardView(eventId, 'individual')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='individual'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              individual
            </button>
            <button key="admin" onClick={()=>setScorecardView(eventId, 'admin')}
              className={`px-2 py-1 capitalize tracking-wide ${event.scorecardView==='admin'? 'bg-red-600 text-white':'text-primary-700 hover:bg-primary-100'}`}>
              admin
            </button>
          </div>
        )}

        <div className="text-[8px] sm:text-[9px] flex flex-wrap gap-1 leading-tight">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-fuchsia-600 block"></span> ≤-3</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-amber-500 block"></span> -2</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-green-500 block"></span> -1</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-neutral-200 border border-neutral-300 block"></span> E</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-orange-200 block"></span> +1</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-red-300 block"></span> +2</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-red-600 block"></span> 3+</span>
        </div>
      </div>
      {/* All views now use the stacked card layout */}
      <div className="space-y-3 p-1 sm:p-2">
        {visibleGolfers.map((eventGolfer: any) => {
          const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
          const displayName = eventGolfer.displayName || (profile ? profile.name : eventGolfer.customName);
          if (!displayName) return null;

          const golferId = eventGolfer.profileId || eventGolfer.customName;
          const canEdit = canEditScore(eventId, golferId) && !event.isCompleted;
          const sc = event.scorecards.find((s: any) => s.golferId === golferId)!;

          // Calculate score to par
          const allScores = sc.scores.map((s: any) => s.strokes);
          const allComplete = allScores.every((v: any) => v != null);
          const totalScore = allComplete ? allScores.reduce((a: number, b: number) => a + b, 0) : null;
          const parsKnown = holes.every((h: any) => typeof h.par === 'number');
          const coursePar = parsKnown ? holes.reduce((a: number, h: any) => a + (h.par as number), 0) : null;
          const scoreToPar = totalScore != null && coursePar != null ? totalScore - coursePar : null;

          return (
            <div key={golferId} className="bg-white rounded-lg border border-primary-200 overflow-hidden shadow-sm">
                {/* Golfer header */}
                <div className="bg-primary-50 px-2 sm:px-3 py-2 border-b border-primary-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{displayName}</span>
                      {scoreToPar != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          scoreToPar < 0 ? 'bg-green-500 text-white' :
                          scoreToPar === 0 ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-primary-700">
                      {(() => {
                        const handicap = eventGolfer.handicapOverride ?? (profile?.handicapIndex ?? null);
                        return handicap != null ? `CH ${courseHandicap(event, golferId, profiles)?.toFixed(1) || 'N/A'}` : '';
                      })()}
                      {!canEdit && <span className="ml-2 bg-gray-100 px-1 rounded">Read-only</span>}
                    </div>
                  </div>
                </div>

                {/* Front 9 - only show if view is 'front' or 'full' */}
                {(view === 'front' || view === 'full') && (
                <div className="p-2 sm:p-3">
                  <div className="text-xs font-semibold text-slate-600 mb-1 sm:mb-2">Front Nine</div>
                  {coursesLoading && event.course.courseId && !teeWithHoles?.holes?.length && (
                    <div className="text-[10px] text-slate-500 mb-1">Loading course pars…</div>
                  )}
                  <div className="space-y-0.5 sm:space-y-1">
                    {/* Hole numbers 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Hole</div>
                      {front.map((hole: any) => (
                        <div key={`hole-${hole.number}`} className="w-7 sm:w-8 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center">
                          {hole.number}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center ml-0.5 sm:ml-1">Out</div>
                    </div>
                    
                    {/* Par 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Par</div>
                      {front.map((hole: any) => (
                        <div key={`par-${hole.number}`} className="w-7 sm:w-8 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-100 rounded">
                          {typeof hole.par === 'number' ? hole.par : '—'}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 sm:ml-1 font-semibold">
                        {front.every((h: any) => typeof h.par === 'number')
                          ? front.reduce((a: number, h: any) => a + (h.par as number), 0)
                          : '—'}
                      </div>
                    </div>
                    
                    {/* Scores 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-700 py-1">Score</div>
                      {sc.scores.slice(0, 9).map((s: any) => {
                        const holeMeta = holes.find((h: any) => h.number === s.hole);
                        const par = typeof holeMeta?.par === 'number' ? holeMeta.par : null;
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const diff = gross != null && par != null ? gross - par : null;
                        let colorClass = '';
                        if (diff != null) {
                          if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                          else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                          else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                          else if (diff === 0) colorClass = 'bg-neutral-50';
                          else if (diff === 1) colorClass = 'bg-orange-200';
                          else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                          else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                        }
                        
                        return (
                          <div key={s.hole} className="w-7 sm:w-8 relative">
                            {hcpStrokes > 0 && (
                              <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                                {Array.from({ length: hcpStrokes }).map((_, i) => (
                                  <span key={i} className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-primary-700 block"></span>
                                ))}
                              </div>
                            )}
                            <input
                              className={`w-full h-7 sm:h-8 px-0.5 py-0 text-center text-[10px] sm:text-xs outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition rounded ${colorClass} ${hcpStrokes > 0 ? 'pl-2 sm:pl-3' : ''} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                updateScore(eventId, golferId, s.hole, numeric);
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
                      <div className="w-8 sm:w-12 text-[10px] sm:text-xs py-1 text-center font-semibold bg-slate-100 rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const frontScores = sc.scores.slice(0, 9).map((s: any) => s.strokes);
                          const completeFront = frontScores.every((v: any) => v != null);
                          return completeFront ? frontScores.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>

                    {/* Net Scores 1-9 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-medium text-primary-700 py-1">Net</div>
                      {sc.scores.slice(0, 9).map((s: any) => {
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const net = gross != null ? gross - hcpStrokes : null;
                        
                        return (
                          <div key={`net-${s.hole}`} className="w-7 sm:w-8 text-[10px] sm:text-xs py-1 text-center text-primary-700 font-medium">
                            {net !== null ? net : ''}
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 text-[10px] sm:text-xs py-1 text-center font-medium text-primary-700 bg-primary-50 rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const frontNets = sc.scores.slice(0, 9).map((s: any) => {
                            const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                            const gross = s.strokes;
                            return gross != null ? gross - hcpStrokes : null;
                          }).filter((v: any) => v != null) as number[];
                          return frontNets.length === 9 ? frontNets.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Back 9 - only show if view is 'back' or 'full' */}
                {(view === 'back' || view === 'full') && (
                <div className="p-2 sm:p-3 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1 sm:mb-2">Back Nine</div>
                  {coursesLoading && event.course.courseId && !teeWithHoles?.holes?.length && (
                    <div className="text-[10px] text-slate-500 mb-1">Loading course pars…</div>
                  )}
                  <div className="space-y-0.5 sm:space-y-1">
                    {/* Hole numbers 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Hole</div>
                      {back.map((hole: any) => (
                        <div key={`hole-${hole.number}`} className="w-7 sm:w-8 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center">
                          {hole.number}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 text-[10px] sm:text-xs font-semibold text-slate-600 py-1 text-center ml-0.5 sm:ml-1">In</div>
                    </div>
                    
                    {/* Par 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-600 py-1">Par</div>
                      {back.map((hole: any) => (
                        <div key={`par-${hole.number}`} className="w-7 sm:w-8 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-100 rounded">
                          {typeof hole.par === 'number' ? hole.par : '—'}
                        </div>
                      ))}
                      <div className="w-8 sm:w-10 text-[10px] sm:text-xs text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 sm:ml-1 font-semibold">
                        {back.every((h: any) => typeof h.par === 'number')
                          ? back.reduce((a: number, h: any) => a + (h.par as number), 0)
                          : '—'}
                      </div>
                    </div>
                    
                    {/* Scores 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-semibold text-slate-700 py-1">Score</div>
                      {sc.scores.slice(9, 18).map((s: any) => {
                        const holeMeta = holes.find((h: any) => h.number === s.hole);
                        const par = typeof holeMeta?.par === 'number' ? holeMeta.par : null;
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const diff = gross != null && par != null ? gross - par : null;
                        let colorClass = '';
                        if (diff != null) {
                          if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                          else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                          else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                          else if (diff === 0) colorClass = 'bg-neutral-50';
                          else if (diff === 1) colorClass = 'bg-orange-200';
                          else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                          else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                        }
                        
                        return (
                          <div key={s.hole} className="w-7 sm:w-8 relative">
                            {hcpStrokes > 0 && (
                              <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                                {Array.from({ length: hcpStrokes }).map((_, i) => (
                                  <span key={i} className="w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-primary-700 block"></span>
                                ))}
                              </div>
                            )}
                            <input
                              className={`w-full h-7 sm:h-8 px-0.5 py-0 text-center text-[10px] sm:text-xs outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition rounded ${colorClass} ${hcpStrokes > 0 ? 'pl-2 sm:pl-3' : ''} ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                updateScore(eventId, golferId, s.hole, numeric);
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
                      <div className="w-8 sm:w-12 text-[10px] sm:text-xs py-1 text-center font-semibold bg-slate-100 rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const backScores = sc.scores.slice(9, 18).map((s: any) => s.strokes);
                          const completeBack = backScores.every((v: any) => v != null);
                          return completeBack ? backScores.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>

                    {/* Net Scores 10-18 */}
                    <div className="flex gap-0.5 sm:gap-1">
                      <div className="w-10 sm:w-12 text-[10px] sm:text-xs font-medium text-primary-700 py-1">Net</div>
                      {sc.scores.slice(9, 18).map((s: any) => {
                        const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                        const gross = s.strokes;
                        const net = gross != null ? gross - hcpStrokes : null;
                        
                        return (
                          <div key={`net-${s.hole}`} className="w-7 sm:w-8 text-[10px] sm:text-xs py-1 text-center text-primary-700 font-medium">
                            {net !== null ? net : ''}
                          </div>
                        );
                      })}
                      <div className="w-8 sm:w-12 text-[10px] sm:text-xs py-1 text-center font-medium text-primary-700 bg-primary-50 rounded ml-0.5 sm:ml-1">
                        {(() => {
                          const backNets = sc.scores.slice(9, 18).map((s: any) => {
                            const hcpStrokes = strokesForHole(event, golferId, s.hole, profiles);
                            const gross = s.strokes;
                            return gross != null ? gross - hcpStrokes : null;
                          }).filter((v: any) => v != null) as number[];
                          return backNets.length === 9 ? backNets.reduce((a: number, b: number) => a + b, 0) : '';
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {/* Total - show only in 'full' view */}
                {view === 'full' && (
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-bold">
                      {(() => {
                        const allScores = sc.scores.map((s: any) => s.strokes);
                        const allComplete = allScores.every((v: any) => v != null);
                        return allComplete ? allScores.reduce((a: number, b: number) => a + b, 0) : '';
                      })()}
                    </span>
                  </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
};

export default ScorecardTab;
