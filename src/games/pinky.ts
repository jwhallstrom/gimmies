import { Event, PinkyConfig, PinkyResult } from '../state/store';

export interface PinkySummary {
  configId: string;
  feePerPinky: number;
  results: PinkyResult[];
  owingsByGolfer: Record<string, number>; // positive = owe others, negative = others owe you
}

/**
 * Compute Pinky payouts for a given configuration
 * 
 * Pinky Game Rules:
 * - At the end of the round, each player declares how many "pinkys" they had
 * - For each pinky, the player owes each other participating player the fee amount
 * - Example: If Player A has 2 pinkys with $1 fee and 3 other players:
 *   Player A owes: 2 pinkys × $1 × 3 players = $6 total (-$6)
 *   Each other player receives: 2 × $1 = $2 (+$2 each)
 */
export function computePinky(event: Event, config: PinkyConfig, pinkyResults: PinkyResult[]): PinkySummary | null {
  // Get all participants
  const prefFor = (gid: string): 'all' | 'skins' | 'none' => {
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
  
  // Initialize owings for all players
  const owingsByGolfer: Record<string, number> = {};
  players.forEach(p => { owingsByGolfer[p] = 0; });
  
  // Filter results to only include participating players
  const validResults = pinkyResults.filter(r => players.includes(r.golferId));
  
  // Calculate owings/winnings
  validResults.forEach(result => {
    if (result.count > 0) {
      const otherPlayers = players.filter(p => p !== result.golferId);
      const totalOwed = result.count * config.fee * otherPlayers.length;
      
      // This player owes (negative amount)
      owingsByGolfer[result.golferId] -= totalOwed;
      
      // Each other player receives their share (positive amount)
      const perPlayer = result.count * config.fee;
      otherPlayers.forEach(p => {
        owingsByGolfer[p] += perPlayer;
      });
    }
  });
  
  return {
    configId: config.id,
    feePerPinky: config.fee,
    results: validResults,
    owingsByGolfer
  };
}

export function computeAllPinky(event: Event, allPinkyResults: Record<string, PinkyResult[]>): PinkySummary[] {
  return (event.games.pinky || [])
    .map(cfg => {
      const results = allPinkyResults[cfg.id] || [];
      return computePinky(event, cfg, results);
    })
    .filter((r): r is PinkySummary => !!r);
}
