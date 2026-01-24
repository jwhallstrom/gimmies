import React, { useState } from 'react';
import useStore from '../../state/store';
// Skins preview (holes won) moved to OverviewTab.
import { nanoid } from 'nanoid/non-secure';
import { useNavigate } from 'react-router-dom';

type Props = { eventId: string };

const GAME_TYPES = [
  {
    id: 'nassau',
    name: 'Nassau',
    description: 'Three bets in one: Front 9, Back 9, and Total 18. Can be played individually or as teams. The classic golf bet.',
    hasNetOption: true
  },
  {
    id: 'skins',
    name: 'Skins',
    description: 'Each hole is worth a "skin". The player with the lowest score on a hole wins the skin. By default, ties are a push (no skin). You can optionally enable carryovers per Skins game.',
    hasNetOption: true
  },
  {
    id: 'pinky',
    name: 'Pinky',
    description: 'At the end of the round, each player declares how many "pinkys" they had. For each pinky, that player owes each other player the set fee amount.',
    hasNetOption: false
  },
  {
    id: 'greenie',
    name: 'Greenie',
    description: 'At the end of the round, each player declares how many "greenies" they had (hitting the green in regulation on par 3s). For each greenie, ALL OTHER players owe that player the set fee amount.',
    hasNetOption: false
  }
];

