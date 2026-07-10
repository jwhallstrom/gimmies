import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useStore from '../state/store';
import { formatHandicapIndex } from '../utils/handicap';

type Props = { eventId: string };

type Team = { id: string; name: string; golferIds: string[] };

// Team colors for visual differentiation
const TEAM_COLORS = [
  { bg: 'bg-blue-500', bgLight: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', pill: 'bg-blue-500 text-white border-blue-600', ring: 'ring-blue-400' },
  { bg: 'bg-red-500', bgLight: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', pill: 'bg-red-500 text-white border-red-600', ring: 'ring-red-400' },
  { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-500 text-white border-emerald-600', ring: 'ring-emerald-400' },
  { bg: 'bg-purple-500', bgLight: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', pill: 'bg-purple-500 text-white border-purple-600', ring: 'ring-purple-400' },
];

const NassauTeamsPage: React.FC<Props> = ({ eventId }) => {
  const navigate = useNavigate();
  const params = useParams();
  const nassauId = params.nassauId as string | undefined;

  const event = useStore((s: any) => s.events.find((e: any) => e.id === eventId) || s.completedEvents.find((e: any) => e.id === eventId));
  const profiles = useStore((s: any) => s.profiles);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const updateEvent = useStore((s: any) => s.updateEvent);

  if (!event || !nassauId) return null;

  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);
  const nassau = event.games?.nassau?.find((n: any) => n.id === nassauId);
  if (!nassau) return <div className="text-sm text-red-600">Nassau not found.</div>;

  const updateCfg = (patch: any) =>
    updateEvent(eventId, {
      games: { ...event.games, nassau: event.games.nassau.map((x: any) => (x.id === nassau.id ? { ...x, ...patch } : x)) },
    });

  const golfers = useMemo(() => {
    return (event.golfers || []).map((g: any) => {
      const profile = g.profileId ? profiles.find((p: any) => p.id === g.profileId) : null;
      const name = profile?.name || g.displayName || g.customName || 'Player';
      const id = g.profileId || g.customName || g.displayName;
      const handicapIndex = profile?.handicapIndex ?? g.handicapSnapshot ?? null;
      return { id, name, handicapIndex };
    }).filter((x: any) => !!x.id);
  }, [eventId, event.golfers, profiles]);

  const eligibleIds = new Set<string>(
    (event.golfers || [])
      .map((g: any) => g.profileId || g.customName || g.displayName)
      .filter((id: any) => !!id)
      .filter((gid: string) => {
        const eg = (event.golfers || []).find((x: any) => (x.profileId || x.customName || x.displayName) === gid);
        const pref: 'all' | 'nassau' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
        return pref === 'all' || pref === 'nassau';
      })
  );

  // Always show ALL eligible event golfers on the Pick Teams page.
  // participantGolferIds is a snapshot from when the Nassau was created and may
  // be stale — new players who joined the event after game setup would be missing.
  const participantIds: string[] = golfers
    .map((g: any) => g.id)
    .filter((id: string) => eligibleIds.has(id));

  const activeGolfers = golfers.filter((g: any) => participantIds.includes(g.id));

  const teams: Team[] = Array.isArray(nassau.teams) ? nassau.teams : [];
  const sanitizedTeams: Team[] = useMemo(() => {
    const allowed = new Set(participantIds);
    return teams.map((t) => ({ ...t, golferIds: (t.golferIds || []).filter((gid) => allowed.has(gid)) }));
  }, [teams, participantIds.join('|')]);

  useEffect(() => {
    if (!isOwner || event.isCompleted) return;
    const changed = teams.some((t, idx) => {
      const a = (t.golferIds || []).join('|');
      const b = (sanitizedTeams[idx]?.golferIds || []).join('|');
      return a !== b;
    });
    if (changed) updateCfg({ teams: sanitizedTeams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, event.isCompleted, participantIds.join('|')]);

  const teamCount = Math.max(2, Math.min(4, teams.length || 2));

  const suggestedTeamCount = useMemo(() => {
    const pc = activeGolfers.length;
    if (pc <= 4) return 2;
    if (pc <= 8) return 2;
    if (pc <= 12) return 3;
    if (pc <= 16) return 4;
    return 4;
  }, [activeGolfers.length]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => teams[0]?.id || 'T1');
  const [showDoneConfirm, setShowDoneConfirm] = useState(false);

  const ensureTeamCount = (count: number) => {
    const next: Team[] = [...teams];
    while (next.length < count) next.push({ id: 'T' + (next.length + 1), name: 'Team ' + (next.length + 1), golferIds: [] });
    while (next.length > count) next.pop();
    updateCfg({ teams: next });
    if (!next.some((t) => t.id === selectedTeamId)) setSelectedTeamId(next[0]?.id || 'T1');
  };

  const assigned = new Set<string>();
  sanitizedTeams.forEach((t) => (t.golferIds || []).forEach((gid) => assigned.add(gid)));
  const unassigned = activeGolfers.filter((g: any) => !assigned.has(g.id));
  const allAssigned = unassigned.length === 0 && activeGolfers.length > 0 && teams.length >= 2;

  const setTeamName = (teamId: string, name: string) => {
    updateCfg({ teams: teams.map((t) => (t.id === teamId ? { ...t, name } : t)) });
  };

  const toggleAssign = (golferId: string, teamId: string) => {
    const nextTeams = sanitizedTeams.map((t) => {
      const has = (t.golferIds || []).includes(golferId);
      if (t.id !== teamId && has) return { ...t, golferIds: t.golferIds.filter((id) => id !== golferId) };
      return t;
    }).map((t) => {
      if (t.id !== teamId) return t;
      const has = (t.golferIds || []).includes(golferId);
      return { ...t, golferIds: has ? t.golferIds.filter((id) => id !== golferId) : [...t.golferIds, golferId] };
    });
    updateCfg({ teams: nextTeams });
  };

  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const autoRandom = () => {
    const ids = shuffle(activeGolfers.map((g: any) => g.id));
    const next: Team[] = teams.map((t) => ({ ...t, golferIds: [] as string[] }));
    ids.forEach((gid, i) => next[i % next.length].golferIds.push(String(gid)));
    updateCfg({ teams: next });
  };

  const autoBalance = () => {
    const sorted = [...activeGolfers].sort((a: any, b: any) => (a.handicapIndex ?? 18) - (b.handicapIndex ?? 18));
    const next: Team[] = teams.map((t) => ({ ...t, golferIds: [] as string[] }));
    let direction = 1;
    let idx = 0;
    sorted.forEach((g: any) => {
      next[idx].golferIds.push(String(g.id));
      if (direction === 1) {
        if (idx === next.length - 1) direction = -1;
        else idx++;
      } else {
        if (idx === 0) direction = 1;
        else idx--;
      }
    });
    updateCfg({ teams: next });
  };

  const handleDone = () => {
    setShowDoneConfirm(true);
    setTimeout(() => {
      navigate(`/event/${eventId}`);
    }, 800);
  };

  // Get color for a team by index
  const getTeamColor = (teamIdx: number) => TEAM_COLORS[teamIdx % TEAM_COLORS.length];
  const selectedTeamIdx = teams.findIndex(t => t.id === selectedTeamId);
  const selectedColor = getTeamColor(selectedTeamIdx >= 0 ? selectedTeamIdx : 0);

  return (
    <div className="h-full overflow-y-auto space-y-4 max-w-3xl bg-white dark:bg-gray-900 -mx-4 -mt-4 px-4 pt-4 content-with-footer">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/event/${eventId}`)}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.15em] text-slate-500 dark:text-slate-400 uppercase">Nassau</div>
            <div className="font-extrabold text-gray-900 dark:text-white truncate">Pick Teams</div>
          </div>
        </div>

        {/* Done button */}
        {isOwner && (
          <button
            onClick={handleDone}
            disabled={!allAssigned}
            className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
              allAssigned
                ? 'bg-green-500 text-white shadow-lg hover:bg-green-600 active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {showDoneConfirm ? '✓ Saved!' : allAssigned ? 'Done' : `${unassigned.length} left`}
          </button>
        )}
      </div>

      {/* Not owner notice */}
      {!isOwner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
          Only the event admin can change teams.
        </div>
      )}

      {/* ===== STEP 1: TEAM COUNT ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">1</div>
            <div className="text-sm font-bold text-slate-800">How many teams?</div>
          </div>
          {activeGolfers.length >= 4 && (
            <div className="mt-1 ml-8 text-[11px] text-slate-500">
              {activeGolfers.length} players -- we suggest <span className="font-bold text-primary-700">{suggestedTeamCount} teams</span> (~{Math.ceil(activeGolfers.length / suggestedTeamCount)} per team)
            </div>
          )}
        </div>
        <div className="px-4 py-3 flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => ensureTeamCount(n)}
              disabled={!isOwner || event.isCompleted}
              className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold border-2 transition-all ${
                teamCount === n
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
              } disabled:opacity-50`}
            >
              {n} Teams
            </button>
          ))}
        </div>
      </div>

      {/* ===== STEP 2: ASSIGN PLAYERS ===== */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${
                allAssigned ? 'bg-green-500 text-white' : 'bg-slate-800 text-white'
              }`}>
                {allAssigned ? '✓' : '2'}
              </div>
              <div className="text-sm font-bold text-slate-800">Assign players to teams</div>
            </div>
            {unassigned.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {unassigned.length} left
              </span>
            )}
          </div>
          <div className="mt-1 ml-8 text-[11px] text-slate-500">
            {allAssigned
              ? 'All players assigned! You\'re good to go.'
              : 'Tap a team below, then tap players to add them.'}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Quick assign buttons */}
          {isOwner && activeGolfers.length >= 2 && teams.length >= 2 && !allAssigned && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={autoRandom}
                disabled={!isOwner || event.isCompleted}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Shuffle Random
              </button>
              <button
                type="button"
                onClick={autoBalance}
                disabled={!isOwner || event.isCompleted}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Balance by Handicap
              </button>
            </div>
          )}

          {/* Team cards with inline player assignment */}
          {teams.map((t, tIdx) => {
            const isSelected = t.id === selectedTeamId;
            const color = getTeamColor(tIdx);
            const members = (t.golferIds || []).map((gid) => activeGolfers.find((g: any) => g.id === gid)).filter(Boolean);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTeamId(t.id)}
                className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                  isSelected
                    ? `${color.bgLight} ${color.border} ring-2 ${color.ring} ring-offset-1`
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${color.bg}`} />
                    <input
                      value={t.name}
                      onChange={(e) => setTeamName(t.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!isOwner || event.isCompleted}
                      className="bg-transparent font-extrabold text-sm text-gray-900 outline-none max-w-[120px]"
                      aria-label="Team name"
                    />
                    {isSelected && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${color.bg} text-white`}>SELECTED</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-500">{t.golferIds.length} player{t.golferIds.length !== 1 ? 's' : ''}</span>
                </div>
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {members.map((g: any) => (
                      <span key={g.id} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color.pill}`}>
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
                {members.length === 0 && isSelected && (
                  <div className="mt-2 text-xs text-slate-400 italic">Tap players below to add them here</div>
                )}
              </button>
            );
          })}

          {teams.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">Choose a team count above to start.</div>
          )}

          {/* Player pills */}
          {teams.length >= 2 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-600 mb-2">
                {allAssigned ? 'All players assigned' : `Tap to add to ${teams.find(t => t.id === selectedTeamId)?.name || 'selected team'}`}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeGolfers.map((g: any) => {
                  const teamIdx = teams.findIndex((t) => (t.golferIds || []).includes(g.id));
                  const onTeam = teamIdx >= 0;
                  const teamColor = onTeam ? getTeamColor(teamIdx) : null;

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => selectedTeamId && toggleAssign(g.id, selectedTeamId)}
                      disabled={!isOwner || event.isCompleted || !selectedTeamId || teams.length < 2}
                      className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-all disabled:opacity-50 ${
                        onTeam
                          ? `${teamColor!.pill} ${teamColor!.border}`
                          : `bg-white text-slate-700 border-slate-300 border-dashed hover:border-slate-500 hover:bg-slate-50`
                      }`}
                      title={onTeam ? `On ${teams[teamIdx].name} — tap to move` : 'Tap to assign'}
                    >
                      {onTeam && <span className="mr-1">{teams[teamIdx]?.name?.charAt(0) || 'T'}</span>}
                      {g.name}
                      {g.handicapIndex != null && (
                        <span className={`ml-1 ${onTeam ? 'opacity-80' : 'text-slate-400'}`}>
                          ({formatHandicapIndex(g.handicapIndex)})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== SETTINGS (collapsible) ===== */}
      <details open className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between hover:bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-sm">&#9881;</span>
            <span className="text-sm font-bold text-slate-700">Game Rules</span>
          </div>
          <svg className="w-4 h-4 text-slate-400 transition-transform details-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
          {/* Scores Count */}
          {(() => {
            const maxTeamSize = Math.max(...teams.map(t => t.golferIds?.length || 0), 1);
            const currentBestCount = nassau.teamBestCount || 1;
            const options = Array.from({ length: Math.max(maxTeamSize, 4) }, (_, i) => i + 1);

            return (
              <div>
                <div className="text-xs font-bold text-slate-700 mb-1">Scores Count</div>
                <div className="text-[11px] text-slate-500 mb-2">How many scores count per hole, per team.</div>
                <div className="flex gap-2 flex-wrap">
                  {options.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateCfg({ teamBestCount: n })}
                      disabled={!isOwner || event.isCompleted}
                      className={`px-3 py-2 rounded-lg text-xs font-extrabold border-2 ${
                        currentBestCount === n
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      } disabled:opacity-50`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  {currentBestCount === 1
                    ? 'Best ball: Only the best score from each team counts per hole.'
                    : `Best ${currentBestCount}: The ${currentBestCount} lowest scores from each team are added per hole.`}
                  {maxTeamSize > 0 && maxTeamSize < currentBestCount && (
                    <span className="text-amber-600 font-medium ml-1">
                      (Teams need at least {currentBestCount} players)
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Scoring Type */}
          {teamCount === 2 && (
            <div>
              <div className="text-xs font-bold text-slate-700 mb-1">Scoring Type</div>
              <div className="text-[11px] text-slate-500 mb-2">How to determine winners for each segment.</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateCfg({ scoringType: 'stroke' })}
                  disabled={!isOwner || event.isCompleted}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold border-2 ${
                    (!nassau.scoringType || nassau.scoringType === 'stroke')
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  } disabled:opacity-50`}
                >
                  Stroke
                </button>
                <button
                  type="button"
                  onClick={() => updateCfg({ scoringType: 'match' })}
                  disabled={!isOwner || event.isCompleted}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold border-2 ${
                    nassau.scoringType === 'match'
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  } disabled:opacity-50`}
                >
                  Match
                </button>
              </div>
              <div className="mt-1.5 text-[11px] text-slate-500">
                {(!nassau.scoringType || nassau.scoringType === 'stroke')
                  ? 'Stroke: Lowest total strokes wins each segment.'
                  : 'Match: Teams compete hole-by-hole. Most holes won takes the segment.'}
              </div>
            </div>
          )}

          {/* Advanced */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1">Advanced</div>
            <button
              type="button"
              onClick={() => updateCfg({ allowGolferTeamSelect: !nassau.allowGolferTeamSelect })}
              disabled={!isOwner || event.isCompleted}
              className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Allow golfers to pick team: <span className={nassau.allowGolferTeamSelect ? 'text-green-600' : 'text-slate-500'}>{nassau.allowGolferTeamSelect ? 'On' : 'Off'}</span>
            </button>
            <div className="mt-1.5 text-[11px] text-slate-500">
              If enabled, players will eventually be able to join a team themselves.
            </div>
          </div>
        </div>
      </details>

      {/* ===== DONE / SUCCESS FOOTER ===== */}
      {isOwner && (
        <div className={`rounded-2xl p-4 text-center transition-all ${
          allAssigned
            ? 'bg-green-50 border-2 border-green-200'
            : 'bg-slate-50 border border-slate-200'
        }`}>
          {allAssigned ? (
            <>
              <div className="text-2xl mb-1">&#127942;</div>
              <div className="font-extrabold text-green-700">Teams are set!</div>
              <div className="text-xs text-green-600 mt-0.5">All {activeGolfers.length} players assigned to {teams.length} teams.</div>
              <button
                onClick={handleDone}
                className="mt-3 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-extrabold text-sm shadow-lg active:scale-95 transition-all"
              >
                {showDoneConfirm ? '✓ Saved!' : 'Done — Back to Event'}
              </button>
            </>
          ) : (
            <>
              <div className="font-bold text-slate-500">
                {unassigned.length} player{unassigned.length !== 1 ? 's' : ''} still need{unassigned.length === 1 ? 's' : ''} a team
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Assign everyone to enable Done.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NassauTeamsPage;
