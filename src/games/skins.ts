import { Event, SkinsConfig } from '../state/store';
import { netScore } from './handicap';

export interface SkinsHoleResult {
  hole: number;
  winners: string[]; // golferIds
  carryIntoNext: boolean; // always false in simplified mode
  potValue: number; // per-skin value (same for every skin)
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
  let players = event.golfers.map(g => g.profileId || g.customName).filter((id): id is string => id !== undefined);
  if (config.participantGolferIds && config.participantGolferIds.length > 1) {
    players = players.filter(p => config.participantGolferIds!.includes(p));
  }
  if (players.length < 2) return null;
  const totalPot = players.length * config.fee;
  const winningsByGolfer: Record<string, number> = {};
  const winningHolesByGolfer: Record<string, number[]> = {};
  players.forEach(p => { winningsByGolfer[p] = 0; winningHolesByGolfer[p] = []; });

  // First pass: collect unique winning holes only
  interface TempHole { hole: number; winner: string; score: number; }
  const temp: TempHole[] = [];
  for (let h = 1; h <= 18; h++) {
    const holeScores: Record<string, number> = {};
    players.forEach(pid => {
      const sc = event.scorecards.find(s => s.golferId === pid);
      const gross = sc?.scores.find(s => s.hole === h)?.strokes ?? null;
      const value = config.net ? netScore(event, pid, h, gross, profiles) : gross;
      holeScores[pid] = value == null ? Number.POSITIVE_INFINITY : value;
    });
    const min = Math.min(...Object.values(holeScores));
    const winners = Object.entries(holeScores).filter(([, v]) => v === min && Number.isFinite(v)).map(([pid]) => pid);
    if (winners.length === 1) {
      temp.push({ hole: h, winner: winners[0], score: min });
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
