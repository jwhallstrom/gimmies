import React from 'react';
import useStore from '../../state/store';
// Skins preview (holes won) moved to OverviewTab.
import { nanoid } from 'nanoid/non-secure';

type Props = { eventId: string };

const GamesTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) => s.events.find((e: any) => e.id === eventId));
  const profiles = useStore((s: any) => s.profiles);
  const updateEvent = useStore((s: any) => s.updateEvent);
  if (!event) return null;
  
  // Helper function to get golfer data from EventGolfer
  const getGolferData = (eventGolfer: any) => {
    if (eventGolfer.profileId) {
      const profile = profiles.find((p: any) => p.id === eventGolfer.profileId);
      return profile ? { id: eventGolfer.profileId, name: profile.name, handicapIndex: profile.handicapIndex } : null;
    } else if (eventGolfer.customName) {
      return { id: eventGolfer.customName, name: eventGolfer.customName, handicapIndex: null };
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

  // Participation Matrix setup
  const nassauGames = event.games.nassau;
  const skinsGames = skinsArray;
  const golfers = allGolfers;
  const toggleParticipation = (gameType: 'nassau' | 'skins', gameId: string, golferId: string) => {
    if (gameType === 'nassau') {
      updateEvent(eventId, {
        games: {
          ...event.games,
          nassau: event.games.nassau.map((n:any)=> {
            if (n.id !== gameId) return n;
            const allIds = allGolfers.map((g:any)=>g.id);
            let list = n.participantGolferIds && n.participantGolferIds.length>1 ? [...n.participantGolferIds] : [...allIds];
            const active = list.includes(golferId);
            list = active ? list.filter(id=>id!==golferId) : [...list, golferId];
            if (list.length < 2) list = allIds; // enforce minimum
            return { ...n, participantGolferIds: list.length===allIds.length ? undefined : list };
          })
        }
      });
    } else {
      updateEvent(eventId, {
        games: {
          ...event.games,
          skins: skinsGames.map((s:any)=> {
            if (s.id !== gameId) return s;
            const allIds = allGolfers.map((g:any)=>g.id);
            let list = s.participantGolferIds && s.participantGolferIds.length>1 ? [...s.participantGolferIds] : [...allIds];
            const active = list.includes(golferId);
            list = active ? list.filter(id=>id!==golferId) : [...list, golferId];
            if (list.length < 2) list = allIds;
            return { ...s, participantGolferIds: list.length===allIds.length ? undefined : list };
          })
        }
      });
    }
  };
  const Matrix: React.FC = () => {
    if (nassauGames.length===0 && skinsGames.length===0) return null;
    return (
      <div className="overflow-auto border rounded bg-white shadow-sm">
        <table className="min-w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border px-2 py-1 text-left">Golfer</th>
              {nassauGames.map((n:any,i:number)=> {
                const allIds = allGolfers.map((g:any)=>g.id);
                const participantIds = n.participantGolferIds && n.participantGolferIds.length > 1 ? n.participantGolferIds : allIds;
                return <th key={n.id} className="border px-2 py-1 text-center">N{i+1}<div className="text-[9px] font-normal">${n.fee} ({participantIds.length})</div></th>;
              })}
              {skinsGames.map((s:any,i:number)=> {
                const allIds = allGolfers.map((g:any)=>g.id);
                const participantIds = s.participantGolferIds && s.participantGolferIds.length>1 ? s.participantGolferIds : allIds;
                return <th key={s.id} className="border px-2 py-1 text-center">S{i+1}<div className="text-[9px] font-normal">${s.fee} ({participantIds.length})</div></th>;
              })}
            </tr>
          </thead>
          <tbody>
            {golfers.map((g:any) => (
              <tr key={g.id} className="odd:bg-slate-50/40">
                <td className="border px-2 py-1 font-medium whitespace-nowrap">{g.name}</td>
                {nassauGames.map((n:any)=> {
                  const allIds = allGolfers.map((g:any)=>g.id);
                  const participantIds = n.participantGolferIds && n.participantGolferIds.length>1 ? n.participantGolferIds : allIds;
                  const active = participantIds.includes(g.id);
                  return (
                    <td key={n.id} className="border px-1 py-0.5 text-center">
                      <button onClick={()=> toggleParticipation('nassau', n.id, g.id)} className={`px-2 py-0.5 rounded text-[10px] border ${active? 'bg-primary-600 text-white border-primary-600':'bg-white border-slate-300 text-slate-600'}`}>{active? 'In':'Out'}</button>
                    </td>
                  );
                })}
                {skinsGames.map((s:any)=> {
                  const allIds = allGolfers.map((g:any)=>g.id);
                  const participantIds = s.participantGolferIds && s.participantGolferIds.length>1 ? s.participantGolferIds : allIds;
                  const active = participantIds.includes(g.id);
                  return (
                    <td key={s.id} className="border px-1 py-0.5 text-center">
                      <button onClick={()=> toggleParticipation('skins', s.id, g.id)} className={`px-2 py-0.5 rounded text-[10px] border ${active? 'bg-primary-600 text-white border-primary-600':'bg-white border-slate-300 text-slate-600'}`}>{active? 'In':'Out'}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-2">Nassau (event)</h2>
        <div className="flex gap-2 mb-3">
          <button
            className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white font-medium shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={() => addNassau(false)}
          >Add Gross</button>
          <button
            className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white font-medium shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={() => addNassau(true)}
          >Add Net</button>
        </div>
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
                      <input className="border rounded px-1 py-0.5 w-20" type="number" value={n.fee} onChange={e => updateCfg({ fee: Number(e.target.value) })} />
                    </label>
                    <label className="flex items-center gap-1">Net
                      <input type="checkbox" checked={n.net} onChange={e => updateCfg({ net: e.target.checked })} />
                    </label>
                    {(() => {
                      const teamsArr = (n.teams || []).filter((t:any)=> t.golferIds && t.golferIds.length>0);
                      const minTeamSize = teamsArr.length>0 ? Math.min(...teamsArr.map((t:any)=> t.golferIds.length)) : 0;
                      const current = n.teamBestCount || undefined;
                      const maxSelectable = minTeamSize; // can't exceed smallest team
                      const options = Array.from({length: maxSelectable}, (_,i)=> i+1);
                      const effectiveValue = current && current <= maxSelectable ? String(current) : '';
                      return (
                        <label className="flex items-center gap-1" title={maxSelectable===0? 'Add players to teams to enable Team Best': 'Number of best scores per team used per segment'}>
                          Team Best
                          <select
                            className="border rounded px-1 py-0.5 disabled:opacity-50"
                            value={effectiveValue}
                            disabled={maxSelectable===0}
                            onChange={e => updateCfg({ teamBestCount: e.target.value ? Number(e.target.value) : undefined })}
                          >
                            <option value="">—</option>
                            {options.map(v=> <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                      );
                    })()}
                    <button type="button" onClick={() => removeNassau(n.id)} className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600">Remove</button>
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
                          <button className="text-[9px] underline" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))}>All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to remove" onClick={()=> removeActive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-primary-600 text-white border-primary-600">
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
                          <button className="text-[9px] underline" onClick={()=> setList(allGolfers.map((gg:any)=>gg.id))}>Add All</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {inactiveGolfers.map((g:any)=>(
                          <button key={g.id} type="button" title="Tap to add" onClick={()=> addInactive(g.id)} className="text-[9px] px-1.5 py-0.5 rounded border bg-white text-primary-700 border-primary-300">
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
                    </div>
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-primary-50 text-primary-700" onClick={() => {
                        const teams = n.teams || [];
                        updateCfg({ teams: [...teams, { id: 'T' + (teams.length + 1), name: 'Team ' + (teams.length + 1), golferIds: [] }] });
                      }}>Add Team</button>
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-white text-primary-700" onClick={() => randomizeTeams(n, activeGolfers)}>Randomize</button>
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-300 rounded bg-white text-primary-700" onClick={() => autoBalanceTeams(n, activeGolfers)}>Auto-Balance</button>
                      <button type="button" className="text-[10px] px-2 py-1 border border-primary-600 rounded bg-primary-600 text-white" onClick={() => setBulkAssignState({ nassauId: n.id, selected: new Set(), mode: 'assign' })}>Assign</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[10px] tracking-wide">Teams</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(n.teams || []).map((t: any, ti: number) => (
                      <div key={t.id} className="border rounded p-2 bg-white/70 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input className="border rounded px-1 py-0.5 flex-1" value={t.name} onChange={e => {
                            const teams = (n.teams || []).map((x: any) => x.id === t.id ? { ...x, name: e.target.value } : x);
                            updateCfg({ teams });
                          }} />
                          <button type="button" className="text-[10px] text-red-600 border border-red-200 rounded px-1 py-0.5 bg-red-50" onClick={() => {
                            const teams = (n.teams || []).filter((x: any) => x.id !== t.id);
                            updateCfg({ teams });
                          }}>Remove</button>
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
                                    className={`text-[10px] px-2 py-0.5 rounded border ${active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-700'}`}
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
          {event.games.nassau.length===0 && (
            <div className="text-[10px] text-gray-500">No Nassau games added.</div>
          )}
        </div>
      </section>
      <section>
        <h2 className="font-semibold mb-2">Skins (event)</h2>
        <div className="flex gap-2 mb-3">
          <button
            className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white font-medium shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={()=> addSkins(false)}
          >Add Gross</button>
          <button
            className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white font-medium shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
            onClick={()=> addSkins(true)}
          >Add Net</button>
        </div>
        <div className="grid gap-3 max-w-lg">
          {skinsArray.map((sk:any, i:number) => (
            <div key={sk.id} className="border rounded p-3 bg-white shadow-sm text-[11px] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">Skins #{i+1}</span>
                  <span className="text-[10px] px-1 rounded bg-primary-100 text-primary-700">{sk.net ? 'Net' : 'Gross'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">Fee
                    <input className="border rounded px-1 py-0.5 w-20" type="number" value={sk.fee} onChange={e => {
                      updateEvent(eventId, { games: { ...event.games, skins: skinsArray.map((s:any)=> s.id===sk.id? { ...s, fee: Number(e.target.value)}: s) } });
                    }} />
                  </label>
                  <label className="flex items-center gap-1">Net
                    <input type="checkbox" checked={sk.net} onChange={e => updateEvent(eventId, { games: { ...event.games, skins: skinsArray.map((s:any)=> s.id===sk.id? { ...s, net: e.target.checked}: s) } })} />
                  </label>
                  <button type="button" onClick={()=> removeSkins(sk.id)} className="text-[10px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600">Remove</button>
                </div>
              </div>
            </div>
          ))}
          {skinsArray.length===0 && (
            <div className="text-[10px] text-gray-500">No skins games added.</div>
          )}
        </div>
      </section>
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
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='assign'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'assign'}:s)} /> Assign to Team</label>
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='roundRobin'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'roundRobin'}:s)} /> Even Round-Robin</label>
                {bulkAssignState.mode==='assign' && (
                  <select className="border rounded px-1 py-0.5" value={bulkAssignState.teamId || ''} onChange={e => setBulkAssignState(s=> s?{...s, teamId: e.target.value || undefined}:s)}>
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
                    <label key={gg.id} className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${sel ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-700'}`}>
                      <input type="checkbox" className="hidden" checked={sel} onChange={()=> toggleSelect(gg.id)} />
                      <span className="truncate">{gg.name}</span>
                      {gg.handicapIndex != null && <span className="text-[9px] opacity-70">({gg.handicapIndex})</span>}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between items-center">
                <div className="text-[10px] text-gray-500">{bulkAssignState.selected.size} selected</div>
                <div className="flex gap-2">
                  <button disabled={bulkAssignState.selected.size===0 || (bulkAssignState.mode==='assign' && !bulkAssignState.teamId)} onClick={()=> commitBulkAssign(nassau, activeGolfers)} className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white disabled:opacity-40">Apply</button>
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
