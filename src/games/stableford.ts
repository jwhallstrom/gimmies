import { Event, StablefordConfig } from '../state/store';
import { netScore } from './handicap';

export interface StablefordSummary {
  configId: string;
  feePerPlayer: number;
  totalPot: number;
  system: 'standard' | 'modified';
  pointsByGolfer: Record<string, number>;            // Total stableford points
  pointsByHole: Record<string, Record<number, number>>; // golferId -> hole -> points
  winningsByGolfer: Record<string, number>;           // Pot distribution
}

/**
 * Standard Stableford point values (relative to par):
 * Double bogey or worse → 0
 * Bogey → 1
 * Par → 2
 * Birdie → 3
 * Eagle → 4
 * Albatross → 5
 */
function standardPoints(toPar: number): number {
  if (toPar >= 2) return 0;      // Double bogey+
  if (toPar === 1) return 1;     // Bogey
  if (toPar === 0) return 2;     // Par
  if (toPar === -1) return 3;    // Birdie
  if (toPar === -2) return 4;    // Eagle
  return 5;                       // Albatross or better
}

/**
 * Modified Stableford point values (more aggressive):
 * Double bogey or worse → -3
 * Bogey → -1
 * Par → 0
 * Birdie → +2
 * Eagle → +5
 * Albatross → +8
 */
function modifiedPoints(toPar: number): number {
  if (toPar >= 2) return -3;
  if (toPar === 1) return -1;
  if (toPar === 0) return 0;
  if (toPar === -1) return 2;
  if (toPar === -2) return 5;
  return 8;
}

export function computeStableford(event: Event, config: StablefordConfig, profiles: any[]): StablefordSummary | null {
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

  const totalPot = players.length * config.fee;
  const system = config.system || 'standard';
  const getPoints = system === 'modified' ? modifiedPoints : standardPoints;

  const pointsByGolfer: Record<string, number> = {};
  const pointsByHole: Record<string, Record<number, number>> = {};
  const winningsByGolfer: Record<string, number> = {};

  players.forEach(p => {
    pointsByGolfer[p] = 0;
    pointsByHole[p] = {};
    winningsByGolfer[p] = 0;
  });

  // Get par for each hole from course data
  const { getCourseById } = require('../data/cloudCourses');
  const courseId = event.course.courseId;
  const course = courseId ? getCourseById(courseId) : null;
  const tee = course?.tees?.find((t: any) => t.name === event.course.teeName) || course?.tees?.[0];

  for (let hole = 1; hole <= 18; hole++) {
    const holePar = tee?.holes?.find((h: any) => h.number === hole)?.par ?? 4;
    
    players.forEach(pid => {
      const sc = event.scorecards.find(s => s.golferId === pid);
      const gross = sc?.scores.find(s => s.hole === hole)?.strokes ?? null;
      if (gross == null) {
        pointsByHole[pid][hole] = 0;
        return;
      }
      const score = config.net ? netScore(event, pid, hole, gross, profiles) : gross;
      if (score == null) {
        pointsByHole[pid][hole] = 0;
        return;
      }
      const toPar = score - holePar;
      const pts = getPoints(toPar);
      pointsByHole[pid][hole] = pts;
      pointsByGolfer[pid] += pts;
    });
  }

  // Winner = highest total points. Ties split.
  const maxPoints = Math.max(...Object.values(pointsByGolfer));
  const winners = Object.entries(pointsByGolfer)
    .filter(([, pts]) => pts === maxPoints)
    .map(([gid]) => gid);

  if (winners.length > 0 && totalPot > 0) {
    const share = totalPot / winners.length;
    winners.forEach(w => { winningsByGolfer[w] = share; });
  }

  return {
    configId: config.id,
    feePerPlayer: config.fee,
    totalPot,
    system,
    pointsByGolfer,
    pointsByHole,
    winningsByGolfer,
  };
}

export function computeAllStableford(event: Event, profiles: any[]): StablefordSummary[] {
  return (event.games.stableford || [])
    .map(cfg => computeStableford(event, cfg, profiles))
    .filter((r): r is StablefordSummary => !!r);
}