const GamesTab: React.FC<Props> = ({ eventId }) => {
  const navigate = useNavigate();
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const profiles = useStore((s: any) => s.profiles);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const updateEvent = useStore((s: any) => s.updateEvent);
  
  const [showAddGame, setShowAddGame] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);
  const [nassauSetupId, setNassauSetupId] = useState<string | null>(null);
  const [skinsSetupId, setSkinsSetupId] = useState<string | null>(null);
  const [pinkySetupId, setPinkySetupId] = useState<string | null>(null);
  const [greenieSetupId, setGreenieSetupId] = useState<string | null>(null);

  if (!event) return null;
  
  // Check if current user is the event owner
  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  console.log('🎮 GamesTab: Is owner?', isOwner, 'Current profile:', currentProfile?.id, 'Owner:', event.ownerProfileId);
  
  // Helper function to get golfer data from EventGolfer
  const getGolferData = (eventGolfer: any) => {
    if (eventGolfer.profileId) {
      const profile = profiles.find((p: any) => p.id === eventGolfer.profileId);
      // Use displayName snapshot for cross-device compatibility
      const name = profile ? profile.name : (eventGolfer.displayName || 'Unknown');
      const handicapIndex = profile?.handicapIndex ?? eventGolfer.handicapSnapshot;
      return { id: eventGolfer.profileId, name, handicapIndex };
    } else if (eventGolfer.customName) {
      return { id: eventGolfer.customName, name: eventGolfer.customName, handicapIndex: null };
    } else if (eventGolfer.displayName) {
      // Fallback for snapshot-only golfers
      return { id: eventGolfer.displayName, name: eventGolfer.displayName, handicapIndex: eventGolfer.handicapSnapshot };
    }
    return null;
  };
  
  // Get all golfers with their data
  const allGolfers = event.golfers.map(getGolferData).filter(Boolean);
  const gameEligibleIds = (game: 'nassau' | 'skins' | 'pinky' | 'greenie') => {
    const ids = (event.golfers || [])
      .map((g: any) => g.profileId || g.customName || g.displayName)
      .filter((id: any) => !!id) as string[];
    return ids.filter((gid) => {
      const eg = (event.golfers || []).find((x: any) => (x.profileId || x.customName || x.displayName) === gid);
      const pref: 'all' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
      if (pref === 'none') return false;
      if (pref === 'skins') return game === 'skins';
      return true; // all
    });
  };
  const addNassau = (net: boolean) => {
    // Use the default group (first group) for the Nassau game
    const defaultGroupId = event.groups.length > 0 ? event.groups[0].id : null;
    if (!defaultGroupId) {
      alert('Please create an event with golfers first before adding games.');
      return;
    }
    const id = nanoid(6);
    updateEvent(eventId, {
      games: {
        ...event.games,
        nassau: [
          ...event.games.nassau,
          { id, groupId: defaultGroupId, fee: 5, fees: { out: 5, in: 5, total: 5 }, net, participantGolferIds: gameEligibleIds('nassau') },
        ],
      },
    });
    setNassauSetupId(id);
  };
  const removeNassau = (id: string) => {
    useStore.getState().removeNassau(eventId, id);
  };
  const skinsArray: any[] = Array.isArray(event.games.skins) ? event.games.skins : (event.games.skins ? [event.games.skins] : []);
  const addSkins = (net: boolean) => {
    const id = nanoid(6);
    updateEvent(eventId, {
      games: {
        ...event.games,
        skins: [...skinsArray, { id, fee: 10, net, carryovers: false, participantGolferIds: gameEligibleIds('skins') }],
      },
    });
    setSkinsSetupId(id);
  };
  const removeSkins = (id: string) => {
    useStore.getState().removeSkins(eventId, id);
  };
  
  // Pinky game management
  const pinkyArray: any[] = Array.isArray(event.games.pinky) ? event.games.pinky : [];
  const addPinky = () => {
    const id = nanoid(6);
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: [...pinkyArray, { id, fee: 1, participantGolferIds: gameEligibleIds('pinky') }],
        greenie: event.games.greenie || []
      } 
    });
    setPinkySetupId(id);
  };
  const removePinky = (id: string) => {
    useStore.getState().removePinky(eventId, id);
  };
  const setPinkyCount = (pinkyId: string, golferId: string, count: number) => {
    const currentResults = (event.pinkyResults && event.pinkyResults[pinkyId]) || [];
    const updatedResults = currentResults.filter((r: any) => r.golferId !== golferId);
    if (count > 0) {
      updatedResults.push({ golferId, count });
    }
    useStore.getState().setPinkyResults(eventId, pinkyId, updatedResults);
  };
  
  // Greenie game management
  const greenieArray: any[] = Array.isArray(event.games.greenie) ? event.games.greenie : [];
  const addGreenie = () => {
    const id = nanoid(6);
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: event.games.pinky || [],
        greenie: [...greenieArray, { id, fee: 1, participantGolferIds: gameEligibleIds('greenie') }]
      } 
    });
    setGreenieSetupId(id);
  };
  const removeGreenie = (id: string) => {
    useStore.getState().removeGreenie(eventId, id);
  };
  const setGreenieCount = (greenieId: string, golferId: string, count: number) => {
    const currentResults = (event.greenieResults && event.greenieResults[greenieId]) || [];
    const updatedResults = currentResults.filter((r: any) => r.golferId !== golferId);
    if (count > 0) {
      updatedResults.push({ golferId, count });
    }
    useStore.getState().setGreenieResults(eventId, greenieId, updatedResults);
  };
  
  // Local UI state for bulk assignment modal
  const [bulkAssignState, setBulkAssignState] = React.useState<{ nassauId: string | null; selected: Set<string>; mode: 'assign' | 'roundRobin'; teamId?: string } | null>(null);

  const closeBulk = () => setBulkAssignState(null);

  const shuffle = (arr: any[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const getIndexValue = (g: any) => (g.handicapIndex ?? 18); // fallback mid handicap if missing

  const applyTeamsUpdate = (nassau: any, teams: any[]) => {
    updateEvent(eventId, { games: { ...event.games, nassau: event.games.nassau.map((x: any) => x.id === nassau.id ? { ...x, teams } : x) } });
  };

  const ensureTeams = (nassau: any, min: number = 2) => {
    let teams = nassau.teams || [];
    if (teams.length < min) {
      for (let i = teams.length; i < min; i++) {
        teams.push({ id: 'T' + (i + 1), name: 'Team ' + (i + 1), golferIds: [] });
      }
    }
    return teams;
  };

  const randomizeTeams = (nassau: any, golfers: any[]) => {
    // Respect participant subset if defined
    const active = golfers.filter(g => !nassau.participantGolferIds || nassau.participantGolferIds.includes(g.id));
    if (active.length < 2) return;
    const teams = ensureTeams(nassau, Math.min(4, Math.max(2, nassau.teams?.length || 2))); // keep existing count if present
    const shuffled = shuffle(active.map(g => g.id));
    const newTeams = teams.map((t: any) => ({ ...t, golferIds: [] }));
    shuffled.forEach((gid, i) => {
      newTeams[i % newTeams.length].golferIds.push(gid);
    });
    applyTeamsUpdate(nassau, newTeams);
  };

  const autoBalanceTeams = (nassau: any, golfers: any[]) => {
    const teams = ensureTeams(nassau, Math.min(4, Math.max(2, nassau.teams?.length || 2)));
    const sorted = [...golfers].sort((a, b) => getIndexValue(a) - getIndexValue(b));
    // Snake distribution for balance
    const newTeams = teams.map((t: any) => ({ ...t, golferIds: [] }));
    let direction = 1; let teamIdx = 0;
    sorted.forEach(g => {
      newTeams[teamIdx].golferIds.push(g.id);
      if (direction === 1) {
        if (teamIdx === newTeams.length - 1) { direction = -1; } else { teamIdx++; }
      } else {
        if (teamIdx === 0) { direction = 1; } else { teamIdx--; }
      }
    });
    applyTeamsUpdate(nassau, newTeams);
  };

  const commitBulkAssign = (nassau: any, groupGolfers: any[]) => {
    if (!bulkAssignState) return;
    const teams = ensureTeams(nassau);
    const selectedIds = Array.from(bulkAssignState.selected);
    let newTeams = teams.map((t: any) => ({ ...t, golferIds: t.golferIds.filter((gid: string) => !selectedIds.includes(gid)) }));
    if (bulkAssignState.mode === 'assign' && bulkAssignState.teamId) {
      newTeams = newTeams.map((t: any) => t.id === bulkAssignState.teamId ? { ...t, golferIds: [...t.golferIds, ...selectedIds] } : t);
    } else if (bulkAssignState.mode === 'roundRobin') {
      selectedIds.forEach((gid, i) => {
        newTeams[i % newTeams.length].golferIds.push(gid);
      });
    }
    applyTeamsUpdate(nassau, newTeams);
    closeBulk();
  };



  return (
    <div className="space-y-6">
      {event.isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="font-medium">✓ Event Completed</span>
            <span className="text-xs">Games configuration is read-only</span>
          </div>
        </div>
      )}
      
      {!event.isCompleted && !isOwner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <span className="font-medium">ℹ️ View Only</span>
            <span className="text-xs">Only the event owner can create and modify games</span>
          </div>
        </div>
      )}

      {/* Add Game Button */}
      {!event.isCompleted && isOwner && (
        <div className="relative">
          <button
            onClick={() => setShowAddGame(!showAddGame)}
            className="w-full py-3 border-2 border-dashed border-primary-300 rounded-lg text-primary-600 font-medium hover:bg-primary-50 hover:border-primary-400 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Game
          </button>

          {showAddGame && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-2">Select Game Type</span>
                <button onClick={() => setShowAddGame(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close menu">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {GAME_TYPES.map((type) => (
                  <div key={type.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{type.name}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDescription(expandedDescription === type.id ? null : type.id);
                          }}
                          className="text-gray-400 hover:text-primary-600 transition-colors"
                          aria-label={expandedDescription === type.id ? "Hide description" : "Show description"}
                        >
                          <svg className={`w-4 h-4 transform transition-transform ${expandedDescription === type.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const defaultNet = Boolean(currentProfile?.preferences?.defaultNetScoring);
                            if (type.id === 'nassau') addNassau(defaultNet);
                            if (type.id === 'skins') addSkins(defaultNet);
                            if (type.id === 'pinky') addPinky();
                            if (type.id === 'greenie') addGreenie();
                            setShowAddGame(false);
                          }}
                          className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {expandedDescription === type.id && (
                      <div className="text-xs text-gray-600 mt-2 bg-blue-50 p-2 rounded border border-blue-100">
                        {type.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {event.games.nassau.length === 0 && skinsArray.length === 0 && pinkyArray.length === 0 && greenieArray.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-sm font-medium text-gray-900">No Games Configured</h3>
          <p className="text-xs text-gray-500 mt-1">Add a game to start tracking bets and scores.</p>
        </div>
      )}
      
      {event.games.nassau.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Nassau
          </h2>
          <div className="grid gap-3 max-w-lg">
            {event.games.nassau.map((n: any, i: number) => {
              const updateCfg = (patch: any) =>
                updateEvent(eventId, {
                  games: {
                    ...event.games,
                    nassau: event.games.nassau.map((x: any) => (x.id === n.id ? { ...x, ...patch } : x)),
                  },
                });

              const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
              const hasTeams = Boolean((n.teams || []).filter((t: any) => (t.golferIds || []).length > 0).length >= 2);

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNassauSetupId(n.id)}
                  className="text-left border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-extrabold text-gray-900">Nassau #{i + 1}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-bold">
                          {n.net ? 'Net' : 'Gross'}
                        </span>
                        {hasTeams ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                            Teams
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                            Individual
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Out <span className="font-bold text-slate-800">${fees.out}</span> · In{' '}
                        <span className="font-bold text-slate-800">${fees.in}</span> · Total{' '}
                        <span className="font-bold text-slate-800">${fees.total}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Tap to edit · Pick teams when you’re ready
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeNassau(n.id);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={event.isCompleted || !isOwner}
                      title="Remove Nassau"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/event/${eventId}/games/nassau/${n.id}/teams`);
                      }}
                      className="text-xs font-extrabold px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={event.isCompleted || !isOwner}
                    >
                      Pick teams
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateCfg({ net: !n.net });
                      }}
                      className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={event.isCompleted || !isOwner}
                      title="Toggle net/gross"
                    >
                      {n.net ? 'Switch to Gross' : 'Switch to Net'}
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Nassau Setup Modal (simple) */}
      {nassauSetupId && (() => {
        const n = event.games.nassau.find((x: any) => x.id === nassauSetupId);
        if (!n) return null;
        const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
        const updateCfg = (patch: any) =>
          updateEvent(eventId, {
            games: { ...event.games, nassau: event.games.nassau.map((x: any) => (x.id === n.id ? { ...x, ...patch } : x)) },
          });
        const setFees = (next: { out: number; in: number; total: number }) => updateCfg({ fees: next });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Nassau setup</div>
                  <div className="font-extrabold text-gray-900">Set wagers</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNassauSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Gross vs Net</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: false })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        !n.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={event.isCompleted || !isOwner}
                    >
                      Gross
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: true })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        n.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={event.isCompleted || !isOwner}
                    >
                      Net
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">Wagers (per player)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Out
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                        value={fees.out}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setFees({ ...fees, out: Number(e.target.value) })}
                        disabled={event.isCompleted || !isOwner}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      In
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                        value={fees.in}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setFees({ ...fees, in: Number(e.target.value) })}
                        disabled={event.isCompleted || !isOwner}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Total
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
                        value={fees.total}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => setFees({ ...fees, total: Number(e.target.value) })}
                        disabled={event.isCompleted || !isOwner}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {[
                      { label: '5/5/5', fees: { out: 5, in: 5, total: 5 } },
                      { label: '5/5/10', fees: { out: 5, in: 5, total: 10 } },
                      { label: '10/10/10', fees: { out: 10, in: 10, total: 10 } },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setFees(p.fees)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                        disabled={event.isCompleted || !isOwner}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-600">
                    Next: pick teams when your full group is ready. You can come back anytime.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNassauSetupId(null);
                      navigate(`/event/${eventId}/games/nassau/${n.id}/teams`);
                    }}
                    className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-extrabold"
                    disabled={event.isCompleted || !isOwner}
                  >
                    Pick teams
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setNassauSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {skinsArray.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Skins
          </h2>
          <div className="grid gap-3 max-w-lg">
          {skinsArray.map((sk:any, i:number) => {
            const participantIds =
              sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds : allGolfers.map((gg: any) => gg.id);
            return (
              <button
                key={sk.id}
                type="button"
                onClick={() => setSkinsSetupId(sk.id)}
                className="text-left border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-extrabold text-gray-900">Skins #{i + 1}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-bold">
                        {sk.net ? 'Net' : 'Gross'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                        {sk.carryovers ? 'Carryovers' : 'No carry'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      <span className="font-bold text-slate-800">${sk.fee}</span> per player ·{' '}
                      <span className="font-bold text-slate-800">{participantIds.length}</span> playing
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Tap to edit</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeSkins(sk.id);
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={event.isCompleted || !isOwner}
                    title="Remove Skins"
                  >
                    Remove
                  </button>
                </div>
              </button>
            );
          })}
          </div>
        </section>
      )}
      
      {pinkyArray.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Pinky
          </h2>
          <div className="grid gap-3 max-w-lg">
            {pinkyArray.map((pinky: any, i: number) => {
              const participantIds =
                pinky.participantGolferIds && pinky.participantGolferIds.length > 1 ? pinky.participantGolferIds : allGolfers.map((g: any) => g.id);
              const results = (event.pinkyResults && event.pinkyResults[pinky.id]) || [];
              const entered = results.filter((r: any) => r.count > 0).length;
              return (
                <button
                  key={pinky.id}
                  type="button"
                  onClick={() => setPinkySetupId(pinky.id)}
                  className="text-left border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-extrabold text-gray-900">Pinky #{i + 1}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          ${pinky.fee} / pinky
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{participantIds.length}</span> playing ·{' '}
                        <span className="font-bold text-slate-800">{entered}</span> with counts
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Tap to enter counts</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removePinky(pinky.id);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={event.isCompleted || !isOwner}
                      title="Remove Pinky"
                    >
                      Remove
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {greenieArray.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Greenie
          </h2>
          <div className="grid gap-3 max-w-lg">
            {greenieArray.map((greenie: any, i: number) => {
              const participantIds =
                greenie.participantGolferIds && greenie.participantGolferIds.length > 1 ? greenie.participantGolferIds : allGolfers.map((g: any) => g.id);
              const results = (event.greenieResults && event.greenieResults[greenie.id]) || [];
              const entered = results.filter((r: any) => r.count > 0).length;
              return (
                <button
                  key={greenie.id}
                  type="button"
                  onClick={() => setGreenieSetupId(greenie.id)}
                  className="text-left border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-extrabold text-gray-900">Greenie #{i + 1}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          ${greenie.fee} / greenie
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{participantIds.length}</span> playing ·{' '}
                        <span className="font-bold text-slate-800">{entered}</span> with counts
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Tap to enter counts</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeGreenie(greenie.id);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={event.isCompleted || !isOwner}
                      title="Remove Greenie"
                    >
                      Remove
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Skins Setup Modal */}
      {skinsSetupId && (() => {
        const sk = skinsArray.find((x: any) => x.id === skinsSetupId);
        if (!sk) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, skins: skinsArray.map((s: any) => (s.id === sk.id ? { ...s, ...patch } : s)) } });

        const participantIds =
          sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Skins setup</div>
                  <div className="font-extrabold text-gray-900">Quick settings</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSkinsSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Gross vs Net</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: false })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        !sk.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={event.isCompleted || !isOwner}
                    >
                      Gross
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: true })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        sk.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={event.isCompleted || !isOwner}
                    >
                      Net
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Wager</div>
                  <label className="text-xs text-slate-600">Fee per player</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sk.fee}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={event.isCompleted || !isOwner}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!sk.carryovers}
                      onChange={(e) => updateCfg({ carryovers: e.target.checked })}
                      disabled={event.isCompleted || !isOwner}
                    />
                    Carryovers (ties carry)
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-700">Players</div>
                      <div className="text-[11px] text-slate-500">Tap names to include/exclude</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setList(allGolfers.map((g: any) => g.id))}
                      className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                      disabled={event.isCompleted || !isOwner || activeGolfers.length === allGolfers.length}
                    >
                      All
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeGolfers.map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGolfer(g.id)}
                        disabled={event.isCompleted || !isOwner}
                        className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                      >
                        {g.name}
                      </button>
                    ))}
                    {inactiveGolfers.map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGolfer(g.id)}
                        disabled={event.isCompleted || !isOwner}
                        className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSkinsSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pinky Setup/Entry Modal */}
      {pinkySetupId && (() => {
        const cfg = pinkyArray.find((x: any) => x.id === pinkySetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, pinky: pinkyArray.map((p: any) => (p.id === cfg.id ? { ...p, ...patch } : p)) } });

        const participantIds =
          cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        const results = (event.pinkyResults && event.pinkyResults[cfg.id]) || [];
        const getCount = (gid: string) => results.find((r: any) => r.golferId === gid)?.count || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Pinky</div>
                  <div className="font-extrabold text-gray-900">Enter counts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPinkySetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="text-xs text-slate-600">Fee per pinky</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={cfg.fee}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={event.isCompleted || !isOwner}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Counts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeGolfers.map((g: any) => (
                      <label key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <span className="text-xs font-bold text-slate-800 truncate" title={g.name}>
                          {g.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={getCount(g.id)}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setPinkyCount(cfg.id, g.id, Number(e.target.value))}
                          disabled={event.isCompleted || !isOwner}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700 select-none">Players</summary>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">Tap to include/exclude</div>
                      <button
                        type="button"
                        onClick={() => setList(allGolfers.map((g: any) => g.id))}
                        className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                        disabled={event.isCompleted || !isOwner || activeGolfers.length === allGolfers.length}
                      >
                        All
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={event.isCompleted || !isOwner}
                          className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                      {inactiveGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={event.isCompleted || !isOwner}
                          className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    removePinky(cfg.id);
                    setPinkySetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={event.isCompleted || !isOwner}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setPinkySetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Greenie Setup/Entry Modal */}
      {greenieSetupId && (() => {
        const cfg = greenieArray.find((x: any) => x.id === greenieSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, greenie: greenieArray.map((g: any) => (g.id === cfg.id ? { ...g, ...patch } : g)) } });

        const participantIds =
          cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        const results = (event.greenieResults && event.greenieResults[cfg.id]) || [];
        const getCount = (gid: string) => results.find((r: any) => r.golferId === gid)?.count || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Greenie</div>
                  <div className="font-extrabold text-gray-900">Enter counts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setGreenieSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="text-xs text-slate-600">Fee per greenie</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={cfg.fee}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={event.isCompleted || !isOwner}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Counts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeGolfers.map((g: any) => (
                      <label key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <span className="text-xs font-bold text-slate-800 truncate" title={g.name}>
                          {g.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={getCount(g.id)}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setGreenieCount(cfg.id, g.id, Number(e.target.value))}
                          disabled={event.isCompleted || !isOwner}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700 select-none">Players</summary>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">Tap to include/exclude</div>
                      <button
                        type="button"
                        onClick={() => setList(allGolfers.map((g: any) => g.id))}
                        className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                        disabled={event.isCompleted || !isOwner || activeGolfers.length === allGolfers.length}
                      >
                        All
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={event.isCompleted || !isOwner}
                          className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                      {inactiveGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={event.isCompleted || !isOwner}
                          className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    removeGreenie(cfg.id);
                    setGreenieSetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={event.isCompleted || !isOwner}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setGreenieSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      {bulkAssignState && (() => {
        const nassau = event.games.nassau.find((nn: any) => nn.id === bulkAssignState.nassauId);
        if (!nassau) return null;
        const participantIds = nassau.participantGolferIds && nassau.participantGolferIds.length > 1 ? nassau.participantGolferIds : allGolfers.map((gg:any)=>gg.id);
        const activeGolfers = allGolfers.filter((g:any)=> participantIds.includes(g.id));
        const teams = nassau.teams || [];
        const allAssignedIds = new Set(teams.flatMap((t:any)=> t.golferIds));
        // Only show unassigned golfers to streamline repeated assignments
        const unassigned = activeGolfers.filter((gg:any)=> !allAssignedIds.has(gg.id));
        const toggleSelect = (id: string) => {
          setBulkAssignState(s => {
            if (!s) return s;
            const next = new Set(s.selected);
            if (next.has(id)) next.delete(id); else next.add(id);
            return { ...s, selected: next };
          });
        };
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40">
            <div className="bg-white rounded shadow-lg w-full max-w-md p-4 flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Bulk Assign Golfers</h3>
                <button onClick={closeBulk} className="text-[10px] px-2 py-0.5 rounded border">Close</button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='assign'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'assign'}:s)} disabled={event.isCompleted || !isOwner} /> Assign to Team</label>
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='roundRobin'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'roundRobin'}:s)} disabled={event.isCompleted || !isOwner} /> Even Round-Robin</label>
                {bulkAssignState.mode==='assign' && (
                  <select className="border rounded px-1 py-0.5 disabled:opacity-50" aria-label="Select team to assign" value={bulkAssignState.teamId || ''} onChange={e => setBulkAssignState(s=> s?{...s, teamId: e.target.value || undefined}:s)} disabled={event.isCompleted || !isOwner}>
                    <option value="">Select team</option>
                    {teams.map((t: any)=> <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <div className="border rounded max-h-60 overflow-auto p-2 grid grid-cols-2 gap-1">
                {unassigned.length === 0 && (
                  <div className="col-span-2 text-[10px] text-gray-500">All golfers assigned to a team.</div>
                )}
                {unassigned.map((gg: any) => {
                  const sel = bulkAssignState.selected.has(gg.id);
                  return (
                    <label key={gg.id} className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${sel ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-700'} disabled:opacity-50 disabled:cursor-not-allowed ${event.isCompleted ? 'pointer-events-none' : ''}`}>
                      <input type="checkbox" className="hidden" checked={sel} onChange={()=> toggleSelect(gg.id)} disabled={event.isCompleted || !isOwner} />
                      <span className="truncate">{gg.name}</span>
                      {gg.handicapIndex != null && <span className="text-[9px] opacity-70">({gg.handicapIndex})</span>}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between items-center">
                <div className="text-[10px] text-gray-500">{bulkAssignState.selected.size} selected</div>
                <div className="flex gap-2">
                  <button disabled={bulkAssignState.selected.size===0 || (bulkAssignState.mode==='assign' && !bulkAssignState.teamId) || event.isCompleted} onClick={()=> commitBulkAssign(nassau, activeGolfers)} className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white disabled:opacity-40">Apply</button>
                  <button onClick={closeBulk} className="text-[10px] px-3 py-1 rounded border">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GamesTab;

