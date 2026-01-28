import { Event, SkinsConfig } from '../state/store';
import { netScore } from './handicap';

export interface SkinsHoleResult {
  hole: number;
  winners: string[]; // golferIds
  carryIntoNext: boolean;
  potValue: number; // pot value for this hole (won or carried)
  winningScore: number | null; // gross or net score that won
}

export interface SkinsSummary {
  configId: string;
  feePerPlayer: number;
  totalPot: number;
  holeResults: SkinsHoleResult[];
  winningsByGolfer: Record<string, number>;
  winningHolesByGolfer: Record<string, number[]>;
}

export function computeSkins(event: Event, config: SkinsConfig, profiles: any[]): SkinsSummary | null {
  const prefFor = (gid: string): 'all' | 'nassau' | 'skins' | 'none' => {
    const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
    return (eg?.gamePreference as any) || 'all';
  };
  const eligible = (gid: string) => {
    const pref = prefFor(gid);
    return pref === 'all' || pref === 'skins';
  };

  let players = event.golfers
    .map((g: any) => g.profileId || g.customName || g.displayName)
    .filter((id: any): id is string => id !== undefined && id !== null && id !== '')
    .filter(eligible);
  if (config.participantGolferIds && config.participantGolferIds.length > 1) {
    players = players.filter(p => config.participantGolferIds!.includes(p));
  }
  if (players.length < 2) return null;
  const totalPot = players.length * config.fee;
  const winningsByGolfer: Record<string, number> = {};
  const winningHolesByGolfer: Record<string, number[]> = {};
  players.forEach(p => { winningsByGolfer[p] = 0; winningHolesByGolfer[p] = []; });

  const buildHoleScores = (hole: number) => {
    const holeScores: Record<string, number> = {};
    players.forEach(pid => {
      const sc = event.scorecards.find(s => s.golferId === pid);
      const gross = sc?.scores.find(s => s.hole === hole)?.strokes ?? null;
      const value = config.net ? netScore(event, pid, hole, gross, profiles) : gross;
      holeScores[pid] = value == null ? Number.POSITIVE_INFINITY : value;
    });
    const values = Object.values(holeScores);
    const min = Math.min(...values);
    const winners = Object.entries(holeScores)
      .filter(([, v]) => v === min && Number.isFinite(v))
      .map(([pid]) => pid);
    const winningScore = Number.isFinite(min) ? min : null;
    return { winners, winningScore };
  };

  // Carryover mode (optional): each hole is worth 1/18th of the pot; ties carry.
  if (config.carryovers) {
    const perHole = totalPot / 18;
    let carryPot = perHole;
    const holeResults: SkinsHoleResult[] = [];

    for (let h = 1; h <= 18; h++) {
      const { winners, winningScore } = buildHoleScores(h);

      const isLastHole = h === 18;
      const isWin = winners.length === 1;

      if (isWin) {
        const winner = winners[0];
        winningsByGolfer[winner] += carryPot;
        winningHolesByGolfer[winner].push(h);
        holeResults.push({ hole: h, winners: [winner], carryIntoNext: false, potValue: carryPot, winningScore });
        carryPot = perHole;
        continue;
      }

      // Tie (or no valid scores) => carry, unless we're on 18 in which case split.
      if (isLastHole) {
        const splitWinners = winners.length > 0 ? winners : players;
        const split = splitWinners.length > 0 ? carryPot / splitWinners.length : 0;
        splitWinners.forEach(w => {
          winningsByGolfer[w] += split;
          winningHolesByGolfer[w].push(h);
        });
        holeResults.push({ hole: h, winners: splitWinners, carryIntoNext: false, potValue: carryPot, winningScore });
      } else {
        holeResults.push({ hole: h, winners, carryIntoNext: true, potValue: carryPot, winningScore });
        carryPot += perHole;
      }
    }

    return { configId: config.id, feePerPlayer: config.fee, totalPot, holeResults, winningsByGolfer, winningHolesByGolfer };
  }

  // First pass: collect unique winning holes only
  interface TempHole { hole: number; winner: string; score: number; }
  const temp: TempHole[] = [];
  for (let h = 1; h <= 18; h++) {
    const { winners, winningScore } = buildHoleScores(h);
    if (winners.length === 1) {
      temp.push({ hole: h, winner: winners[0], score: winningScore ?? Number.POSITIVE_INFINITY });
    }
  }
  const skinCount = temp.length;
  const perSkin = skinCount > 0 ? totalPot / skinCount : 0;
  const holeResults: SkinsHoleResult[] = temp.map(t => {
    winningsByGolfer[t.winner] += perSkin;
    winningHolesByGolfer[t.winner].push(t.hole);
    return { hole: t.hole, winners: [t.winner], carryIntoNext: false, potValue: perSkin, winningScore: t.score };
  });
  return { configId: config.id, feePerPlayer: config.fee, totalPot, holeResults, winningsByGolfer, winningHolesByGolfer };
}
