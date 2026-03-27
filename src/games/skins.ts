import { Event, SkinsConfig } from '../state/store';
import { netScore } from './handicap';
import { getParticipantsForConfig } from './participants';

export interface SkinsHoleResult {
  hole: number;
  winners: string[];
  carryIntoNext: boolean;
  potValue: number;
  winningScore: number | null;
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
  const players = getParticipantsForConfig(event, config, 'skins');
  if (players.length < 2) return null;

  const totalPot = players.length * config.fee;
  const winningsByGolfer: Record<string, number> = {};
  const winningHolesByGolfer: Record<string, number[]> = {};
  players.forEach((playerId) => {
    winningsByGolfer[playerId] = 0;
    winningHolesByGolfer[playerId] = [];
  });

  const buildHoleScores = (hole: number) => {
    const holeScores: Record<string, number> = {};

    players.forEach((playerId) => {
      const scorecard = event.scorecards.find((s) => s.golferId === playerId);
      const gross = scorecard?.scores.find((s) => s.hole === hole)?.strokes ?? null;
      const value = config.net ? netScore(event, playerId, hole, gross, profiles) : gross;
      holeScores[playerId] = value == null ? Number.POSITIVE_INFINITY : value;
    });

    const values = Object.values(holeScores);
    const min = Math.min(...values);
    const winners = Object.entries(holeScores)
      .filter(([, value]) => value === min && Number.isFinite(value))
      .map(([playerId]) => playerId);
    const winningScore = Number.isFinite(min) ? min : null;

    return { winners, winningScore };
  };

  if (config.carryovers) {
    const perHole = totalPot / 18;
    let carryPot = perHole;
    const holeResults: SkinsHoleResult[] = [];

    for (let hole = 1; hole <= 18; hole++) {
      const { winners, winningScore } = buildHoleScores(hole);
      const isLastHole = hole === 18;
      const isWin = winners.length === 1;

      if (isWin) {
        const winner = winners[0];
        winningsByGolfer[winner] += carryPot;
        winningHolesByGolfer[winner].push(hole);
        holeResults.push({ hole, winners: [winner], carryIntoNext: false, potValue: carryPot, winningScore });
        carryPot = perHole;
        continue;
      }

      if (isLastHole) {
        const splitWinners = winners.length > 0 ? winners : players;
        const split = splitWinners.length > 0 ? carryPot / splitWinners.length : 0;
        splitWinners.forEach((winner) => {
          winningsByGolfer[winner] += split;
          winningHolesByGolfer[winner].push(hole);
        });
        holeResults.push({ hole, winners: splitWinners, carryIntoNext: false, potValue: carryPot, winningScore });
      } else {
        holeResults.push({ hole, winners, carryIntoNext: true, potValue: carryPot, winningScore });
        carryPot += perHole;
      }
    }

    return { configId: config.id, feePerPlayer: config.fee, totalPot, holeResults, winningsByGolfer, winningHolesByGolfer };
  }

  interface TempHole {
    hole: number;
    winner: string;
    score: number;
  }

  const winningHoles: TempHole[] = [];
  for (let hole = 1; hole <= 18; hole++) {
    const { winners, winningScore } = buildHoleScores(hole);
    if (winners.length === 1) {
      winningHoles.push({
        hole,
        winner: winners[0],
        score: winningScore ?? Number.POSITIVE_INFINITY,
      });
    }
  }

  const skinCount = winningHoles.length;
  const perSkin = skinCount > 0 ? totalPot / skinCount : 0;
  const holeResults: SkinsHoleResult[] = winningHoles.map((entry) => {
    winningsByGolfer[entry.winner] += perSkin;
    winningHolesByGolfer[entry.winner].push(entry.hole);
    return {
      hole: entry.hole,
      winners: [entry.winner],
      carryIntoNext: false,
      potValue: perSkin,
      winningScore: entry.score,
    };
  });

  return { configId: config.id, feePerPlayer: config.fee, totalPot, holeResults, winningsByGolfer, winningHolesByGolfer };
}
