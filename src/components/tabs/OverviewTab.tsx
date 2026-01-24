import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { calculateEventPayouts } from '../../games/payouts';
import { netScore } from '../../games/handicap';
import { courseMap } from '../../data/courses';
import { useCourses } from '../../hooks/useCourses';
import { EventSettlement } from '../wallet';
import RoundRecapCard from '../RoundRecapCard';
import { generateRoundRecap } from '../../utils/roundRecap';

type Props = { eventId: string };

const currency = (n: number) => '$' + n.toFixed(2);
const signedCurrency = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + currency(Math.abs(n));

const OverviewTab: React.FC<Props> = ({ eventId }) => {
  const { profiles, completeEvent, currentProfile, getEventSettlements } = useStore();
  const navigate = useNavigate();
  const [showSettlements, setShowSettlements] = useState(false);
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  if (!event) return null;

  // Use cloud course data (selected tee) to ensure par values match the scorecard.
  const { courses } = useCourses();
  const selectedCourse = event.course.courseId
    ? courses.find(c => c.courseId === event.course.courseId)
    : undefined;
  const selectedTeeName = event.course.teeName;
  const selectedTee = selectedCourse?.tees.find(t => t.name === selectedTeeName);
  const teeWithHoles = selectedTee || selectedCourse?.tees?.[0];
  const courseHoles = teeWithHoles?.holes?.length
    ? teeWithHoles.holes
    : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));

  const getHolePar = (holeNumber: number) => {
    const cloudHole = courseHoles.find(h => h.number === holeNumber);
    if (cloudHole?.par) return cloudHole.par;
    if (event.course.courseId) {
      const staticCourse = courseMap[event.course.courseId];
      const staticHole = staticCourse?.holes?.find((h: any) => h.number === holeNumber);
      if (staticHole?.par) return staticHole.par;
    }
    return 4;
  };
  
  const payouts = calculateEventPayouts(event, profiles);
  const skinsArray = Array.isArray(payouts.skins) ? payouts.skins : (payouts.skins ? [payouts.skins as any] : []);
  
  // Create mapping of golfer IDs to display names using snapshots
  const golfersById = Object.fromEntries(
    event.golfers.map((eventGolfer: any) => {
      // Use displayName snapshot first (cross-device compatible), fallback to profile lookup, then customName
      const displayName = eventGolfer.displayName || 
                         (eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId)?.name : null) ||
                         eventGolfer.customName;
      const golferId = eventGolfer.profileId || eventGolfer.customName;
      return [golferId, displayName];
    }).filter(([id, name]: [string, string]) => id && name)
  );
  
  const incomplete = event.scorecards.some((sc: any) => sc.scores.some((s: any) => s.strokes == null));
  
  const handleCompleteEvent = () => {
    if (window.confirm('Are you sure you want to complete this event? This will finalize all scores and payouts, and move the event to history. This action cannot be undone.')) {
      const success = completeEvent(eventId);
      if (success) {
        alert('Event completed successfully! Round data has been saved to your analytics. The event has been moved to your History tab.');
        // Small delay to ensure state propagates before navigation
        setTimeout(() => {
          navigate('/events');
        }, 100);
      } else {
        alert('Failed to complete event. Please ensure all scores are entered.');
      }
    }
  };
  
  // Build buy-in totals per golfer (fees paid regardless of eventual winnings)
  const buyinByGolfer: Record<string, number> = {};
  event.golfers.forEach((eventGolfer: any) => { 
    const golferId = eventGolfer.profileId || eventGolfer.customName;
    if (golferId) buyinByGolfer[golferId] = 0; 
  });
  // Nassau: each paying participant contributes its fee once (if configuration valid)
  payouts.nassau.forEach(n => {
    const cfg = event.games.nassau.find((c: any) => c.id === n.configId);
    if (!cfg) return;
    const group = event.groups.find((gr: any) => gr.id === cfg.groupId);
    if (!group) return;
    let players: string[] = group.golferIds.slice();
    // Respect per-golfer game preference (Nassau = "all games" only)
    players = players.filter((gid) => {
      const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
      const pref: 'all' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
      return pref === 'all';
    });
    if (cfg.participantGolferIds && cfg.participantGolferIds.length > 1) {
      players = players.filter(p => cfg.participantGolferIds!.includes(p));
    }
    const isTeam = cfg.teams && cfg.teams.length >= 2;
    if (isTeam) {
      const assigned = new Set<string>();
      (cfg.teams || []).forEach((t: any) => t.golferIds.forEach((gid: string) => { if (players.includes(gid)) assigned.add(gid); }));
      players = players.filter(p => assigned.has(p));
    }
    if (players.length < 2) return;
    const fees = cfg.fees ?? { out: cfg.fee, in: cfg.fee, total: cfg.fee };
    const perPlayer = (fees.out || 0) + (fees.in || 0) + (fees.total || 0);
    players.forEach(pid => { buyinByGolfer[pid] += perPlayer; });
  });
  // Skins: every golfer pays each skins config fee
  const skinsConfigs: any[] = Array.isArray(event.games.skins) ? event.games.skins : (event.games.skins ? [event.games.skins] : []);
  skinsConfigs.forEach(sk => {
    const eligible = (gid: string) => {
      const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
      const pref: 'all' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
      return pref === 'all' || pref === 'skins';
    };
    const base = event.golfers
      .map((g: any) => g.profileId || g.customName || g.displayName)
      .filter((id: any) => !!id)
      .filter((id: string) => eligible(id));
    const skinParticipants = sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds.filter((id: string) => eligible(id)) : base;
    skinParticipants.forEach((gid: string) => { buyinByGolfer[gid] += sk.fee; });
  });
  // Pinky: NO buy-in - players only pay if they get pinkys (penalty game)
  // Greenie: NO buy-in - players only pay winners when they get greenies (performance game)
  const payoutByGolfer = payouts.totalByGolfer;
  const netByGolfer: Record<string, number> = {};
  Object.keys(payoutByGolfer).forEach((gid) => {
    netByGolfer[gid] = (payoutByGolfer[gid] || 0) - (buyinByGolfer[gid] || 0);
  });

  const myGolferId = currentProfile?.id;
  const myNet = myGolferId ? netByGolfer[myGolferId] ?? 0 : null;
  const myBuyin = myGolferId ? buyinByGolfer[myGolferId] ?? 0 : null;

  return (
  <div className="space-y-6">
      {/* Complete Event Button or Completed Status */}
      {currentProfile && event.ownerProfileId === currentProfile.id && (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-4 border border-primary-900/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary-800">
                {event.isCompleted ? 'Event Completed' : 'Complete Event'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {event.isCompleted
                  ? `This event was completed on ${new Date(event.completedAt).toLocaleDateString()}. All scores and payouts are final.`
                  : incomplete 
                    ? 'Complete all scores before finishing the event.' 
                    : 'Finalize scores, calculate payouts, and save round data to analytics.'
                }
              </p>
            </div>
            {!event.isCompleted && (
              <div className="flex gap-2">
                <button
                  onClick={handleCompleteEvent}
                  disabled={incomplete}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    incomplete
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  title={incomplete ? 'Complete all scores first' : 'Complete this event'}
                >
                  Complete Event
                </button>
                {/* Debug helper button - keep DEV only */}
                {import.meta.env.DEV && incomplete && currentProfile && event.ownerProfileId === currentProfile.id && (
                  <button
                    onClick={() => {
                      const mode = window.prompt(
                        'Fill empty scores for testing.\n\nEnter:\n- "par" to use the course par per hole\n- "demo" to use a demo pattern (par + small offsets per golfer)\n- "random" to generate realistic random scores\n\nOnly empty holes are filled.',
                        'par'
                      );

                      if (!mode) return;

                      const normalizedMode = mode.trim().toLowerCase();
                      if (normalizedMode !== 'par' && normalizedMode !== 'demo' && normalizedMode !== 'random') {
                        alert('Invalid mode. Enter "par", "demo", or "random".');
                        return;
                      }

                      if (window.confirm('Proceed filling empty scores?')) {
                        const { updateScore } = useStore.getState();

                        const holePar = (holeNumber: number) => getHolePar(holeNumber);

                        const golferIndexById = new Map<string, number>();
                        event.scorecards.forEach((sc: any, idx: number) => {
                          if (sc?.golferId) golferIndexById.set(sc.golferId, idx);
                        });

                        const getHandicapIndexLike = (golferId: string) => {
                          const eg = event.golfers.find((g: any) => (g.profileId || g.customName) === golferId);
                          const profile = profiles.find((p: any) => p.id === golferId);
                          const raw = eg?.handicapOverride ?? eg?.handicapSnapshot ?? profile?.handicapIndex ?? null;
                          const n = raw == null ? null : Number(raw);
                          return Number.isFinite(n as number) ? (n as number) : null;
                        };

                        // Simple seeded RNG so a single click produces consistent-looking randomness
                        // across holes, but different clicks generate different sequences.
                        let seed = (Date.now() & 0xffffffff) >>> 0;
                        const rand = () => {
                          // xorshift32
                          seed ^= (seed << 13) >>> 0;
                          seed ^= (seed >>> 17) >>> 0;
                          seed ^= (seed << 5) >>> 0;
                          return ((seed >>> 0) / 4294967296);
                        };

                        const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

                        const randomScoreFor = (golferId: string, holeNumber: number) => {
                          const par = holePar(holeNumber);
                          const hcp = getHandicapIndexLike(golferId);

                          // Convert handicap-ish number into a 0..1 "difficulty" factor.
                          // 0 = scratch-ish, 1 = higher handicap.
                          const difficulty = clamp(((hcp ?? 18) / 18), 0, 1);

                          // Outcome deltas relative to par.
                          // Weighted toward par/bogey with handicap shifting weight upward.
                          const outcomes = [
                            { d: -2, w: 0.02 * (1 - difficulty) },
                            { d: -1, w: 0.10 * (1 - difficulty) + 0.03 },
                            { d: 0, w: 0.45 * (1 - 0.35 * difficulty) },
                            { d: 1, w: 0.35 + 0.25 * difficulty },
                            { d: 2, w: 0.12 + 0.35 * difficulty },
                            { d: 3, w: 0.04 * difficulty },
                            { d: 4, w: 0.02 * difficulty },
                          ];

                          // Normalize weights and sample.
                          const totalW = outcomes.reduce((sum, o) => sum + o.w, 0);
                          let r = rand() * totalW;
                          for (const o of outcomes) {
                            r -= o.w;
                            if (r <= 0) {
                              // Keep it realistic: no 1s, and cap extreme highs a bit.
                              const raw = par + o.d;
                              const max = par + 5;
                              return clamp(raw, 1, max);
                            }
                          }
                          return par;
                        };

                        event.scorecards.forEach((sc: any) => {
                          sc.scores.forEach((s: any) => {
                            if (s.strokes == null) {
                              const par = holePar(s.hole);
                              if (normalizedMode === 'par') {
                                updateScore(eventId, sc.golferId, s.hole, par);
                                return;
                              }

                              if (normalizedMode === 'demo') {
                                // Demo pattern: par + small deterministic offset by golfer.
                                // This makes "Team Best N" selections easy to validate.
                                const golferIdx = golferIndexById.get(sc.golferId) ?? 0;
                                const offset = golferIdx % 4; // 0..3
                                updateScore(eventId, sc.golferId, s.hole, par + offset);
                                return;
                              }

                              // Random realistic pattern.
                              updateScore(eventId, sc.golferId, s.hole, randomScoreFor(sc.golferId, s.hole));
                            }
                          });
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    title="Fill empty scores with 4 (for testing)"
                  >
                    Fill Test Scores
                  </button>
                )}
              </div>
            )}
            {event.isCompleted && (
              <div className="text-green-600 font-medium">
                ✓ Completed
              </div>
            )}
          </div>
        </div>
      )}

      {/* Round Recap - Show when event has scores */}
      {event.golfers.some((g: any) => g.scores?.length > 0) && (
        <RoundRecapCard
          recap={generateRoundRecap(event)}
          compact={!event.isCompleted}
        />
      )}

      {/* Settlement Section - Show when event is completed or has any pending settlements */}
      {(event.isCompleted || getEventSettlements(eventId).length > 0) && (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 overflow-hidden">
          <button
            onClick={() => setShowSettlements(!showSettlements)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div className="text-left">
                <h3 className="font-semibold text-primary-800">Settlements</h3>
                <p className="text-sm text-gray-600">
                  {getEventSettlements(eventId).filter(s => s.status === 'pending').length > 0
                    ? `${getEventSettlements(eventId).filter(s => s.status === 'pending').length} pending`
                    : 'All settled'}
                </p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showSettlements ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSettlements && (
            <div className="border-t border-gray-100">
              <EventSettlement eventId={eventId} />
            </div>
          )}
        </div>
      )}
      
      <section className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="font-semibold text-primary-900">Payouts</h2>
            <div className="text-[11px] text-slate-600">Net = winnings minus buy-in</div>
          </div>
          {myNet != null && (
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">You</div>
              <div className={`text-sm font-extrabold ${myNet > 0 ? 'text-green-700' : myNet < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                {signedCurrency(myNet)}
              </div>
              <div className="text-[10px] text-slate-500">Buy-in {currency(myBuyin ?? 0)}</div>
            </div>
          )}
        </div>

        {incomplete && (
          <div className="mb-3 text-[11px] bg-amber-100 border border-amber-300 text-amber-900 px-3 py-2 rounded">
            Scores incomplete – payouts are provisional until all holes are entered.
          </div>
        )}
        <table className="text-xs sm:text-sm border-collapse bg-white rounded shadow-sm border border-slate-200 overflow-hidden w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-2 py-1 text-left">Golfer</th>
              <th className="border border-slate-200 px-2 py-1 text-right">Buy-In</th>
              <th className="border border-slate-200 px-2 py-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {event.golfers.map((eventGolfer: any) => {
              // Use displayName snapshot (cross-device compatible)
              const displayName = eventGolfer.displayName || 
                                 (eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId)?.name : null) ||
                                 eventGolfer.customName;
              const golferId = eventGolfer.profileId || eventGolfer.customName;
              if (!displayName || !golferId) return null;
              
              const buy = buyinByGolfer[golferId] || 0;
              const net = netByGolfer[golferId] || 0;
              return (
                <tr key={golferId} className="odd:bg-slate-50/40">
                  <td className="border border-slate-200 px-2 py-1">{displayName}</td>
                  <td className="border border-slate-200 px-2 py-1 text-right text-red-700">{currency(buy)}</td>
                  <td
                    className={`border border-slate-200 px-2 py-1 text-right font-extrabold ${
                      net > 0 ? 'text-green-700' : net < 0 ? 'text-red-700' : 'text-slate-700'
                    }`}
                  >
                    {signedCurrency(net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {payouts.nassau.length > 0 && (
        <details className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <summary className="cursor-pointer select-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary-900">Nassau</div>
              <div className="text-[11px] text-slate-600">{payouts.nassau.length} game{payouts.nassau.length === 1 ? '' : 's'} · tap for details</div>
            </div>
            <span className="text-slate-400 text-sm">▾</span>
          </summary>
          <div className="mt-3">
          {payouts.nassau.map((n, idx) => {
            const cfg = event.games.nassau.find((x: any) => x.id === n.configId);
            const teams = cfg?.teams || [];
            const isTeam = teams.length >= 2;
            const teamMap: Record<string, { name: string; golferIds: string[] }> = Object.fromEntries(teams.map((t: any) => [t.id, { name: t.name, golferIds: t.golferIds }]));

            const title = isTeam ? 'Team Nassau' : 'Nassau';
            return (
              <div key={n.configId} className="mb-4 border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">Nassau</div>
                    <div className="font-extrabold text-slate-900 truncate">
                      {title}{payouts.nassau.length > 1 ? ` #${idx + 1}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-600">Pot {currency(n.pot)} · {cfg?.net ? 'Net' : 'Gross'}</div>
                  </div>
                </div>

                <table className="text-[11px] border-collapse mb-2 w-full bg-white rounded border border-slate-200 overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">Segment</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">Winner</th>
                      <th className="border border-slate-200 px-2 py-1 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['front','back','total'].map(segName => {
                      const seg = n.segments.find(s => s.segment === segName) || { segment: segName, winners: [], pot: 0 } as any;
                      const winnerLabels = seg.winners.map((id: string) => {
                        if (golfersById[id]) return golfersById[id];
                        const team = teamMap[id];
                        if (team) return team.name || 'Team';
                        return id;
                      });
                      return (
                        <tr key={segName} className="odd:bg-slate-50/40">
                          <td className="border border-slate-200 px-2 py-1 capitalize align-top">{segName}</td>
                          <td className="border border-slate-200 px-2 py-1">
                            {winnerLabels.length ? (
                              <div className="flex flex-col gap-1">
                                {seg.winners.map((id: string) => {
                                  if (golfersById[id]) return <span key={id}>{golfersById[id]}</span>;
                                  const team = teamMap[id];
                                  if (team) {
                                    const roster = (team.golferIds || []).map((gid) => golfersById[gid]).filter(Boolean).join(', ');
                                    return (
                                      <span key={id} className="inline-flex items-center gap-2">
                                        <span className="font-semibold">{team.name || 'Team'}</span>
                                        {roster ? <span className="text-[10px] text-slate-500 truncate max-w-[180px]" title={roster}>{roster}</span> : null}
                                      </span>
                                    );
                                  }
                                  return <span key={id}>{id}</span>;
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-right font-semibold">
                            {seg.winners.length ? currency(seg.pot / seg.winners.length) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(n.winningsByGolfer).filter(([,v])=>v>0).map(([gid, amt]) => (
                    <span key={gid} className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded">{golfersById[gid]} {currency(amt)}</span>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </details>
      )}

      {skinsArray.length>0 && skinsArray.map((sk, idx) => sk && (
        <details key={sk.configId} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <summary className="cursor-pointer select-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary-900">
                Skins {skinsArray.length>1 && (<span className="text-[11px] font-normal ml-1">#{idx+1} {(() => { const cfg = (Array.isArray(event.games.skins)?event.games.skins:[event.games.skins]).find((c: any)=> c && c.id===sk.configId); return cfg?.net ? 'Net' : 'Gross'; })()}</span>)}
              </div>
              <div className="text-[11px] text-slate-600">Pot {currency(sk.totalPot)} · tap for details</div>
            </div>
            <span className="text-slate-400 text-sm">▾</span>
          </summary>
          <div className="mt-3">
          {(() => {
            const cfg = (Array.isArray(event.games.skins) ? event.games.skins : [event.games.skins]).find((c: any) => c && c.id === sk.configId);
            return (
              <div className="text-[10px] text-slate-600 mb-1">
                {cfg?.carryovers ? 'Carryovers: On (ties carry)' : 'Carryovers: Off (ties push)'}
              </div>
            );
          })()}
          {(() => {
            const skinsWonByGolfer: Record<string, number> = {};
            (sk.holeResults || []).forEach((hr: any) => {
              const winners = Array.isArray(hr.winners) ? hr.winners : [];
              if (winners.length === 1) {
                const gid = winners[0];
                skinsWonByGolfer[gid] = (skinsWonByGolfer[gid] || 0) + 1;
              }
            });

            const rows = Object.entries(sk.winningsByGolfer || {})
              .map(([gid, amt]) => ({
                gid,
                name: golfersById[gid] || gid,
                winnings: Number(amt) || 0,
                skinsWon: skinsWonByGolfer[gid] || 0,
              }))
              // Only show golfers who actually won at least one skin.
              // (Keeps the summary focused; losers are already visible in overall payouts table.)
              .filter((r) => r.gid && r.name && r.skinsWon > 0)
              .sort((a, b) => b.winnings - a.winnings);

            return (
              <>
                <table className="text-[11px] border-collapse w-full bg-white mb-2 rounded border border-slate-200 overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">Player</th>
                      <th className="border border-slate-200 px-2 py-1 text-center">Skins</th>
                      <th className="border border-slate-200 px-2 py-1 text-right">Winnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.gid} className="odd:bg-slate-50/40">
                        <td className="border border-slate-200 px-2 py-1">{r.name}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center font-mono">{r.skinsWon}</td>
                        <td className="border border-slate-200 px-2 py-1 text-right font-extrabold text-amber-700">
                          {r.winnings > 0 ? currency(r.winnings) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-slate-700 select-none">
                    Show hole-by-hole
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="text-[10px] border-collapse w-full bg-white mb-3 rounded border border-slate-200 overflow-hidden">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-200 px-1 py-0.5">Hole</th>
                          <th className="border border-slate-200 px-1 py-0.5">Winner</th>
                          <th className="border border-slate-200 px-1 py-0.5">Score</th>
                          <th className="border border-slate-200 px-1 py-0.5">Skin Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sk.holeResults.map((hr: any) => (
                          <tr key={hr.hole} className="odd:bg-slate-50/40">
                            <td className="border border-slate-200 px-1 py-0.5 text-center">{hr.hole}</td>
                            <td className="border border-slate-200 px-1 py-0.5">
                              {Array.isArray(hr.winners) && hr.winners.length > 1
                                ? `Tie${hr.carryIntoNext ? ' (carry)' : ''}: ${hr.winners.map((gid: string) => golfersById[gid]).join(', ')}`
                                : golfersById[hr.winners?.[0]]}
                            </td>
                            <td className="border border-slate-200 px-1 py-0.5 text-center">{hr.winningScore ?? '—'}</td>
                            <td className="border border-slate-200 px-1 py-0.5 text-right">{currency(hr.potValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            );
          })()}
          </div>
        </details>
      ))}
      
      {/* Pinky Results */}
      {payouts.pinky.length > 0 && payouts.pinky.map((pinky, idx) => (
        <details key={pinky.configId} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <summary className="cursor-pointer select-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary-900">
                Pinky {payouts.pinky.length > 1 && <span className="text-[11px] font-normal ml-1">#{idx + 1}</span>}
              </div>
              <div className="text-[11px] text-slate-600">Fee {currency(pinky.feePerPinky)} · tap for details</div>
            </div>
            <span className="text-slate-400 text-sm">▾</span>
          </summary>
          <div className="mt-3">
          <div className="text-[11px] text-red-700 mb-2 font-medium">Fee per Pinky: {currency(pinky.feePerPinky)}</div>
          
          {pinky.results.length > 0 ? (
            <div className="mb-3">
              <table className="text-[10px] border-collapse w-full bg-white mb-3 rounded border border-slate-200 overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1">Player</th>
                    <th className="border border-slate-200 px-2 py-1 text-center">Pinkys</th>
                    <th className="border border-slate-200 px-2 py-1 text-right">Owes</th>
                  </tr>
                </thead>
                <tbody>
                  {pinky.results.map((result: any) => {
                    const owes = pinky.owingsByGolfer[result.golferId] || 0;
                    return (
                      <tr key={result.golferId} className="odd:bg-slate-50/40">
                        <td className="border border-slate-200 px-2 py-1">{golfersById[result.golferId]}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center">{result.count}</td>
                        <td className={`border border-slate-200 px-2 py-1 text-right font-medium ${owes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {currency(Math.abs(owes))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-[10px] text-gray-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                ⚠️ Players with pinkys owe money to each other player
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No pinkys recorded yet</div>
          )}
          
          <div className="flex flex-wrap gap-2 text-[11px]">
            <div className="font-semibold text-gray-700 w-full mb-1">Net Payouts:</div>
            {Object.entries(pinky.owingsByGolfer)
              .filter(([,v]) => v !== 0)
              .map(([gid, amt]: any) => (
                <span 
                  key={gid} 
                  className={`px-2 py-0.5 rounded-full ${amt > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {golfersById[gid]} {amt > 0 ? '+' : ''}{currency(amt)}
                </span>
              ))
            }
          </div>
          </div>
        </details>
      ))}
      
      {/* Greenie Results */}
      {payouts.greenie.length > 0 && payouts.greenie.map((greenie, idx) => (
        <details key={greenie.configId} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <summary className="cursor-pointer select-none flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary-900">
                Greenie {payouts.greenie.length > 1 && <span className="text-[11px] font-normal ml-1">#{idx + 1}</span>}
              </div>
              <div className="text-[11px] text-slate-600">Fee {currency(greenie.feePerGreenie)} · tap for details</div>
            </div>
            <span className="text-slate-400 text-sm">▾</span>
          </summary>
          <div className="mt-3">
          <div className="text-[11px] text-green-700 mb-2 font-medium">Fee per Greenie: {currency(greenie.feePerGreenie)}</div>
          
          {greenie.results.length > 0 ? (
            <div className="mb-3">
              <table className="text-[10px] border-collapse w-full bg-white mb-3 rounded border border-slate-200 overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-200 px-2 py-1">Player</th>
                    <th className="border border-slate-200 px-2 py-1 text-center">Greenies</th>
                    <th className="border border-slate-200 px-2 py-1 text-right">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {greenie.results.map((result: any) => {
                    const wins = greenie.owingsByGolfer[result.golferId] || 0;
                    return (
                      <tr key={result.golferId} className="odd:bg-slate-50/40">
                        <td className="border border-slate-200 px-2 py-1">{golfersById[result.golferId]}</td>
                        <td className="border border-slate-200 px-2 py-1 text-center">{result.count}</td>
                        <td className={`border border-slate-200 px-2 py-1 text-right font-medium ${wins > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {currency(Math.abs(wins))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-[10px] text-gray-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                ✅ Players with greenies collect money from each other player
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">No greenies recorded yet</div>
          )}
          
          <div className="flex flex-wrap gap-2 text-[11px]">
            <div className="font-semibold text-gray-700 w-full mb-1">Net Payouts:</div>
            {Object.entries(greenie.owingsByGolfer)
              .filter(([,v]) => v !== 0)
              .map(([gid, amt]: any) => (
                <span 
                  key={gid} 
                  className={`px-2 py-0.5 rounded-full ${amt > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                >
                  {golfersById[gid]} {amt > 0 ? '+' : ''}{currency(amt)}
                </span>
              ))
            }
          </div>
          </div>
        </details>
      ))}
    </div>
  );
};

export default OverviewTab;
