import { Event, WolfConfig, WolfHoleResult } from '../state/store';

export interface WolfSummary {
  configId: string;
  feePerPoint: number;
  wolfOrder: string[];
  holeResults: WolfHoleResult[];
  /** Running point totals per golfer (can be negative) */
  pointsByGolfer: Record<string, number>;
  /** Net owings based on point differences × fee */
  owingsByGolfer: Record<string, number>;
}

/**
 * Wolf
 * 
 * 4-player game with rotating wolf:
 * - Wolf tees last in rotation (1,2,3,4,1,2,3,4...)
 * - After seeing drives, wolf picks a partner (2v2) or goes Lone Wolf (1v3)
 * - Normal partner win = 1 point each
 * - Lone Wolf win = 3 points (3x)
 * - Lone Wolf loss = -1 per opponent (-3 total)
 * - Blind Wolf (declare before seeing drives) = 4x multiplier
 * 
 * Points × fee = payout. Net settlement between players.
 */
export function computeWolf(
  event: Event,
  config: WolfConfig,
  holeResults: WolfHoleResult[]
): WolfSummary | null {
  const players = config.participantGolferIds || config.wolfOrder || [];
  if (players.length !== 4) return null;
  
  const wolfOrder = config.wolfOrder || players;
  const feePerPoint = config.fee;
  const pointsByGolfer: Record<string, number> = {};
  const owingsByGolfer: Record<string, number> = {};

  players.forEach((p: string) => {
    pointsByGolfer[p] = 0;
    owingsByGolfer[p] = 0;
  });

  // Process each hole result
  holeResults.forEach(hr => {
    const wolf = hr.wolfId;
    const partner = hr.partnerId;
    const isLone = hr.isLoneWolf;
    const isBlind = hr.isBlindWolf || false;
    const wolfWon = hr.winner === 'wolf';
    
    // Multiplier: Blind Wolf = 4x, Lone Wolf = 3x, Normal = 1x
    const multiplier = isBlind ? 4 : (isLone ? 3 : 1);

    if (isLone) {
      // Lone wolf vs 3 opponents
      const opponents = players.filter((p: string) => p !== wolf);
      if (wolfWon) {
        // Wolf wins multiplier points from each opponent
        pointsByGolfer[wolf] += multiplier * opponents.length;
        opponents.forEach((opp: string) => {
          pointsByGolfer[opp] -= multiplier;
        });
      } else {
        // Wolf loses multiplier points to each opponent
        pointsByGolfer[wolf] -= multiplier * opponents.length;
        opponents.forEach((opp: string) => {
          pointsByGolfer[opp] += multiplier;
        });
      }
    } else if (partner) {
      // 2v2: wolf + partner vs field
      const wolfSide = [wolf, partner];
      const fieldSide = players.filter((p: string) => !wolfSide.includes(p));
      
      if (wolfWon) {
        wolfSide.forEach((p: string) => { pointsByGolfer[p] += multiplier; });
        fieldSide.forEach((p: string) => { pointsByGolfer[p] -= multiplier; });
      } else {
        wolfSide.forEach((p: string) => { pointsByGolfer[p] -= multiplier; });
        fieldSide.forEach((p: string) => { pointsByGolfer[p] += multiplier; });
      }
    }
  });

  // Net owings: each pair settles point difference × fee
  players.forEach((p: string) => {
    const others = players.filter((x: string) => x !== p);
    let net = 0;
    others.forEach((opp: string) => {
      net += (pointsByGolfer[p] - pointsByGolfer[opp]) * feePerPoint;
    });
    owingsByGolfer[p] = net;
  });

  return {
    configId: config.id,
    feePerPoint,
    wolfOrder,
    holeResults,
    pointsByGolfer,
    owingsByGolfer,
  };
}

export function computeAllWolf(
  event: Event,
  allResults: Record<string, WolfHoleResult[]>
): WolfSummary[] {
  return (event.games.wolf || [])
    .map(cfg => {
      const results = allResults[cfg.id] || [];
      return computeWolf(event, cfg, results);
    })
    .filter((r): r is WolfSummary => !!r);
}
