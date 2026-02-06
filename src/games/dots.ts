import { Event, DotsConfig, DotsPlayerResult, DotCategory } from '../state/store';

/** Human-readable labels and whether the dot is a penalty (negative) */
export const DOT_DEFINITIONS: Record<DotCategory, { label: string; emoji: string; penalty: boolean; description: string }> = {
  birdie:         { label: 'Birdie',          emoji: '🐦', penalty: false, description: 'Made a birdie' },
  eagle:          { label: 'Eagle',           emoji: '🦅', penalty: false, description: 'Made an eagle' },
  sandie:         { label: 'Sandie',          emoji: '🏖️', penalty: false, description: 'Up-and-down from bunker' },
  greenie:        { label: 'Greenie',         emoji: '🟢', penalty: false, description: 'Hit green in regulation' },
  chipin:         { label: 'Chip-In',         emoji: '🎯', penalty: false, description: 'Chipped in from off the green' },
  longestdrive:   { label: 'Longest Drive',   emoji: '💪', penalty: false, description: 'Longest drive on designated holes' },
  closestpin:     { label: 'Closest to Pin',  emoji: '📍', penalty: false, description: 'Closest to pin on par 3s' },
  poley:          { label: 'Poley',           emoji: '🕳️', penalty: false, description: 'One-putt (holed a long putt)' },
  natural_birdie: { label: 'Natural Birdie',  emoji: '⭐', penalty: false, description: 'Birdie without handicap strokes' },
  par3_birdie:    { label: 'Par 3 Birdie',    emoji: '🎯', penalty: false, description: 'Birdie on a par 3' },
  threejack:      { label: '3-Putt',          emoji: '😬', penalty: true,  description: '3-putt (penalty dot)' },
  waterball:      { label: 'Water Ball',      emoji: '💧', penalty: true,  description: 'Hit into water (penalty dot)' },
};

/** Default popular dot selection for quick setup */
export const DEFAULT_DOTS: DotCategory[] = ['birdie', 'sandie', 'chipin', 'closestpin', 'threejack', 'waterball'];

export interface DotsSummary {
  configId: string;
  feePerDot: number;
  activeDots: DotCategory[];
  playerResults: DotsPlayerResult[];
  /** Net owings: point difference × fee (peer-to-peer) */
  owingsByGolfer: Record<string, number>;
}

/**
 * Dots / Garbage / Junk
 * 
 * Collection of small side bets. Each active "dot" category awards +1 or -1.
 * At the end, total dot differences × fee = payout between each pair.
 * 
 * Manually entered: admin/players record which dots each player earned.
 */
export function computeDots(
  event: Event,
  config: DotsConfig,
  playerResults: DotsPlayerResult[]
): DotsSummary | null {
  const prefFor = (gid: string): 'all' | 'nassau' | 'skins' | 'none' => {
    const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
    return (eg?.gamePreference as any) || 'all';
  };
  const eligible = (gid: string) => prefFor(gid) === 'all';

  let players = event.golfers
    .map((g: any) => g.profileId || g.customName || g.displayName)
    .filter((id: any): id is string => id !== undefined && id !== null && id !== '')
    .filter(eligible);
  if (config.participantGolferIds && config.participantGolferIds.length > 1) {
    players = players.filter(p => config.participantGolferIds!.includes(p));
  }
  if (players.length < 2) return null;

  const owingsByGolfer: Record<string, number> = {};
  players.forEach(p => { owingsByGolfer[p] = 0; });

  // Build a lookup of total dots per player
  const dotsMap: Record<string, number> = {};
  players.forEach(p => { dotsMap[p] = 0; });

  const validResults = playerResults.filter(r => players.includes(r.golferId));
  validResults.forEach(r => {
    dotsMap[r.golferId] = r.totalDots;
  });

  // Net owings: each pair settles the dot difference × fee
  players.forEach(p => {
    const others = players.filter(x => x !== p);
    let net = 0;
    others.forEach(opp => {
      net += (dotsMap[p] - dotsMap[opp]) * config.fee;
    });
    owingsByGolfer[p] = net;
  });

  return {
    configId: config.id,
    feePerDot: config.fee,
    activeDots: config.activeDots,
    playerResults: validResults,
    owingsByGolfer,
  };
}

export function computeAllDots(
  event: Event,
  allResults: Record<string, DotsPlayerResult[]>
): DotsSummary[] {
  return (event.games.dots || [])
    .map(cfg => {
      const results = allResults[cfg.id] || [];
      return computeDots(event, cfg, results);
    })
    .filter((r): r is DotsSummary => !!r);
}
