import { Event, NinePointConfig } from '../state/store';
import { netScore } from './handicap';

export interface NinePointHoleResult {
  hole: number;
  /** Distribution of points per player: golferId -> points (always sums to 9) */
  distribution: Record<string, number>;
  /** Score used for each player this hole */
  scores: Record<string, number | null>;
}

export interface NinePointSummary {
  configId: string;
  feePerPoint: number;
  totalPointsPerHole: 9;
  holeResults: NinePointHoleResult[];
  /** Running total points per golfer (max 162 over 18 holes) */
  pointsByGolfer: Record<string, number>;
  /** Net owings between players (based on point differences × fee) */
  owingsByGolfer: Record<string, number>;
}

/**
 * 9-Point (Nines / 5-3-1)
 * 
 * Rules:
 * - Strictly 3 players, every hole distributes exactly 9 points
 * - Standard: Low=5, Mid=3, High=1
 * - All three tie: 3-3-3
 * - Two tie for low: 4-4-1
 * - Two tie for high: 5-2-2
 * - Sweep variant: if one player beats others by 2+, they take all 9
 * 
 * Payout: difference in total points × fee per point.
 */
export function computeNinePoint(event: Event, config: NinePointConfig, profiles: any[]): NinePointSummary | null {
  let players = config.participantGolferIds || [];
  if (players.length === 0) {
    players = event.golfers
      .map((g: any) => g.profileId || g.customName || g.displayName)
      .filter((id: any): id is string => id !== undefined && id !== null && id !== '');
  }
  
  // Must be exactly 3 players
  if (players.length !== 3) return null;

  const feePerPoint = config.fee;
  const holeResults: NinePointHoleResult[] = [];
  const pointsByGolfer: Record<string, number> = {};
  const owingsByGolfer: Record<string, number> = {};
  
  players.forEach(p => {
    pointsByGolfer[p] = 0;
    owingsByGolfer[p] = 0;
  });

  for (let hole = 1; hole <= 18; hole++) {
    const scores: Record<string, number | null> = {};
    const distribution: Record<string, number> = {};
    
    // Get each player's score
    players.forEach(pid => {
      const sc = event.scorecards.find(s => s.golferId === pid);
      const gross = sc?.scores.find(s => s.hole === hole)?.strokes ?? null;
      const value = config.net ? netScore(event, pid, hole, gross, profiles) : gross;
      scores[pid] = value;
    });

    // Check if all have scores
    const validPlayers = players.filter(p => scores[p] != null);
    if (validPlayers.length < 3) {
      // Not enough scores — give 3-3-3
      players.forEach(p => { distribution[p] = 3; });
    } else {
      const sorted = [...validPlayers].sort((a, b) => scores[a]! - scores[b]!);
      const [low, mid, high] = sorted;
      const lowScore = scores[low]!;
      const midScore = scores[mid]!;
      const highScore = scores[high]!;

      // Sweep check: if enabled and one player beats others by 2+
      if (config.sweepEnabled && midScore - lowScore >= 2) {
        distribution[low] = 9;
        distribution[mid] = 0;
        distribution[high] = 0;
      } else if (lowScore === midScore && midScore === highScore) {
        // All three tie → 3-3-3
        distribution[low] = 3;
        distribution[mid] = 3;
        distribution[high] = 3;
      } else if (lowScore === midScore) {
        // Two tied for low → 4-4-1
        distribution[low] = 4;
        distribution[mid] = 4;
        distribution[high] = 1;
      } else if (midScore === highScore) {
        // Two tied for high → 5-2-2
        distribution[low] = 5;
        distribution[mid] = 2;
        distribution[high] = 2;
      } else {
        // All different → 5-3-1
        distribution[low] = 5;
        distribution[mid] = 3;
        distribution[high] = 1;
      }
    }

    // Accumulate
    players.forEach(p => {
      const pts = distribution[p] || 0;
      pointsByGolfer[p] += pts;
    });

    holeResults.push({ hole, distribution, scores });
  }

  // Calculate net owings: each pair settles the point difference × fee
  // E.g., A has 78, B has 65, C has 49: A pays B (78-65)*fee, A pays C (78-49)*fee, B pays C (65-49)*fee
  // Net result: positive = net winner, negative = net loser
  const [p1, p2, p3] = players;
  const avgPoints = (pointsByGolfer[p1] + pointsByGolfer[p2] + pointsByGolfer[p3]) / 3;
  
  players.forEach(p => {
    // Your net = (your points - average) × fee × (n-1) / n 
    // Simplified: sum of (your points - each opponent's points) × fee
    const otherPlayers = players.filter(x => x !== p);
    let net = 0;
    otherPlayers.forEach(opp => {
      net += (pointsByGolfer[p] - pointsByGolfer[opp]) * feePerPoint;
    });
    owingsByGolfer[p] = net;
  });

  return {
    configId: config.id,
    feePerPoint,
    totalPointsPerHole: 9,
    holeResults,
    pointsByGolfer,
    owingsByGolfer,
  };
}

export function computeAllNinePoint(event: Event, profiles: any[]): NinePointSummary[] {
  return (event.games.ninePoint || [])
    .map(cfg => computeNinePoint(event, cfg, profiles))
    .filter((r): r is NinePointSummary => !!r);
}
