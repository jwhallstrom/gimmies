/**
 * PayoutTab - Game-centric view of event results
 * 
 * Shows game-by-game breakdown:
 * - Nassau: Front/Back/Total standings
 * - Skins: Holes won, carryovers
 * - Running total during event
 * - Big net result at completion
 * - Personal settlements only (privacy)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { calculateEventPayouts } from '../../games/payouts';
import { EventSettlement } from '../wallet';
import { distributeHandicapStrokes, calculateCourseHandicap } from '../../utils/handicap';
import { getTee } from '../../data/cloudCourses';
import { courseMap } from '../../data/courses';

type Props = { eventId: string };

const currency = (n: number) => '$' + n.toFixed(2);
const signedCurrency = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + currency(Math.abs(n));
const formatToPar = (toPar: number | null) => {
  if (toPar === null) return null;
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
};

const PayoutTab: React.FC<Props> = ({ eventId }) => {
  const navigate = useNavigate();
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const profiles = useStore((s: any) => s.profiles);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const updateEvent = useStore((s: any) => s.updateEvent);
  const completeEvent = useStore((s) => s.completeEvent);
  const getEventSettlements = useStore((s) => s.getEventSettlements);

  const [showSettlements, setShowSettlements] = useState(false);
  const [teamModal, setTeamModal] = useState<{ 
    name: string; 
    members: string[]; 
    golferIds: string[];
    bestCount: number;
    isNet: boolean;
  } | null>(null);
  const [teamModalView, setTeamModalView] = useState<'roster' | 'scorecard'>('roster');

  if (!event) return null;

  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  const myGolferId = currentProfile?.id;
  
  // Event status
  const eventStatus = event.status || (event.isCompleted ? 'completed' : 'setup');
  const isSetup = eventStatus === 'setup';
  const isStarted = eventStatus === 'started';
  const isCompleted = eventStatus === 'completed' || event.isCompleted;
  
  // Game arrays
  const nassauArray = event.games?.nassau || [];
  const skinsArray = Array.isArray(event.games?.skins) ? event.games.skins : (event.games?.skins ? [event.games.skins] : []);
  const pinkyArray = event.games?.pinky || [];
  const greenieArray = event.games?.greenie || [];
  
  const hasAnyGames = nassauArray.length + skinsArray.length + pinkyArray.length + greenieArray.length > 0;

  // Check games readiness
  const gamesReadiness = useMemo(() => {
    const issues: string[] = [];
    nassauArray.forEach((n: any, i: number) => {
      const teams = n.teams || [];
      const teamsWithPlayers = teams.filter((t: any) => (t.golferIds || []).length > 0);
      if (teams.length > 0 && teamsWithPlayers.length < 2) {
        issues.push(`Nassau: Teams need to be picked`);
      }
    });
    return { ready: issues.length === 0 && hasAnyGames, issues };
  }, [nassauArray, hasAnyGames]);

  // Name lookup
  const golfersById = useMemo(() => {
    return Object.fromEntries(
      event.golfers.map((eg: any) => {
        const displayName = eg.displayName || (eg.profileId ? profiles.find((p: any) => p.id === eg.profileId)?.name : null) || eg.customName;
        const golferId = eg.profileId || eg.customName;
        return [golferId, displayName];
      }).filter(([id, name]: any) => id && name)
    );
  }, [event.golfers, profiles]);

  // Team name lookup for Nassau
  const teamNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    nassauArray.forEach((n: any) => {
      (n.teams || []).forEach((t: any) => {
        map[t.id] = t.name || `Team ${t.id.slice(-4)}`;
      });
    });
    return map;
  }, [nassauArray]);

  // Compute payouts
  const payouts = useMemo(() => calculateEventPayouts(event, profiles), [event, profiles]);
  
  // Buy-in and net calculations
  const { buyinByGolfer, netByGolfer, gameBreakdown } = useMemo(() => {
    const buyins: Record<string, number> = {};
    const breakdown: Record<string, { nassau: number; skins: number; pinky: number; greenie: number }> = {};
    
    event.golfers.forEach((eg: any) => { 
      const gid = eg.profileId || eg.customName;
      if (gid) {
        buyins[gid] = 0;
        breakdown[gid] = { nassau: 0, skins: 0, pinky: 0, greenie: 0 };
      }
    });
    
    // Nassau
    nassauArray.forEach((n: any) => {
      const group = event.groups.find((gr: any) => gr.id === n.groupId);
      if (!group) return;
      let players = (group.golferIds || []).slice();
      players = players.filter((gid: string) => {
        const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
        return (eg?.gamePreference as any) === 'all' || !(eg?.gamePreference);
      });
      if (n.participantGolferIds?.length > 1) {
        players = players.filter((p: string) => n.participantGolferIds.includes(p));
      }
      if (n.teams?.length >= 2) {
        const assigned = new Set<string>();
        (n.teams || []).forEach((t: any) => t.golferIds?.forEach((gid: string) => { if (players.includes(gid)) assigned.add(gid); }));
        players = players.filter((p: string) => assigned.has(p));
      }
      if (players.length < 2) return;
      const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
      const perPlayer = (fees.out || 0) + (fees.in || 0) + (fees.total || 0);
      players.forEach((pid: string) => { buyins[pid] = (buyins[pid] || 0) + perPlayer; });
    });
    
    // Skins
    skinsArray.forEach((sk: any) => {
      const eligible = (gid: string) => {
        const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
        const pref = (eg?.gamePreference as any) || 'all';
        return pref === 'all' || pref === 'skins';
      };
      const base = event.golfers.map((g: any) => g.profileId || g.customName || g.displayName).filter(Boolean).filter(eligible);
      const participants = sk.participantGolferIds?.length > 1 ? sk.participantGolferIds.filter(eligible) : base;
      participants.forEach((gid: string) => { buyins[gid] = (buyins[gid] || 0) + sk.fee; });
    });
    
    // Tally winnings by game type
    payouts.nassau.forEach(n => {
      Object.entries(n.winningsByGolfer).forEach(([gid, amt]) => {
        if (breakdown[gid]) breakdown[gid].nassau += amt;
      });
    });
    payouts.skins.forEach(s => {
      if (!s) return;
      Object.entries(s.winningsByGolfer).forEach(([gid, amt]) => {
        if (breakdown[gid]) breakdown[gid].skins += amt;
      });
    });
    payouts.pinky.forEach(p => {
      Object.entries(p.owingsByGolfer).forEach(([gid, amt]) => {
        if (breakdown[gid]) breakdown[gid].pinky += amt;
      });
    });
    payouts.greenie.forEach(g => {
      Object.entries(g.owingsByGolfer).forEach(([gid, amt]) => {
        if (breakdown[gid]) breakdown[gid].greenie += amt;
      });
    });
    
    const nets: Record<string, number> = {};
    Object.keys(buyins).forEach((gid) => {
      const totalWinnings = (breakdown[gid]?.nassau || 0) + (breakdown[gid]?.skins || 0) + 
                           (breakdown[gid]?.pinky || 0) + (breakdown[gid]?.greenie || 0);
      nets[gid] = totalWinnings - (buyins[gid] || 0);
    });
    
    return { buyinByGolfer: buyins, netByGolfer: nets, gameBreakdown: breakdown };
  }, [event, nassauArray, skinsArray, payouts]);

  const myNet = myGolferId ? netByGolfer[myGolferId] ?? 0 : null;
  const myBreakdown = myGolferId ? gameBreakdown[myGolferId] : null;
  const myBuyin = myGolferId ? buyinByGolfer[myGolferId] ?? 0 : 0;
  const incomplete = event.scorecards.some((sc: any) => sc.scores.some((s: any) => s.strokes == null));

  // Get my settlements only
  const mySettlements = useMemo(() => {
    const all = getEventSettlements(eventId);
    return all.filter((s: any) => s.fromProfileId === myGolferId || s.toProfileId === myGolferId);
  }, [eventId, myGolferId, getEventSettlements]);

  // Event actions
  const handleStartEvent = () => {
    if (!gamesReadiness.ready) {
      alert('Games are not ready. Please set up all games and pick teams first.');
      return;
    }
    if (window.confirm('Start the event? This will lock the games.')) {
      updateEvent(eventId, { status: 'started' });
    }
  };

  const handleUnlockEvent = () => {
    if (window.confirm('Unlock the event to make changes?')) {
      updateEvent(eventId, { status: 'setup' });
    }
  };

  const handleCompleteEvent = () => {
    if (window.confirm('Complete this event? This finalizes all payouts.')) {
      const success = completeEvent(eventId);
      if (success) {
        alert('Event completed!');
        setTimeout(() => navigate('/events'), 100);
      }
    }
  };

  // ============ RENDER ============
  
  // Setup: No games yet
  if (isSetup && !hasAnyGames) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Games Set Up</h3>
          <p className="text-slate-600 mb-4">Add games to see payouts here.</p>
          {isOwner && (
            <button
              onClick={() => navigate(`/event/${eventId}/games`)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg"
            >
              🎯 Set Up Games
            </button>
          )}
        </div>
      </div>
    );
  }

  // Setup: Games need configuration
  if (isSetup && hasAnyGames && !gamesReadiness.ready) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚙️</span>
            <div className="flex-1">
              <div className="font-bold text-amber-800">Games Need Setup</div>
              <ul className="mt-2 space-y-1">
                {gamesReadiness.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-amber-700">• {issue}</li>
                ))}
              </ul>
              {isOwner && (
                <button
                  onClick={() => navigate(`/event/${eventId}/games`)}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm"
                >
                  Go to Games
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Setup: Ready to start
  if (isSetup && gamesReadiness.ready) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div className="flex-1">
              <div className="font-bold text-green-800">Ready to Start!</div>
              <p className="text-sm text-green-700 mt-1">
                {isOwner ? 'Start the event to lock games and track payouts.' : 'Waiting for admin to start.'}
              </p>
              {isOwner && (
                <button
                  onClick={handleStartEvent}
                  className="mt-3 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold shadow-lg"
                >
                  🚀 Start Event
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ STARTED OR COMPLETED - Show Game Results ============
  return (
    <div className="space-y-4">
      {/* Completed: Big Net Result Banner */}
      {isCompleted && myNet != null && (
        <div className={`rounded-2xl p-6 text-center ${myNet >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white shadow-lg`}>
          <div className="text-sm opacity-80 font-medium mb-1">Final Result</div>
          <div className="text-5xl font-black">{signedCurrency(myNet)}</div>
          <div className="text-sm opacity-80 mt-2">Buy-in: {currency(myBuyin)}</div>
        </div>
      )}

      {/* Status indicator for started */}
      {isStarted && !isCompleted && (
        <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="font-semibold text-primary-800 text-sm">Event In Progress</span>
            {incomplete && <span className="text-xs text-amber-600">(scores incomplete)</span>}
          </div>
          {isOwner && (
            <button onClick={handleUnlockEvent} className="text-xs font-bold text-primary-600 hover:text-primary-800">
              Unlock
            </button>
          )}
        </div>
      )}

      {/* ========== GAME CARDS ========== */}
      
      {/* Nassau Results */}
      {payouts.nassau.map((nassauResult, idx) => {
        const config = nassauArray[idx];
        const isTeamMode = config?.teams?.length >= 2;
        const isNetGame = config?.net === true;
        const is2Team = config?.teams?.length === 2;
        const scoringType = config?.scoringType || 'stroke';
        const bestCount = config?.teamBestCount || 1;
        
        return (
          <div key={nassauResult.configId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">🏌️</span>
                  <span className="font-bold text-gray-900">Nassau</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isNetGame ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isNetGame ? 'NET' : 'GROSS'}
                  </span>
                  {isTeamMode && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">TEAMS</span>}
                  {is2Team && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      scoringType === 'match' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {scoringType === 'match' ? 'MATCH' : 'STROKE'}
                    </span>
                  )}
                  {isTeamMode && bestCount > 1 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      BEST {bestCount}
                    </span>
                  )}
                  {isTeamMode && bestCount === 1 && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                      BEST BALL
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">Pot: {currency(nassauResult.pot)}</span>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {nassauResult.segments.map(seg => {
                const segmentLabel = seg.segment === 'front' ? 'Front 9' : seg.segment === 'back' ? 'Back 9' : 'Overall';
                const hasWinner = seg.winners.length > 0 && seg.winners.some(w => Number.isFinite(seg.scores[w]));
                const winnerToPar = seg.winners[0] ? seg.toPar[seg.winners[0]] : null;
                
                // Get winning teams with their member info
                const winningTeamsInfo = isTeamMode 
                  ? seg.winners.map(w => {
                      const team = config?.teams?.find((t: any) => t.id === w);
                      const teamName = teamNamesById[w] || w;
                      const golferIds = team?.golferIds || [];
                      const memberNames = golferIds.map((gid: string) => golfersById[gid] || gid);
                      return { id: w, name: teamName, members: memberNames, golferIds };
                    })
                  : [];
                
                const winnerNames = isTeamMode 
                  ? winningTeamsInfo.map(t => t.name)
                  : seg.winners.map(w => golfersById[w] || w);
                
                // Check if current user/team is winning
                let userIsWinning = false;
                if (myGolferId) {
                  if (isTeamMode) {
                    const myTeam = config?.teams?.find((t: any) => t.golferIds?.includes(myGolferId));
                    userIsWinning = myTeam && seg.winners.includes(myTeam.id);
                  } else {
                    userIsWinning = seg.winners.includes(myGolferId);
                  }
                }
                
                return (
                  <div key={seg.segment} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{segmentLabel}</div>
                        {hasWinner ? (
                          <div className={`text-xs mt-0.5 ${userIsWinning ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                            {isTeamMode ? (
                              // Clickable team names
                              winningTeamsInfo.map((team, i) => (
                                <span key={team.id}>
                                  {i > 0 && ' & '}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamModal({ 
                                        name: team.name, 
                                        members: team.members,
                                        golferIds: team.golferIds,
                                        bestCount: bestCount,
                                        isNet: isNetGame
                                      });
                                      setTeamModalView('roster');
                                    }}
                                    className="underline underline-offset-2 decoration-dotted hover:text-primary-600"
                                  >
                                    {team.name}
                                  </button>
                                </span>
                              ))
                            ) : (
                              winnerNames.join(' & ')
                            )}
                            {winnerToPar != null && (
                              <span className="ml-1">
                                ({formatToPar(winnerToPar)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-0.5">No scores yet</div>
                        )}
                      </div>
                      <div className="text-right">
                        {hasWinner && seg.winners.length > 1 ? (
                          // Tie - show split amount
                          <>
                            <div className="text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">{currency(seg.pot / seg.winners.length)}</span>
                              <span className="text-gray-400"> each</span>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              ({seg.winners.length}-way tie)
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-gray-400">{currency(seg.pot)}</div>
                        )}
                        {userIsWinning && (
                          <div className="text-xs font-bold text-green-600">
                            {seg.winners.length > 1 ? `+${currency(seg.pot / seg.winners.length)}` : "You're winning!"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Skins Results */}
      {payouts.skins.map((skinsResult, idx) => {
        if (!skinsResult) return null;
        
        const config = skinsArray[idx];
        const isNetGame = config?.net === true;
        const hasCarryovers = config?.carryovers === true;
        
        const skinsWon = skinsResult.holeResults.filter(h => h.winners.length === 1 && !h.carryIntoNext);
        const carryovers = skinsResult.holeResults.filter(h => h.carryIntoNext);
        const currentCarryPot = carryovers.length > 0 ? carryovers[carryovers.length - 1]?.potValue || 0 : 0;
        const mySkins = myGolferId ? skinsResult.winningHolesByGolfer[myGolferId] || [] : [];
        const mySkinsWinnings = myGolferId ? skinsResult.winningsByGolfer[myGolferId] || 0 : 0;
        
        return (
          <div key={skinsResult.configId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="font-bold text-gray-900">Skins</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isNetGame ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isNetGame ? 'NET' : 'GROSS'}
                  </span>
                  {hasCarryovers && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">CARRYOVERS</span>}
                </div>
                <span className="text-xs text-gray-500">Pot: {currency(skinsResult.totalPot)}</span>
              </div>
            </div>
            
            <div className="px-4 py-3 space-y-3">
              {/* Your result highlight */}
              {mySkins.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="font-bold text-green-800 text-sm">
                    You won {mySkins.length} skin{mySkins.length !== 1 ? 's' : ''} — {currency(mySkinsWinnings)}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Hole{mySkins.length !== 1 ? 's' : ''}: {mySkins.join(', ')}
                  </div>
                </div>
              )}
              
              {/* Carryover indicator */}
              {carryovers.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 flex items-center gap-2">
                  <span className="text-amber-500">🔥</span>
                  <div className="text-sm">
                    <span className="font-semibold text-amber-800">{carryovers.length} hole{carryovers.length !== 1 ? 's' : ''} carrying</span>
                    <span className="text-amber-600 ml-1">({currency(currentCarryPot)} pot)</span>
                  </div>
                </div>
              )}
              
              {/* All Skins Won - Table format */}
              {skinsWon.length > 0 ? (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Skins Won</div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-gray-500 uppercase">
                          <th className="text-left py-2 px-3 font-semibold">Hole</th>
                          <th className="text-left py-2 px-3 font-semibold">Winner</th>
                          <th className="text-right py-2 px-3 font-semibold">Score</th>
                          <th className="text-right py-2 px-3 font-semibold">Won</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {skinsWon.map(h => {
                          const winnerName = golfersById[h.winners[0]] || h.winners[0];
                          const isMe = h.winners[0] === myGolferId;
                          return (
                            <tr key={h.hole} className={isMe ? 'bg-green-50' : ''}>
                              <td className={`py-2 px-3 font-semibold ${isMe ? 'text-green-700' : 'text-gray-900'}`}>
                                #{h.hole}
                              </td>
                              <td className={`py-2 px-3 ${isMe ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
                                {isMe ? 'You' : winnerName}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono ${isMe ? 'text-green-700' : 'text-gray-600'}`}>
                                {h.winningScore}
                              </td>
                              <td className={`py-2 px-3 text-right font-semibold ${isMe ? 'text-green-700' : 'text-gray-700'}`}>
                                {currency(h.potValue)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  No skins won yet
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Greenie/Pinky combined if they exist */}
      {(greenieArray.length > 0 || pinkyArray.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="font-bold text-gray-900">Side Games</span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            {greenieArray.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Greenies</span>
                <span className={`font-semibold ${(myBreakdown?.greenie || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {signedCurrency(myBreakdown?.greenie || 0)}
                </span>
              </div>
            )}
            {pinkyArray.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pinkies</span>
                <span className={`font-semibold ${(myBreakdown?.pinky || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {signedCurrency(myBreakdown?.pinky || 0)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Running Total (during event, not completed) */}
      {!isCompleted && myNet != null && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Running Total</div>
              <div className="text-xs text-gray-400 mt-0.5">Buy-in: {currency(myBuyin)}</div>
            </div>
            <div className={`text-2xl font-bold ${myNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {signedCurrency(myNet)}
            </div>
          </div>
          {myBreakdown && (
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
              {nassauArray.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Nassau</span>
                  <span className={myBreakdown.nassau >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {signedCurrency(myBreakdown.nassau - (buyinByGolfer[myGolferId!] || 0) * (nassauArray.length / (nassauArray.length + skinsArray.length || 1)))}
                  </span>
                </div>
              )}
              {skinsArray.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Skins</span>
                  <span className={myBreakdown.skins >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {signedCurrency(myBreakdown.skins - (skinsArray[0]?.fee || 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game breakdown at completion */}
      {isCompleted && myBreakdown && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Breakdown</div>
          <div className="space-y-2">
            {nassauArray.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Nassau</span>
                <span className={`font-semibold ${myBreakdown.nassau > 0 ? 'text-green-600' : myBreakdown.nassau < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {signedCurrency(myBreakdown.nassau)}
                </span>
              </div>
            )}
            {skinsArray.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Skins</span>
                <span className={`font-semibold ${myBreakdown.skins > 0 ? 'text-green-600' : myBreakdown.skins < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {signedCurrency(myBreakdown.skins)}
                </span>
              </div>
            )}
            {greenieArray.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Greenies</span>
                <span className={`font-semibold ${myBreakdown.greenie > 0 ? 'text-green-600' : myBreakdown.greenie < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {signedCurrency(myBreakdown.greenie)}
                </span>
              </div>
            )}
            {pinkyArray.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pinkies</span>
                <span className={`font-semibold ${myBreakdown.pinky > 0 ? 'text-green-600' : myBreakdown.pinky < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {signedCurrency(myBreakdown.pinky)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-600">Total Buy-in</span>
              <span className="font-semibold text-gray-900">−{currency(myBuyin)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Settlements - Only show user's */}
      {(isStarted || isCompleted) && mySettlements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowSettlements(!showSettlements)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💸</span>
              <div className="text-left">
                <div className="font-bold text-gray-900 text-sm">Settle Up</div>
                <div className="text-xs text-gray-500">
                  {mySettlements.filter((s: any) => s.status === 'pending').length} pending
                </div>
              </div>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${showSettlements ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Complete Event button */}
      {isOwner && isStarted && !isCompleted && (
        <button
          onClick={handleCompleteEvent}
          disabled={incomplete}
          className={`w-full py-4 rounded-xl font-bold text-base ${
            incomplete
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
          }`}
        >
          {incomplete ? 'Complete All Scores First' : '✓ Complete Event'}
        </button>
      )}

      {/* Team Members Modal */}
      {teamModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setTeamModal(null)}>
          <div className={`w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden ${teamModalView === 'scorecard' ? 'max-w-2xl' : 'max-w-sm'}`} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">{teamModal.name}</div>
                  <div className="font-extrabold text-gray-900">
                    {teamModal.isNet ? 'Net' : 'Gross'} • Best {teamModal.bestCount === 1 ? 'Ball' : teamModal.bestCount}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModal(null)}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {/* View Toggle */}
              <div className="flex gap-1 mt-3 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setTeamModalView('roster')}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                    teamModalView === 'roster' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  👥 Roster
                </button>
                <button
                  onClick={() => setTeamModalView('scorecard')}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                    teamModalView === 'scorecard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📊 Scorecard
                </button>
              </div>
            </div>
            
            {/* Roster View */}
            {teamModalView === 'roster' && (
              <div className="p-4">
                {teamModal.members.length > 0 ? (
                  <div className="space-y-2">
                    {teamModal.members.map((member, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                          {member.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-medium text-gray-900">{member}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">No members assigned</div>
                )}
              </div>
            )}
            
            {/* Scorecard View */}
            {teamModalView === 'scorecard' && (
              <div className="p-4 overflow-x-auto">
                {(() => {
                  // Build scorecard data for this team
                  const holes = Array.from({ length: 18 }, (_, i) => i + 1);
                  const front9 = holes.slice(0, 9);
                  const back9 = holes.slice(9);
                  const isNet = teamModal.isNet;
                  
                  // Get tee info for course handicap calculation
                  const cloudTee = getTee(event.course.courseId, event.course.teeName);
                  const localCourse = courseMap[event.course.courseId];
                  const courseRating = cloudTee?.courseRating ?? 72;
                  const slopeRating = cloudTee?.slopeRating ?? 113;
                  const par = cloudTee?.par ?? localCourse?.holes?.reduce((sum, h) => sum + h.par, 0) ?? 72;
                  
                  // Get scores and handicap info for each golfer
                  const golferScores = teamModal.golferIds.map((gid, idx) => {
                    const scorecard = event.scorecards.find((sc: any) => sc.golferId === gid);
                    const eventGolfer = event.golfers.find((g: any) => g.profileId === gid || g.customName === gid);
                    const profile = profiles.find((p: any) => p.id === gid);
                    
                    // Get handicap index
                    const handicapIndex = eventGolfer?.handicapOverride ?? eventGolfer?.handicapSnapshot ?? profile?.handicapIndex ?? 0;
                    const courseHcp = calculateCourseHandicap(handicapIndex, slopeRating, courseRating, par);
                    
                    // Get stroke distribution for this player
                    const strokeDist = isNet && event.course.courseId 
                      ? distributeHandicapStrokes(courseHcp, event.course.courseId, event.course.teeName)
                      : {};
                    
                    const scores: Record<number, { gross: number | null; net: number | null; strokes: number }> = {};
                    holes.forEach(h => {
                      const s = scorecard?.scores?.find((s: any) => s.hole === h);
                      const gross = s?.strokes ?? null;
                      const handicapStrokes = strokeDist[h] || 0;
                      const net = gross != null ? gross - handicapStrokes : null;
                      scores[h] = { gross, net, strokes: handicapStrokes };
                    });
                    
                    return { 
                      id: gid, 
                      name: teamModal.members[idx] || gid, 
                      scores,
                      courseHcp
                    };
                  });
                  
                  // Determine which scores were "used" per hole (best N) - use net for NET games
                  const usedScoresPerHole: Record<number, Set<string>> = {};
                  holes.forEach(h => {
                    const scoresWithId = golferScores
                      .filter(g => g.scores[h].gross != null)
                      .map(g => ({ 
                        id: g.id, 
                        score: isNet ? g.scores[h].net! : g.scores[h].gross! 
                      }))
                      .sort((a, b) => a.score - b.score);
                    const used = scoresWithId.slice(0, teamModal.bestCount);
                    usedScoresPerHole[h] = new Set(used.map(u => u.id));
                  });
                  
                  const renderHalfTable = (holeRange: number[], label: string) => (
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">{label}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-2 py-1.5 text-left font-bold text-gray-600 sticky left-0 bg-gray-100 min-w-[80px]">Player</th>
                              {holeRange.map(h => (
                                <th key={h} className="px-1.5 py-1.5 text-center font-bold text-gray-600 min-w-[28px]">{h}</th>
                              ))}
                              <th className="px-2 py-1.5 text-center font-bold text-gray-700 bg-gray-200 min-w-[36px]">Tot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {golferScores.map((golfer) => {
                              const halfTotalNet = holeRange.reduce((sum, h) => sum + (golfer.scores[h].net || 0), 0);
                              const halfTotalGross = holeRange.reduce((sum, h) => sum + (golfer.scores[h].gross || 0), 0);
                              const hasAnyScore = holeRange.some(h => golfer.scores[h].gross != null);
                              return (
                                <tr key={golfer.id} className="border-t border-gray-100">
                                  <td className="px-2 py-1.5 font-medium text-gray-900 sticky left-0 bg-white truncate max-w-[80px]">
                                    <div>{golfer.name.split(' ')[0]}</div>
                                    {isNet && <div className="text-[9px] text-purple-600 font-normal">CH {golfer.courseHcp}</div>}
                                  </td>
                                  {holeRange.map(h => {
                                    const { gross, net, strokes } = golfer.scores[h];
                                    const isUsed = usedScoresPerHole[h]?.has(golfer.id);
                                    const displayScore = isNet ? net : gross;
                                    return (
                                      <td 
                                        key={h} 
                                        className={`px-0.5 py-1 text-center font-mono relative ${
                                          gross == null 
                                            ? 'text-gray-300' 
                                            : isUsed 
                                              ? 'bg-green-100 text-green-800 font-bold' 
                                              : 'text-gray-500'
                                        }`}
                                      >
                                        {/* Handicap dots */}
                                        {isNet && strokes > 0 && (
                                          <div className="absolute top-0 left-0 right-0 flex justify-center gap-0.5 -mt-0.5">
                                            {Array.from({ length: Math.min(strokes, 3) }).map((_, i) => (
                                              <span key={i} className="w-1 h-1 rounded-full bg-purple-500"></span>
                                            ))}
                                          </div>
                                        )}
                                        <span className="text-[10px]">{displayScore ?? '-'}</span>
                                        {/* Show gross in parentheses for NET if different */}
                                        {isNet && gross != null && net !== gross && (
                                          <div className="text-[8px] text-gray-400 leading-none">{gross}</div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-2 py-1.5 text-center font-mono font-bold text-gray-700 bg-gray-50">
                                    {hasAnyScore ? (isNet ? halfTotalNet : halfTotalGross) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Team total row */}
                            <tr className="border-t-2 border-gray-300 bg-blue-50">
                              <td className="px-2 py-1.5 font-bold text-blue-800 sticky left-0 bg-blue-50">Team</td>
                              {holeRange.map(h => {
                                const usedGolfers = Array.from(usedScoresPerHole[h] || []);
                                const teamScore = usedGolfers.reduce((sum, gid) => {
                                  const g = golferScores.find(gs => gs.id === gid);
                                  const score = isNet ? g?.scores[h]?.net : g?.scores[h]?.gross;
                                  return sum + (score || 0);
                                }, 0);
                                const hasScore = usedGolfers.length > 0;
                                return (
                                  <td key={h} className="px-1.5 py-1.5 text-center font-mono font-bold text-blue-800">
                                    {hasScore ? teamScore : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 text-center font-mono font-bold text-blue-900 bg-blue-100">
                                {holeRange.reduce((sum, h) => {
                                  const usedGolfers = Array.from(usedScoresPerHole[h] || []);
                                  return sum + usedGolfers.reduce((s, gid) => {
                                    const g = golferScores.find(gs => gs.id === gid);
                                    const score = isNet ? g?.scores[h]?.net : g?.scores[h]?.gross;
                                    return s + (score || 0);
                                  }, 0);
                                }, 0) || '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                  
                  return (
                    <>
                      {renderHalfTable(front9, 'Front 9')}
                      {renderHalfTable(back9, 'Back 9')}
                      <div className="mt-3 space-y-2">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-4 h-4 bg-green-100 border border-green-300 rounded"></span>
                            <span className="text-green-800">Highlighted scores counted toward team total</span>
                          </div>
                        </div>
                        {isNet && (
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              </div>
                              <span className="text-purple-800">Dots = handicap strokes received on that hole</span>
                            </div>
                            <div className="text-[10px] text-purple-600 mt-1">
                              Showing NET scores (gross score minus handicap strokes). Small number below is gross.
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutTab;
