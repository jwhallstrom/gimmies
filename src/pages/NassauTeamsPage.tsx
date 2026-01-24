import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useStore from '../state/store';

type Props = { eventId: string };

type Team = { id: string; name: string; golferIds: string[] };

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
        const pref: 'all' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
        return pref === 'all'; // Nassau is "all games" only
      })
  );

  const participantIds: string[] = (() => {
    const base = golfers.map((g: any) => g.id).filter((id: string) => eligibleIds.has(id));
    if (nassau.participantGolferIds && nassau.participantGolferIds.length > 1) {
      return base.filter((id: string) => nassau.participantGolferIds.includes(id));
    }
    return base;
  })();

  const activeGolfers = golfers.filter((g: any) => participantIds.includes(g.id));

  const teams: Team[] = Array.isArray(nassau.teams) ? nassau.teams : [];
  const sanitizedTeams: Team[] = useMemo(() => {
    const allowed = new Set(participantIds);
    return teams.map((t) => ({ ...t, golferIds: (t.golferIds || []).filter((gid) => allowed.has(gid)) }));
  }, [teams, participantIds.join('|')]);

  // If preferences changed and some ineligible golfers were on teams, clean it up (admin only).
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

  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => teams[0]?.id || 'T1');

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

  const setTeamName = (teamId: string, name: string) => {
    updateCfg({ teams: teams.map((t) => (t.id === teamId ? { ...t, name } : t)) });
  };

  const toggleAssign = (golferId: string, teamId: string) => {
    const nextTeams = sanitizedTeams.map((t) => {
      const has = (t.golferIds || []).includes(golferId);
      // remove from all other teams
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

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/event/${eventId}/games`)}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
          title="Back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">Nassau teams</div>
          <div className="font-extrabold text-gray-900 truncate">Pick teams</div>
        </div>
      </div>

      {!isOwner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
          Only the event admin can change teams.
        </div>
      )}

      {isOwner && unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          {unassigned.length} player{unassigned.length !== 1 ? 's are' : ' is'} unassigned. Assign everyone before you start.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-700">Number of teams</div>
            <div className="text-[11px] text-slate-500">Tap 2, 3, or 4 teams.</div>
          </div>
          <div className="flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => ensureTeamCount(n)}
                disabled={!isOwner || event.isCompleted}
                className={`px-3 py-2 rounded-lg text-xs font-extrabold border ${
                  teamCount === n ? 'bg-primary-600 text-white border-primary-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                } disabled:opacity-50`}
              >
                {n} teams
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <details className="w-full">
            <summary className="cursor-pointer select-none text-xs font-extrabold text-primary-800">
              Auto-pick teams
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={autoRandom}
                disabled={!isOwner || event.isCompleted || teams.length < 2}
                className="px-3 py-2 rounded-lg text-xs font-extrabold border border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 disabled:opacity-50"
              >
                Random
              </button>
              <button
                type="button"
                onClick={autoBalance}
                disabled={!isOwner || event.isCompleted || teams.length < 2}
                className="px-3 py-2 rounded-lg text-xs font-extrabold border border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 disabled:opacity-50"
              >
                Balanced (by handicap)
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              “Balanced” tries to spread low handicaps across teams.
            </div>
          </details>

          {/* Keep this advanced toggle but hide it from the main path for now */}
          <details className="w-full">
            <summary className="cursor-pointer select-none text-[11px] font-bold text-slate-600">
              Advanced
            </summary>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => updateCfg({ allowGolferTeamSelect: !nassau.allowGolferTeamSelect })}
                disabled={!isOwner || event.isCompleted}
                className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
                title="Store the preference for future"
              >
                Allow golfers to pick team: {nassau.allowGolferTeamSelect ? 'On' : 'Off'}
              </button>
              <div className="mt-2 text-[11px] text-slate-500">
                If enabled, players will eventually be able to join a team themselves.
              </div>
            </div>
          </details>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-700 mb-2">Teams</div>
          <div className="space-y-2">
            {teams.map((t) => {
              const isSelected = t.id === selectedTeamId;
              const members = (t.golferIds || []).map((gid) => activeGolfers.find((g: any) => g.id === gid)?.name || gid);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    isSelected ? 'bg-primary-50 border-primary-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        value={t.name}
                        onChange={(e) => setTeamName(t.id, e.target.value)}
                        disabled={!isOwner || event.isCompleted}
                        className="w-full bg-transparent font-extrabold text-sm text-gray-900 outline-none"
                        aria-label="Team name"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        {members.length ? members.join(', ') : 'No players yet'}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-600">{t.golferIds.length}</div>
                  </div>
                </button>
              );
            })}
            {teams.length === 0 && (
              <div className="text-sm text-slate-500">Pick a team count to start.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-700 mb-2">Players</div>
          <div className="text-[11px] text-slate-500 mb-2">
            Select a team, then tap players to assign.
          </div>
          <div className="flex flex-wrap gap-2">
            {activeGolfers.map((g: any) => {
              const currentTeam = teams.find((t) => (t.golferIds || []).includes(g.id));
              const selected = Boolean(currentTeam);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectedTeamId && toggleAssign(g.id, selectedTeamId)}
                  disabled={!isOwner || event.isCompleted || !selectedTeamId || teams.length < 2}
                  className={`px-3 py-2 rounded-full border text-xs font-bold transition-colors disabled:opacity-50 ${
                    selected ? 'bg-primary-600 text-white border-primary-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={currentTeam ? `Assigned to ${currentTeam.name}` : 'Unassigned'}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NassauTeamsPage;

