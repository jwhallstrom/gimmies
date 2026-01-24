/**
 * PayoutTab - Shows payouts and event status
 * 
 * Event Lifecycle:
 * - setup: "Waiting for admin to set up games" banner
 * - started: Shows live payouts (games locked)
 * - completed: Final payouts
 * 
 * Users can enter scores at any time.
 * Only admin can start/unlock/complete the event.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { calculateEventPayouts } from '../../games/payouts';
import { EventSettlement } from '../wallet';

type Props = { eventId: string };

const currency = (n: number) => '$' + n.toFixed(2);
const signedCurrency = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + currency(Math.abs(n));

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

  if (!event) return null;

  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  
  // Event status (default to 'setup' for backward compatibility)
  const eventStatus = event.status || (event.isCompleted ? 'completed' : 'setup');
  const isSetup = eventStatus === 'setup';
  const isStarted = eventStatus === 'started';
  const isCompleted = eventStatus === 'completed' || event.isCompleted;
  
  // Normalize game arrays
  const nassauArray = event.games?.nassau || [];
  const skinsArray = Array.isArray(event.games?.skins) ? event.games.skins : (event.games?.skins ? [event.games.skins] : []);
  const pinkyArray = event.games?.pinky || [];
  const greenieArray = event.games?.greenie || [];
  
  const hasAnyGames = nassauArray.length + skinsArray.length + pinkyArray.length + greenieArray.length > 0;

  // Check if games are ready to start (Nassau has teams OR is individual)
  const gamesReadiness = useMemo(() => {
    const nassauIssues: string[] = [];
    
    nassauArray.forEach((n: any, i: number) => {
      const teams = n.teams || [];
      const teamsWithPlayers = teams.filter((t: any) => (t.golferIds || []).length > 0);
      // If teams exist but not complete, that's an issue
      if (teams.length > 0 && teamsWithPlayers.length < 2) {
        nassauIssues.push(`Nassau ${nassauArray.length > 1 ? `#${i + 1}` : ''}: Teams need to be picked`);
      }
    });
    
    return {
      ready: nassauIssues.length === 0 && hasAnyGames,
      issues: nassauIssues,
    };
  }, [nassauArray, hasAnyGames]);

  // Build name lookup
  const golfersById = useMemo(() => {
    return Object.fromEntries(
      event.golfers.map((eg: any) => {
        const displayName = eg.displayName || (eg.profileId ? profiles.find((p: any) => p.id === eg.profileId)?.name : null) || eg.customName;
        const golferId = eg.profileId || eg.customName;
        return [golferId, displayName];
      }).filter(([id, name]: any) => id && name)
    );
  }, [event.golfers, profiles]);

  // Compute payouts
  const payouts = useMemo(() => calculateEventPayouts(event, profiles), [event, profiles]);
  
  // Buy-in calculations
  const { buyinByGolfer, netByGolfer } = useMemo(() => {
    const buyins: Record<string, number> = {};
    event.golfers.forEach((eg: any) => { 
      const gid = eg.profileId || eg.customName;
      if (gid) buyins[gid] = 0; 
    });
    
    // Nassau buy-ins
    nassauArray.forEach((n: any) => {
      const cfg = n;
      const group = event.groups.find((gr: any) => gr.id === cfg.groupId);
      if (!group) return;
      let players = (group.golferIds || []).slice();
      players = players.filter((gid: string) => {
        const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
        const pref = (eg?.gamePreference as any) || 'all';
        return pref === 'all';
      });
      if (cfg.participantGolferIds?.length > 1) {
        players = players.filter((p: string) => cfg.participantGolferIds.includes(p));
      }
      const isTeam = cfg.teams?.length >= 2;
      if (isTeam) {
        const assigned = new Set<string>();
        (cfg.teams || []).forEach((t: any) => t.golferIds?.forEach((gid: string) => { if (players.includes(gid)) assigned.add(gid); }));
        players = players.filter((p: string) => assigned.has(p));
      }
      if (players.length < 2) return;
      const fees = cfg.fees ?? { out: cfg.fee, in: cfg.fee, total: cfg.fee };
      const perPlayer = (fees.out || 0) + (fees.in || 0) + (fees.total || 0);
      players.forEach((pid: string) => { buyins[pid] = (buyins[pid] || 0) + perPlayer; });
    });
    
    // Skins buy-ins
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
    
    const payoutByGolfer = payouts.totalByGolfer;
    const nets: Record<string, number> = {};
    Object.keys(payoutByGolfer).forEach((gid) => {
      nets[gid] = (payoutByGolfer[gid] || 0) - (buyins[gid] || 0);
    });
    
    return { buyinByGolfer: buyins, netByGolfer: nets };
  }, [event, nassauArray, skinsArray, payouts]);

  const myGolferId = currentProfile?.id;
  const myNet = myGolferId ? netByGolfer[myGolferId] ?? 0 : null;

  const incomplete = event.scorecards.some((sc: any) => sc.scores.some((s: any) => s.strokes == null));

  // Event actions
  const handleStartEvent = () => {
    if (!gamesReadiness.ready) {
      alert('Games are not ready. Please set up all games and pick teams first.');
      return;
    }
    if (window.confirm('Start the event? This will lock the games. You can unlock later if needed.')) {
      updateEvent(eventId, { status: 'started' });
    }
  };

  const handleUnlockEvent = () => {
    if (window.confirm('Unlock the event? This will allow changes to games. You\'ll need to restart when done.')) {
      updateEvent(eventId, { status: 'setup' });
    }
  };

  const handleCompleteEvent = () => {
    if (window.confirm('Complete this event? This finalizes all scores and payouts. This cannot be undone.')) {
      const success = completeEvent(eventId);
      if (success) {
        alert('Event completed! Round data saved to analytics.');
        setTimeout(() => navigate('/events'), 100);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* ==================== STATUS BANNERS ==================== */}
      
      {/* Setup mode - waiting for games */}
      {isSetup && !hasAnyGames && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Games Set Up Yet</h3>
          <p className="text-slate-600 mb-4">Waiting for the event admin to add games.</p>
          {isOwner && (
            <button
              onClick={() => navigate(`/event/${eventId}/games`)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg"
            >
              🎯 Set Up Games
            </button>
          )}
        </div>
      )}

      {/* Setup mode - games exist but not ready (teams needed) */}
      {isSetup && hasAnyGames && !gamesReadiness.ready && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
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
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700"
                >
                  Go to Games Tab
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup mode - games ready, can start */}
      {isSetup && hasAnyGames && gamesReadiness.ready && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✓</span>
            <div className="flex-1">
              <div className="font-bold text-green-800">Games Ready!</div>
              <p className="text-sm text-green-700 mt-1">
                {isOwner 
                  ? 'Start the event when everyone is ready. This will lock the games.'
                  : 'Waiting for admin to start the event.'
                }
              </p>
              {isOwner && (
                <button
                  onClick={handleStartEvent}
                  className="mt-3 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-bold hover:from-green-700 hover:to-green-800 shadow-lg"
                >
                  🚀 Start Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Started mode - event is locked */}
      {isStarted && !isCompleted && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <div className="font-bold text-primary-800">Event In Progress</div>
                <p className="text-sm text-primary-600">Games are locked. Payouts update as scores are entered.</p>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={handleUnlockEvent}
                className="px-3 py-2 bg-white border border-primary-300 text-primary-700 rounded-lg font-bold text-xs hover:bg-primary-50"
              >
                🔓 Unlock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✓</span>
          <div>
            <div className="font-bold text-green-800">Event Completed</div>
            <div className="text-sm text-green-600">All scores and payouts are final.</div>
          </div>
        </div>
      )}

      {/* ==================== PAYOUTS SECTION ==================== */}
      {/* Show payouts when started/completed, or preview when games exist */}
      
      {(isStarted || isCompleted || (hasAnyGames && gamesReadiness.ready)) && (
        <>
          {/* Preview label when in setup */}
          {isSetup && (
            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payout Preview</span>
            </div>
          )}

          {/* Your summary card */}
          {myNet != null && (
            <div className={`rounded-2xl p-5 ${myNet >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white shadow-lg`}>
              <div className="text-sm opacity-80 font-medium">Your Net</div>
              <div className="text-4xl font-black mt-1">
                {signedCurrency(myNet)}
              </div>
              <div className="text-sm opacity-80 mt-2">
                Buy-in: {currency(buyinByGolfer[myGolferId!] || 0)}
              </div>
            </div>
          )}

          {/* Incomplete scores warning */}
          {incomplete && (isStarted || isCompleted) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-semibold text-amber-800">Scores Incomplete</div>
                  <p className="text-sm text-amber-700">Payouts are provisional until all holes are entered.</p>
                </div>
              </div>
            </div>
          )}

          {/* Everyone's payouts */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Everyone's Payouts</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {event.golfers
                .map((eg: any) => {
                  const gid = eg.profileId || eg.customName;
                  const name = golfersById[gid];
                  const net = netByGolfer[gid] || 0;
                  const buyin = buyinByGolfer[gid] || 0;
                  return { gid, name, net, buyin };
                })
                .filter((r: any) => r.name)
                .sort((a: any, b: any) => b.net - a.net)
                .map((r: any) => (
                  <div key={r.gid} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500">Buy-in: {currency(r.buyin)}</div>
                    </div>
                    <div className={`text-lg font-bold ${r.net > 0 ? 'text-green-600' : r.net < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {signedCurrency(r.net)}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Settlements */}
          {(isCompleted || getEventSettlements(eventId).length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSettlements(!showSettlements)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💰</span>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Settlements</div>
                    <div className="text-sm text-gray-500">
                      {getEventSettlements(eventId).filter((s: any) => s.status === 'pending').length > 0
                        ? 'Tap to settle up'
                        : 'All settled'}
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

          {/* Complete Event button (only when started and scores complete) */}
          {isOwner && isStarted && !isCompleted && (
            <button
              onClick={handleCompleteEvent}
              disabled={incomplete}
              className={`w-full py-4 rounded-xl font-bold text-base ${
                incomplete
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg'
              }`}
            >
              {incomplete ? 'Complete All Scores First' : '✓ Complete Event & Lock Payouts'}
            </button>
          )}
        </>
      )}

      {/* When games exist but not ready, show a simpler message */}
      {hasAnyGames && !gamesReadiness.ready && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm">Payouts will appear once games are fully set up.</p>
        </div>
      )}
    </div>
  );
};

export default PayoutTab;
