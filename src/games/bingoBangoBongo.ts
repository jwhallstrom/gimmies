import { Event, BingoBangoBongoConfig, BingoBangoBongoHoleResult } from '../state/store';

export interface BingoBangoBongoSummary {
  configId: string;
  feePerPoint: number;
  holeResults: BingoBangoBongoHoleResult[];
  /** Points per category per golfer */
  bingoCount: Record<string, number>;  // First on green
  bangoCount: Record<string, number>;  // Closest to pin (all on green)
  bongoCount: Record<string, number>;  // First to hole out
  totalPoints: Record<string, number>; // Total across all categories
  /** Net owings (peer-to-peer based on point difference × fee) */
  owingsByGolfer: Record<string, number>;
}

/**
 * Bingo Bango Bongo
 * 
 * 3 points available every hole:
 * - Bingo: First player to get ball on the green
 * - Bango: Closest to pin once ALL balls are on green
 * - Bongo: First player to hole out
 * 
 * One player can sweep all 3 (rare & exciting).
 * Points × fee = payout. Net settlement between players.
 */
export function computeBingoBangoBongo(
  event: Event,
  config: BingoBangoBongoConfig,
  holeResults: BingoBangoBongoHoleResult[]
): BingoBangoBongoSummary | null {
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

  const bingoCount: Record<string, number> = {};
  const bangoCount: Record<string, number> = {};
  const bongoCount: Record<string, number> = {};
  const totalPoints: Record<string, number> = {};
  const owingsByGolfer: Record<string, number> = {};

  players.forEach(p => {
    bingoCount[p] = 0;
    bangoCount[p] = 0;
    bongoCount[p] = 0;
    totalPoints[p] = 0;
    owingsByGolfer[p] = 0;
  });

  // Tally results
  holeResults.forEach(hr => {
    if (hr.bingo && players.includes(hr.bingo)) {
      bingoCount[hr.bingo]++;
      totalPoints[hr.bingo]++;
    }
    if (hr.bango && players.includes(hr.bango)) {
      bangoCount[hr.bango]++;
      totalPoints[hr.bango]++;
    }
    if (hr.bongo && players.includes(hr.bongo)) {
      bongoCount[hr.bongo]++;
      totalPoints[hr.bongo]++;
    }
  });

  // Net owings: each pair settles point difference × fee
  players.forEach(p => {
    const others = players.filter(x => x !== p);
    let net = 0;
    others.forEach(opp => {
      net += (totalPoints[p] - totalPoints[opp]) * config.fee;
    });
    owingsByGolfer[p] = net;
  });

  return {
    configId: config.id,
    feePerPoint: config.fee,
    holeResults,
    bingoCount,
    bangoCount,
    bongoCount,
    totalPoints,
    owingsByGolfer,
  };
}

export function computeAllBingoBangoBongo(
  event: Event,
  allResults: Record<string, BingoBangoBongoHoleResult[]>
): BingoBangoBongoSummary[] {
  return (event.games.bingoBangoBongo || [])
    .map(cfg => {
      const results = allResults[cfg.id] || [];
      return computeBingoBangoBongo(event, cfg, results);
    })
    .filter((r): r is BingoBangoBongoSummary => !!r);
}
