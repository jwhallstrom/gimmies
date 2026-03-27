import { Event } from '../state/store';

type PreferenceGame = 'nassau' | 'skins' | 'stableford' | 'ninePoint' | 'bingoBangoBongo' | 'wolf' | 'dots' | 'pinky' | 'greenie';

const NASSAU_PREF_GAMES = new Set<PreferenceGame>([
  'nassau',
  'stableford',
  'ninePoint',
  'bingoBangoBongo',
  'wolf',
  'dots',
  'pinky',
  'greenie',
]);

export function getEventGolferIds(event: Event): string[] {
  return (event.golfers || [])
    .map((g: any) => g.profileId || g.customName || g.displayName)
    .filter((id: any): id is string => typeof id === 'string' && id.length > 0);
}

export function getParticipantsForConfig(
  event: Event,
  config: {
    participantGolferIds?: string[];
    groupId?: string;
    teams?: Array<{ golferIds?: string[] }>;
  },
  game: PreferenceGame,
  options?: {
    restrictToGroup?: boolean;
    assignedTeamsOnly?: boolean;
  }
): string[] {
  const eventGolferIds = getEventGolferIds(event);
  const eventGolferIdSet = new Set(eventGolferIds);
  const groupGolferIds = options?.restrictToGroup && config.groupId
    ? (event.groups.find((g: any) => g.id === config.groupId)?.golferIds || []).filter((id: string) => eventGolferIdSet.has(id))
    : eventGolferIds;

  let participants =
    Array.isArray(config.participantGolferIds) && config.participantGolferIds.length > 0
      ? config.participantGolferIds.filter((id) => eventGolferIdSet.has(id))
      : groupGolferIds.filter((id) => matchesGamePreference(event, id, game));

  if (options?.restrictToGroup) {
    const groupIdSet = new Set(groupGolferIds);
    participants = participants.filter((id) => groupIdSet.has(id));
  }

  if (options?.assignedTeamsOnly && Array.isArray(config.teams) && config.teams.length > 0) {
    const assignedIds = new Set<string>();
    config.teams.forEach((team) => {
      (team.golferIds || []).forEach((id) => {
        if (eventGolferIdSet.has(id)) assignedIds.add(id);
      });
    });
    participants = participants.filter((id) => assignedIds.has(id));
  }

  return Array.from(new Set(participants));
}

function matchesGamePreference(event: Event, golferId: string, game: PreferenceGame): boolean {
  const eventGolfer = (event.golfers || []).find((g: any) => (g.profileId || g.customName || g.displayName) === golferId);
  const pref: 'all' | 'nassau' | 'skins' | 'none' = (eventGolfer?.gamePreference as any) || 'all';

  if (pref === 'none') return false;
  if (game === 'skins') return pref === 'all' || pref === 'skins';
  if (NASSAU_PREF_GAMES.has(game)) return pref === 'all' || pref === 'nassau';
  return pref === 'all';
}
