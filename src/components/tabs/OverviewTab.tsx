import React from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { calculateEventPayouts } from '../../games/payouts';
import { courseMap } from '../../data/courses';

type Props = { eventId: string };

const currency = (n: number) => '$' + n.toFixed(2);

const OverviewTab: React.FC<Props> = ({ eventId }) => {
  const { profiles, completeEvent, currentProfile } = useStore();
  const navigate = useNavigate();
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  if (!event) return null;
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
    players.forEach(pid => { buyinByGolfer[pid] += cfg.fee; });
  });
  // Skins: every golfer pays each skins config fee
  const skinsConfigs: any[] = Array.isArray(event.games.skins) ? event.games.skins : (event.games.skins ? [event.games.skins] : []);
  skinsConfigs.forEach(sk => {
    const skinParticipants = sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds : event.golfers.map((g:any)=> g.profileId || g.customName).filter((id: string) => id);
    skinParticipants.forEach((gid: string) => { buyinByGolfer[gid] += sk.fee; });
  });
  const payoutByGolfer = payouts.totalByGolfer;
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
                {/* Debug helper button - remove in production */}
                {incomplete && currentProfile && event.ownerProfileId === currentProfile.id && (
                  <button
                    onClick={() => {
                      if (window.confirm('Fill all empty scores with 4 (par) for testing purposes?')) {
                        const { updateScore } = useStore.getState();
                        event.scorecards.forEach((sc: any) => {
                          sc.scores.forEach((s: any) => {
                            if (s.strokes == null) {
                              updateScore(eventId, sc.golferId, s.hole, 4);
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
      
      <section className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
        <h2 className="font-semibold mb-2 text-primary-900">Overview</h2>
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
              <th className="border border-slate-200 px-2 py-1 text-right">Payout</th>
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
              const pay = payoutByGolfer[golferId] || 0;
              return (
                <tr key={golferId} className="odd:bg-slate-50/40">
                  <td className="border border-slate-200 px-2 py-1">{displayName}</td>
                  <td className="border border-slate-200 px-2 py-1 text-right text-red-700">{currency(buy)}</td>
                  <td className="border border-slate-200 px-2 py-1 text-right text-green-700">{currency(pay)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {payouts.nassau.length > 0 && (
        <section className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <h2 className="font-semibold mb-2 text-primary-900">Nassau</h2>
          {payouts.nassau.map(n => {
            const cfg = event.games.nassau.find((x: any) => x.id === n.configId);
            const teams = cfg?.teams || [];
            const teamMap: Record<string, { name: string; golferIds: string[] }> = Object.fromEntries(teams.map((t: any) => [t.id, { name: t.name, golferIds: t.golferIds }]));
            return (
              <div key={n.configId} className="mb-4 border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="text-[11px] text-primary-700 mb-2 font-medium flex flex-wrap gap-4">
                  <span>Group {n.groupId}</span>
                  <span>Pot {currency(n.pot)}</span>
                  {cfg?.teamBestCount && teams.length > 0 && (
                    <span className="text-amber-700">Team Best {cfg.teamBestCount}</span>
                  )}
                  {/* Display par for each segment */}
                  {n.segments.map(seg => {
                    const parForSegment = (() => {
                      if (event.course.courseId) {
                        const course = courseMap[event.course.courseId];
                        if (course) {
                          const holes = seg.segment === 'front' ? [1,2,3,4,5,6,7,8,9] :
                                     seg.segment === 'back' ? [10,11,12,13,14,15,16,17,18] :
                                     [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];
                          return course.holes
                            .filter((h: any) => holes.includes(h.number))
                            .reduce((sum: number, h: any) => sum + h.par, 0);
                        }
                      }
                      return null;
                    })();
                    
                    // For team segments, show par adjusted for team best count
                    const cfg = event.games.nassau.find((x: any) => x.id === n.configId);
                    const isTeamSegment = cfg?.teams && cfg.teams.length >= 2;
                    const teamBestCount = cfg?.teamBestCount || 1;
                    const adjustedPar = isTeamSegment && parForSegment ? parForSegment * teamBestCount : parForSegment;
                    
                    return parForSegment ? (
                      <span key={seg.segment} className="text-gray-600">
                        {seg.segment === 'front' ? 'Front 9' : seg.segment === 'back' ? 'Back 9' : 'Total'} Par: {adjustedPar || parForSegment}
                        {isTeamSegment && teamBestCount > 1 && ` (${teamBestCount} best)`}
                      </span>
                    ) : null;
                  })}
                </div>
        <table className="text-[11px] border-collapse mb-2 w-full bg-white rounded border border-slate-200 overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-2 py-1 text-left">Segment</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">Scores (Strokes to Par)</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">Winners</th>
                      <th className="border border-slate-200 px-2 py-1 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['front','back','total'].map(segName => {
                      const seg = n.segments.find(s => s.segment === segName) || { segment: segName, winners: [], pot: 0 } as any;
                      const winnerLabels = seg.winners.map((id: string) => {
                        if (golfersById[id]) return golfersById[id];
                        if (teamMap[id]) return teamMap[id].name;
                        return id;
                      });
                      return (
                        <tr key={segName} className="odd:bg-slate-50/40">
                          <td className="border border-slate-200 px-2 py-1 capitalize align-top">{segName}</td>
                          <td className="border border-slate-200 px-2 py-1 align-top">
                            {seg.scores ? (
                              <div className="flex flex-col gap-0.5">
                                {Object.entries(seg.scores)
                                  .filter(([,v])=>Number.isFinite(v))
                                  .sort((a,b)=> (a[1] as number)-(b[1] as number))
                                  .map(([id, val]: any) => {
                                    const label = (golfersById[id]) ? golfersById[id] : (teamMap[id]?.name || id);
                                    const toParVal = seg.toPar && seg.toPar[id];
                                    const isTeam = !!teamMap[id];
                                    
                                    // For teams, show the score as strokes relative to par
                                    // For individuals, show raw strokes with toPar indicator
                                    const displayScore = isTeam ? 
                                      (toParVal != null ? (toParVal > 0 ? `+${toParVal}` : toParVal === 0 ? 'E' : toParVal.toString()) : '') :
                                      val.toString();
                                    
                                    const scoreColor = isTeam ?
                                      (toParVal == null ? '' : toParVal > 0 ? 'text-red-600' : toParVal < 0 ? 'text-green-600' : 'text-gray-600') :
                                      '';
                                    
                                    return (
                                      <span key={id} className="flex justify-between gap-2 items-center">
                                        <span className="truncate max-w-[90px]" title={label}>{label}</span>
                                        <div className="flex items-center gap-1">
                                          <span className={`font-mono ${scoreColor}`}>{displayScore}</span>
                                          {!isTeam && toParVal != null && (
                                            <span className={`text-xs font-semibold px-1 py-0.5 rounded ${toParVal > 0 ? 'text-red-600' : toParVal < 0 ? 'text-green-600' : 'text-gray-600'} bg-gray-100`}>
                                              {toParVal > 0 ? `+${toParVal}` : toParVal === 0 ? 'E' : toParVal.toString()}
                                            </span>
                                          )}
                                        </div>
                                      </span>
                                    );
                                  })}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1">
                            {winnerLabels.length ? (
                              <div className="flex flex-col gap-1">
                                {seg.winners.map((id: string) => {
                                  if (golfersById[id]) return <span key={id}>{golfersById[id]}</span>;
                                  const team = teamMap[id];
                                  if (team) return (
                                    <span key={id} className="inline-block">
                                      <span className="font-semibold mr-1">{team.name}</span>
                                      <span className="text-[10px] text-primary-700">({team.golferIds.map(gid => golfersById[gid]).join(', ')})</span>
                                    </span>
                                  );
                                  return <span key={id}>{id}</span>;
                                })}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-right">{currency(seg.pot / (seg.winners.length || 1))}</td>
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
        </section>
      )}
    {skinsArray.length>0 && skinsArray.map((sk, idx) => sk && (
        <section key={sk.configId} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
      <h2 className="font-semibold mb-2 text-primary-900">Skins {skinsArray.length>1 && (<span className="text-[11px] font-normal ml-1">#{idx+1} {(() => { const cfg = (Array.isArray(event.games.skins)?event.games.skins:[event.games.skins]).find((c: any)=> c && c.id===sk.configId); return cfg?.net ? 'Net' : 'Gross'; })()}</span>)}</h2>
          <div className="text-[11px] text-primary-700 mb-2 font-medium">Pot {currency(sk.totalPot)}</div>
          <div className="mb-3">
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
                    <td className="border border-slate-200 px-1 py-0.5">{golfersById[hr.winners[0]]}</td>
                    <td className="border border-slate-200 px-1 py-0.5 text-center">{hr.winningScore}</td>
                    <td className="border border-slate-200 px-1 py-0.5 text-right">{currency(hr.potValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] mb-1">
            {Object.entries(sk.winningsByGolfer).filter(([,v])=> (v as number) > 0).map(([gid, amt]: any) => (
              <span key={gid} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{golfersById[gid]} {currency(amt as number)}</span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default OverviewTab;
