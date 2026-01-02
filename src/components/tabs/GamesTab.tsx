import React, { useState } from 'react';
import useStore from '../../state/store';
// Skins preview (holes won) moved to OverviewTab.
import { nanoid } from 'nanoid/non-secure';

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
    description: 'Each hole is worth a "skin". The player with the lowest score on a hole wins the skin. Ties carry over to the next hole.',
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
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const profiles = useStore((s: any) => s.profiles);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const updateEvent = useStore((s: any) => s.updateEvent);
  
  const [showAddGame, setShowAddGame] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);

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
  const addNassau = (net: boolean) => {
    // Use the default group (first group) for the Nassau game
    const defaultGroupId = event.groups.length > 0 ? event.groups[0].id : null;
    if (!defaultGroupId) {
      alert('Please create an event with golfers first before adding games.');
      return;
    }
    updateEvent(eventId, { games: { ...event.games, nassau: [...event.games.nassau, { id: nanoid(6), groupId: defaultGroupId, fee: 5, net }] } });
  };
  const removeNassau = (id: string) => {
    useStore.getState().removeNassau(eventId, id);
  };
  const skinsArray: any[] = Array.isArray(event.games.skins) ? event.games.skins : (event.games.skins ? [event.games.skins] : []);
  const addSkins = (net: boolean) => {
    updateEvent(eventId, { games: { ...event.games, skins: [...skinsArray, { id: nanoid(6), fee: 10, net }] } });
  };
  const removeSkins = (id: string) => {
    useStore.getState().removeSkins(eventId, id);
  };
  
  // Pinky game management
  const pinkyArray: any[] = Array.isArray(event.games.pinky) ? event.games.pinky : [];
  const addPinky = () => {
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: [...pinkyArray, { id: nanoid(6), fee: 1 }],
        greenie: event.games.greenie || []
      } 
    });
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
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: event.games.pinky || [],
        greenie: [...greenieArray, { id: nanoid(6), fee: 1 }]
      } 
    });
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
                        {type.hasNetOption ? (
                          <>
                            <button
                              onClick={() => {
                                if (type.id === 'nassau') addNassau(false);
                                if (type.id === 'skins') addSkins(false);
                                setShowAddGame(false);
                              }}
                              className="text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:border-primary-500 hover:text-primary-600"
                            >
                              Add Gross
                            </button>
                            <button
                              onClick={() => {
                                if (type.id === 'nassau') addNassau(true);
                                if (type.id === 'skins') addSkins(true);
                                setShowAddGame(false);
                              }}
                              className="text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:border-primary-500 hover:text-primary-600"
                            >
                              Add Net
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              if (type.id === 'pinky') addPinky();
                              if (type.id === 'greenie') addGreenie();
                              setShowAddGame(false);
                            }}
                            className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
                          >
                            Add
                          </button>
                        )}
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
            const updateCfg = (patch: any) => updateEvent(eventId, { games: { ...event.games, nassau: event.games.nassau.map((x: any) => x.id === n.id ? { ...x, ...patch } : x) } });
            const participantIds = n.participantGolferIds && n.participantGolferIds.length > 1 ? n.participantGolferIds : allGolfers.map((gg:any)=>gg.id);
            const activeGolfers = allGolfers.filter((g:any)=> participantIds.includes(g.id));
            const inactiveGolfers = allGolfers.filter((g:any)=> !participantIds.includes(g.id));
            const setList = (listIds: string[]) => {
              const normalized = listIds.length === allGolfers.length ? undefined : listIds;
              updateCfg({ participantGolferIds: normalized });
            };
            const removeActive = (gid: string) => {
              let list = participantIds.filter((id: string) => id !== gid);
                if (list.length < 2) list = allGolfers.map((gg:any)=>gg.id); // enforce minimum
              setList(list);
            };
            const addInactive = (gid: string) => {
              let list = [...participantIds, gid];
              setList(list);
            };
            return (
              <div key={n.id} className="border rounded p-3 bg-white shadow-sm text-[11px] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Nassau #{i+1}</span>
                    <span className="text-[10px] px-1 rounded bg-primary-100 text-primary-700">{n.net ? 'Net' : 'Gross'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">Fee
                      <input className="border rounded px-1 py-0.5 w-20" type="number" value={n.fee} onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={event.isCompleted || !isOwner} />
                    </label>
                    <label className="flex items-center gap-1">Net
                      <input type="checkbox" checked={n.net} onChange={e => updateCfg({ net: e.target.checked })} disabled={event.isCompleted || !isOwner} />
                    </label>
                    {(() => {
                      const teamsArr = (n.teams || []).filter((t:any)=> t.golferIds && t.golferIds.length>0);
                      const minTeamSize = teamsArr.length>0 ? Math.min(...teamsArr.map((t:any)=> t.golferIds.length)) : 0;
                      const current = n.teamBestCount || undefined;
                      const maxSelectable = minTeamSize; // can't exceed smallest team
                      const options = Array.from({length: maxSelectable}, (_,i)=> i+1);
                      const effectiveValue = current && current <= maxSelectable ? String(current) : '';
                      const hasTeams = teamsArr.length > 0;
                      
                      // Only show Team Best dropdown if teams exist
                      if (!hasTeams) return null;
                      
                      return (
                        <label className="flex items-center gap-1" title={maxSelectable===0? 'Add players to teams to enable Team Best': 'Number of best scores per team used per segment'}>
                          Team Best
                          <select
                            className="border rounded px-1 py-0.5 disabled:opacity-50"
                            value={effectiveValue}
                            disabled={maxSelectable===0 || event.isCompleted}
                            onChange={e => updateCfg({ teamBestCount: e.target.value ? Number(e.target.value) : undefined })}
                          >
                            <option value="">—</option>
                            {options.map(v=> <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                      );
                    })()}
                    <button type="button" onClick={() => removeNassau(n.id)} className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>Remove</button>
                  </div>
                </div>
                
                {/* Participants Section */}
                <div className="border-t pt-2 mt-2">
                  <h4 className="font-semibold text-[10px] tracking-wide mb-2">Participants ({activeGolfers.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-semibold tracking-wide text-primary-700">Playing</span>
                        {activeGolfers.length !== allGolfers.length && (
                          <button className="text-[9px] underline disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))} disabled={event.isCompleted || !isOwner}>All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to remove" onClick={()=> removeActive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-primary-600 text-white border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                            {g.name}
                          </button>
                        ))}
                        {activeGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-semibold tracking-wide text-gray-700">Not Playing</span>
                        {inactiveGolfers.length>0 && (
                          <button className="text-[9px] underline disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))} disabled={event.isCompleted || !isOwner}>Add All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {inactiveGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to add" onClick={()=> addInactive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-primary-700 border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                            {g.name}
                          </button>
                        ))}
                        {inactiveGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-2">Tap a name to move between lists. Minimum 2 participants enforced.</div>
                </div>
                
                <div className="flex flex-col gap-2 mt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[10px] tracking-wide">Team Options</span>
                      {(() => {
                        const hasTeams = (n.teams || []).filter((t:any)=> t.golferIds && t.golferIds.length>0).length > 0;
                        if (hasTeams) {
                          return <span className="text-[9px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Team Stroke Nassau</span>;
                        } else {
                          return <span className="text-[9px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Individual Nassau</span>;
                        }
                      })()}
                    </div>
                    {(() => {
                      const hasTeams = (n.teams || []).filter((t:any)=> t.golferIds && t.golferIds.length>0).length > 0;
                      const canAddTeams = activeGolfers.length >= 4;
                      
                      if (!hasTeams && !canAddTeams) {
                        return (
                          <div className="text-[10px] text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200 mb-2">
                            ℹ️ Individual Nassau - lowest total score wins each segment (front 9, back 9, total 18). Need 4+ golfers to create teams.
                          </div>
                        );
                      }
                      
                      if (!hasTeams && canAddTeams) {
                        return (
                          <div className="text-[10px] text-blue-700 bg-blue-50 px-3 py-2 rounded border border-blue-200 mb-2">
                            ℹ️ Individual Nassau mode. Add teams below for team play (optional).
                          </div>
                        );
                      }
                      
                      return null;
                    })()}
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                      {(() => {
                        const canAddTeams = activeGolfers.length >= 4;
                        return (
                          <button 
                            type="button" 
                            className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-primary-50 text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed" 
                            onClick={() => {
                              const teams = n.teams || [];
                              updateCfg({ teams: [...teams, { id: 'T' + (teams.length + 1), name: 'Team ' + (teams.length + 1), golferIds: [] }] });
                            }} 
                            disabled={event.isCompleted || !isOwner || !canAddTeams}
                            title={!canAddTeams ? 'Need 4+ golfers to create teams' : 'Add a new team'}
                          >
                            Add Team{!canAddTeams ? ' (4+ golfers)' : ''}
                          </button>
                        );
                      })()}
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-white text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => randomizeTeams(n, activeGolfers)} disabled={event.isCompleted || !isOwner}>Randomize</button>
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-white text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => autoBalanceTeams(n, activeGolfers)} disabled={event.isCompleted || !isOwner}>Auto-Balance</button>
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-600 rounded bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setBulkAssignState({ nassauId: n.id, selected: new Set(), mode: 'assign' })} disabled={event.isCompleted || !isOwner}>Assign</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[10px] tracking-wide">Teams</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(n.teams || []).map((t: any, ti: number) => (
                      <div key={t.id} className="border rounded p-2 bg-white/70 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input className="border rounded px-1 py-0.5 flex-1 disabled:opacity-50" aria-label="Team Name" value={t.name} onChange={e => {
                            const teams = (n.teams || []).map((x: any) => x.id === t.id ? { ...x, name: e.target.value } : x);
                            updateCfg({ teams });
                          }} disabled={event.isCompleted || !isOwner} />
                          <button type="button" className="text-[10px] text-red-600 border border-red-200 rounded px-1 py-0.5 bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => {
                            const teams = (n.teams || []).filter((x: any) => x.id !== t.id);
                            updateCfg({ teams });
                          }} disabled={event.isCompleted || !isOwner}>Remove</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const allTeams = (n.teams || []);
                            const assignedElsewhere = new Set<string>();
                            allTeams.forEach((tm: any) => {
                              if (tm.id === t.id) return;
                              tm.golferIds.forEach((gid: string) => assignedElsewhere.add(gid));
                            });
                            return activeGolfers
                              .filter((gg: any) => t.golferIds.includes(gg.id) || !assignedElsewhere.has(gg.id))
                              .map((gg: any) => {
                                const active = t.golferIds.includes(gg.id);
                                return (
                                  <button
                                    type="button"
                                    key={gg.id}
                                    onClick={() => {
                                      const teams = (n.teams || []).map((x: any) => x.id === t.id ? { ...x, golferIds: active ? x.golferIds.filter((id: string) => id !== gg.id) : [...x.golferIds, gg.id] } : x);
                                      updateCfg({ teams });
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    disabled={event.isCompleted || !isOwner}
                                  >{gg.name}</button>
                                );
                              });
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}

      {skinsArray.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Skins
          </h2>
          <div className="grid gap-3 max-w-lg">
          {skinsArray.map((sk:any, i:number) => {
            const updateCfg = (patch: any) => updateEvent(eventId, { games: { ...event.games, skins: skinsArray.map((s:any)=> s.id===sk.id? { ...s, ...patch } : s) } });
            const participantIds = sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds : allGolfers.map((gg:any)=>gg.id);
            const activeGolfers = allGolfers.filter((g:any)=> participantIds.includes(g.id));
            const inactiveGolfers = allGolfers.filter((g:any)=> !participantIds.includes(g.id));
            const setList = (listIds: string[]) => {
              const normalized = listIds.length === allGolfers.length ? undefined : listIds;
              updateCfg({ participantGolferIds: normalized });
            };
            const removeActive = (gid: string) => {
              let list = participantIds.filter((id: string) => id !== gid);
                if (list.length < 2) list = allGolfers.map((gg:any)=>gg.id);
              setList(list);
            };
            const addInactive = (gid: string) => {
              let list = [...participantIds, gid];
              setList(list);
            };
            return (
            <div key={sk.id} className="border rounded p-3 bg-white shadow-sm text-[11px] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">Skins #{i+1}</span>
                  <span className="text-[10px] px-1 rounded bg-primary-100 text-primary-700">{sk.net ? 'Net' : 'Gross'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">Fee
                    <input className="border rounded px-1 py-0.5 w-20" type="number" value={sk.fee} onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={event.isCompleted || !isOwner} />
                  </label>
                  <button type="button" onClick={()=> removeSkins(sk.id)} className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>Remove</button>
                </div>
              </div>
              
              <div className="border-t pt-2 mt-2">
                  <h4 className="font-semibold text-[10px] tracking-wide mb-2">Participants ({activeGolfers.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-semibold tracking-wide text-primary-700">Playing</span>
                        {activeGolfers.length !== allGolfers.length && (
                          <button className="text-[9px] underline disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))} disabled={event.isCompleted || !isOwner}>All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to remove" onClick={()=> removeActive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-primary-600 text-white border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                            {g.name}
                          </button>
                        ))}
                        {activeGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-semibold tracking-wide text-gray-700">Not Playing</span>
                        {inactiveGolfers.length>0 && (
                          <button className="text-[9px] underline disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))} disabled={event.isCompleted || !isOwner}>Add All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {inactiveGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to add" onClick={()=> addInactive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-primary-700 border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                            {g.name}
                          </button>
                        ))}
                        {inactiveGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
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
            const pinkyResults = (event.pinkyResults && event.pinkyResults[pinky.id]) || [];
            const participantIds = pinky.participantGolferIds && pinky.participantGolferIds.length > 1 ? pinky.participantGolferIds : allGolfers.map((g: any) => g.id);
            const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
            const inactiveGolfers = allGolfers.filter((g:any)=> !participantIds.includes(g.id));
            
            const updateCfg = (patch: any) => updateEvent(eventId, { games: { ...event.games, pinky: pinkyArray.map((p: any) => p.id === pinky.id ? { ...p, ...patch } : p) } });
            const setList = (listIds: string[]) => {
              const normalized = listIds.length === allGolfers.length ? undefined : listIds;
              updateCfg({ participantGolferIds: normalized });
            };
            const removeActive = (gid: string) => {
              let list = participantIds.filter((id: string) => id !== gid);
                if (list.length < 2) list = allGolfers.map((gg:any)=>gg.id);
              setList(list);
            };
            const addInactive = (gid: string) => {
              let list = [...participantIds, gid];
              setList(list);
            };
            
            return (
              <div key={pinky.id} className="border rounded p-3 bg-white shadow-sm text-[11px] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Pinky #{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">Fee per Pinky
                      <input 
                        className="border rounded px-1 py-0.5 w-20" 
                        type="number" 
                        min="0.25"
                        step="0.25"
                        value={pinky.fee} 
                        onChange={e => updateCfg({ fee: Number(e.target.value) })} 
                        disabled={event.isCompleted || !isOwner} 
                      />
                    </label>
                    <button 
                      type="button" 
                      onClick={() => removePinky(pinky.id)} 
                      className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={event.isCompleted || !isOwner}
                    >Remove</button>
                  </div>
                </div>
                
                <div className="border-t pt-2">
                  <div className="text-[10px] font-semibold mb-2 text-gray-700">Player Pinky Counts:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeGolfers.map((golfer: any) => {
                      const result = pinkyResults.find((r: any) => r.golferId === golfer.id);
                      const count = result?.count || 0;
                      
                      return (
                        <div key={golfer.id} className="flex items-center gap-2">
                          <label className="flex-1 truncate text-[10px]" title={golfer.name}>
                            {golfer.name}:
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="border rounded px-1 py-0.5 w-14 text-center text-[10px]"
                            value={count}
                            onChange={e => setPinkyCount(pinky.id, golfer.id, Number(e.target.value))}
                            disabled={!isOwner}
                            placeholder="0"
                            aria-label={`Pinky count for ${golfer.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Participants Management */}
                <div className="border-t pt-2 mt-1">
                   <details className="group">
                      <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                         <span className="group-open:rotate-90 transition-transform">▶</span> Manage Participants
                      </summary>
                      <div className="mt-2 pl-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-semibold tracking-wide text-primary-700">Playing</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {activeGolfers.map((g:any)=>(
                                  <button key={g.id} type="button" title="Tap to remove" onClick={()=> removeActive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-primary-600 text-white border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                                    {g.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-semibold tracking-wide text-gray-700">Not Playing</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {inactiveGolfers.map((g:any)=>(
                                  <button key={g.id} type="button" title="Tap to add" onClick={()=> addInactive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-primary-700 border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                                    {g.name}
                                  </button>
                                ))}
                                {inactiveGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                              </div>
                            </div>
                          </div>
                      </div>
                   </details>
                </div>
              </div>
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
            const greenieResults = (event.greenieResults && event.greenieResults[greenie.id]) || [];
            const participantIds = greenie.participantGolferIds && greenie.participantGolferIds.length > 1 ? greenie.participantGolferIds : allGolfers.map((g: any) => g.id);
            const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
            const inactiveGolfers = allGolfers.filter((g:any)=> !participantIds.includes(g.id));
            
            const updateCfg = (patch: any) => updateEvent(eventId, { games: { ...event.games, greenie: greenieArray.map((g: any) => g.id === greenie.id ? { ...g, ...patch } : g) } });
            const setList = (listIds: string[]) => {
              const normalized = listIds.length === allGolfers.length ? undefined : listIds;
              updateCfg({ participantGolferIds: normalized });
            };
            const removeActive = (gid: string) => {
              let list = participantIds.filter((id: string) => id !== gid);
                if (list.length < 2) list = allGolfers.map((gg:any)=>gg.id);
              setList(list);
            };
            const addInactive = (gid: string) => {
              let list = [...participantIds, gid];
              setList(list);
            };
            
            return (
              <div key={greenie.id} className="border rounded p-3 bg-white shadow-sm text-[11px] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">Greenie #{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">Fee per Greenie
                      <input 
                        className="border rounded px-1 py-0.5 w-20" 
                        type="number" 
                        min="0.25"
                        step="0.25"
                        value={greenie.fee} 
                        onChange={e => updateCfg({ fee: Number(e.target.value) })} 
                        disabled={event.isCompleted || !isOwner} 
                      />
                    </label>
                    <button 
                      type="button" 
                      onClick={() => removeGreenie(greenie.id)} 
                      className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                      disabled={event.isCompleted || !isOwner}
                    >Remove</button>
                  </div>
                </div>
                
                <div className="border-t pt-2">
                  <div className="text-[10px] font-semibold mb-2 text-gray-700">Player Greenie Counts:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeGolfers.map((golfer: any) => {
                      const result = greenieResults.find((r: any) => r.golferId === golfer.id);
                      const count = result?.count || 0;
                      
                      return (
                        <div key={golfer.id} className="flex items-center gap-2">
                          <label className="flex-1 truncate text-[10px]" title={golfer.name}>
                            {golfer.name}:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="4"
                            className="border rounded px-1 py-0.5 w-14 text-center text-[10px]"
                            value={count}
                            onChange={e => setGreenieCount(greenie.id, golfer.id, Number(e.target.value))}
                            disabled={!isOwner}
                            placeholder="0"
                            aria-label={`Greenie count for ${golfer.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Participants Management */}
                <div className="border-t pt-2 mt-1">
                   <details className="group">
                      <summary className="text-[9px] text-gray-500 cursor-pointer hover:text-gray-700 select-none list-none flex items-center gap-1">
                         <span className="group-open:rotate-90 transition-transform">▶</span> Manage Participants
                      </summary>
                      <div className="mt-2 pl-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-semibold tracking-wide text-primary-700">Playing</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {activeGolfers.map((g:any)=>(
                                  <button key={g.id} type="button" title="Tap to remove" onClick={()=> removeActive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-primary-600 text-white border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                                    {g.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-semibold tracking-wide text-gray-700">Not Playing</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {inactiveGolfers.map((g:any)=>(
                                  <button key={g.id} type="button" title="Tap to add" onClick={()=> addInactive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-primary-700 border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={event.isCompleted || !isOwner}>
                                    {g.name}
                                  </button>
                                ))}
                                {inactiveGolfers.length===0 && <span className="text-[9px] text-gray-500">None</span>}
                              </div>
                            </div>
                          </div>
                      </div>
                   </details>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}
      
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

