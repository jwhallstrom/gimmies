import { Event, GreenieConfig, GreenieResult } from '../state/store';

export interface GreenieSummary {
  configId: string;
  feePerGreenie: number;
  results: GreenieResult[];
  owingsByGolfer: Record<string, number>; // positive = owe others, negative = others owe you
}

/**
 * Compute Greenie payouts for a given configuration
 * 
 * Greenie Game Rules:
 * - At the end of the round, each player declares how many "greenies" they had
 * - For each greenie, ALL OTHER participating players owe that player the fee amount
 * - Example: If Player A has 2 greenies with $1 fee and 3 other players:
 *   Player A receives: 2 greenies × $1 × 3 players = $6 total (+$6)
 *   Each other player owes: 2 × $1 = $2 (-$2 each)
 */
export function computeGreenie(event: Event, config: GreenieConfig, greenieResults: GreenieResult[]): GreenieSummary | null {
  // Get all participants
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
  
  // Initialize owings for all players
  const owingsByGolfer: Record<string, number> = {};
  players.forEach(p => { owingsByGolfer[p] = 0; });
  
  // Filter results to only include participating players
  const validResults = greenieResults.filter(r => players.includes(r.golferId));
  
  // Calculate owings/winnings (OPPOSITE of Pinky - greenies are good!)
  validResults.forEach(result => {
    if (result.count > 0) {
      const otherPlayers = players.filter(p => p !== result.golferId);
      const totalReceived = result.count * config.fee * otherPlayers.length;
      
      // This player RECEIVES (positive amount - they did well!)
      owingsByGolfer[result.golferId] += totalReceived;
      
      // Each other player OWES their share (negative amount)
      const perPlayer = result.count * config.fee;
      otherPlayers.forEach(p => {
        owingsByGolfer[p] -= perPlayer;
      });
    }
  });
  
  return {
    configId: config.id,
    feePerGreenie: config.fee,
    results: validResults,
    owingsByGolfer
  };
}

export function computeAllGreenie(event: Event, allGreenieResults: Record<string, GreenieResult[]>): GreenieSummary[] {
  return (event.games.greenie || [])
    .map(cfg => {
      const results = allGreenieResults[cfg.id] || [];
      return computeGreenie(event, cfg, results);
    })
    .filter((r): r is GreenieSummary => !!r);
}
