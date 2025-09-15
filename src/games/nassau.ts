import { Event, NassauConfig, NassauTeam } from '../state/store';
import { netScore } from './handicap';

export interface NassauSegmentResult {
  segment: 'front' | 'back' | 'total';
  winners: string[]; // golferIds or team ids depending on mode
  scores: Record<string, number>; // id -> strokes for that segment
  toPar: Record<string, number>; // id -> strokes relative to par (negative = under)
  pot: number; // portion of nassau pot assigned to this segment
  mode: 'individual' | 'team';
}

export interface NassauPayoutSummary {
  configId: string;
  groupId: string;
  feePerPlayer: number;
  pot: number; // total pot for this nassau (players * fee)
  segments: NassauSegmentResult[];
  winningsByGolfer: Record<string, number>;
}

function segmentHoles(segment: 'front' | 'back' | 'total'): number[] {
  if (segment === 'front') return Array.from({ length: 9 }, (_, i) => i + 1);
  if (segment === 'back') return Array.from({ length: 9 }, (_, i) => i + 10);
  return Array.from({ length: 18 }, (_, i) => i + 1);
}

export function computeNassauForConfig(event: Event, config: NassauConfig, profiles: any[]): NassauPayoutSummary | null {
  const group = event.groups.find(g => g.id === config.groupId);
  if (!group || group.golferIds.length < 2) return null;
  // Allow restricting golfers for this Nassau (subset scenario)
  const players = (config.participantGolferIds && config.participantGolferIds.length > 1)
    ? group.golferIds.filter(id => config.participantGolferIds!.includes(id))
    : group.golferIds;
  if (players.length < 2) return null;
  const isTeam = !!(config.teams && config.teams.length >= 2);
  // If team mode: only count golfers actually assigned to a team toward the pot.
  let payingPlayers = players;
  if (isTeam) {
    const teamGolferIds = new Set<string>();
    (config.teams || []).forEach(t => t.golferIds.forEach(gid => { if (players.includes(gid)) teamGolferIds.add(gid); }));
    payingPlayers = players.filter(p => teamGolferIds.has(p));
  }
  if (payingPlayers.length < 2) return null; // not enough paying participants
  const pot = payingPlayers.length * config.fee;
  const segmentPot = pot / 3; // equal split front/back/total
  const winningsByGolfer: Record<string, number> = {};
  payingPlayers.forEach(p => (winningsByGolfer[p] = 0));

  const segments: NassauSegmentResult[] = (['front', 'back', 'total'] as const).map(segment => {
    const holes = segmentHoles(segment);
  const scores: Record<string, number> = {};
  const toPar: Record<string, number> = {};
    if (!isTeam) {
  players.forEach(pid => {
        const sc = event.scorecards.find(s => s.golferId === pid);
        if (!sc) return;
        const sum = sc.scores
          .filter(s => holes.includes(s.hole) && s.strokes != null)
          .reduce((acc, s) => acc + (config.net ? (netScore(event, pid, s.hole, s.strokes, profiles) ?? 0) : (s.strokes ?? 0)), 0);
        const playedHoles = sc.scores.filter(s => holes.includes(s.hole) && s.strokes != null).length;
        scores[pid] = playedHoles === holes.length ? sum : Number.POSITIVE_INFINITY;
      });
      // compute par baseline for holes from course data if available
      const courseDef = event.course.courseId ? event.course.courseId : null;
      let parSum = 0;
      if (courseDef) {
        // dynamic import courseMap inline to avoid circular (already imported in other modules but safe)
        // We'll require caller already has correct par values via scorecards; using scorecards would be simpler.
      }
      // derive par per hole via first golfer scorecard metadata (par not stored there), so skip; we can't compute without course map here.
    } else {
      const bestCount = config.teamBestCount && config.teamBestCount > 0 ? config.teamBestCount : 1;
      (config.teams || []).forEach(team => {
        // aggregate per hole: sort team members' scores (net/gross) and take best N
        let total = 0;
        let parTotal = 0;
        let allComplete = true;
        for (const h of holes) {
          const memberScores: number[] = [];
          let holePar = 4; // default par
          
          // Get hole par from course data
          if (event.course.courseId) {
            try {
              const { courseMap } = require('../data/courses');
              const course = courseMap[event.course.courseId];
              if (course) {
                const holeData = course.holes.find((hole: any) => hole.number === h);
                if (holeData) holePar = holeData.par;
              }
            } catch {}
          }
          
            team.golferIds.forEach(pid => {
              const sc = event.scorecards.find(s => s.golferId === pid);
              const gross = sc?.scores.find(s => s.hole === h)?.strokes ?? null;
              const value = gross == null ? null : (config.net ? (netScore(event, pid, h, gross, profiles) ?? gross) : gross);
              if (value != null) memberScores.push(value);
            });
          if (memberScores.length === 0) { allComplete = false; break; }
          memberScores.sort((a,b)=>a-b);
          const used = memberScores.slice(0, Math.min(bestCount, memberScores.length));
          total += used.reduce((a,b)=>a+b,0);
          parTotal += holePar * used.length; // par for the number of scores used
        }
        // Store the score as strokes relative to par (negative = under par)
        scores[team.id] = allComplete ? total - parTotal : Number.POSITIVE_INFINITY;
        // Store the raw total for display purposes
        if (allComplete) {
          toPar[team.id] = total - parTotal;
        }
      });
    }
    const minScore = Math.min(...Object.values(scores));
    const winners = Object.entries(scores)
      .filter(([, v]) => v === minScore && Number.isFinite(v))
      .map(([id]) => id);
    if (winners.length) {
      const share = segmentPot / winners.length;
      if (!isTeam) {
        winners.forEach(w => (winningsByGolfer[w] += share));
      } else {
        winners.forEach(teamId => {
          const team = (config.teams || []).find(t => t.id === teamId);
          if (team) {
            const perGolfer = share / team.golferIds.length;
            team.golferIds.forEach(gid => { winningsByGolfer[gid] = (winningsByGolfer[gid] || 0) + perGolfer; });
          }
        });
      }
    }
    // compute toPar if course info available
    let parForSegment = 0;
    if (event.course.courseId) {
      // Lazy load course map locally to avoid top-level cycle
      try {
        const { courseMap } = require('../data/courses');
        const course = courseMap[event.course.courseId];
        if (course) {
          parForSegment = course.holes.filter((h: any)=>holes.includes(h.number)).reduce((a: number,h: any)=>a+h.par,0);
        }
      } catch {}
    }
    if (parForSegment > 0) {
      Object.entries(scores).forEach(([id, val]) => {
        if (Number.isFinite(val)) toPar[id] = val - parForSegment;
      });
    }
    return { segment, winners, scores, toPar, pot: segmentPot, mode: isTeam ? 'team' : 'individual' };
  });

  return { configId: config.id, groupId: config.groupId, feePerPlayer: config.fee, pot, segments, winningsByGolfer };
}

export function computeAllNassau(event: Event, profiles: any[]): NassauPayoutSummary[] {
  return event.games.nassau
    .map(cfg => computeNassauForConfig(event, cfg, profiles))
    .filter((r): r is NassauPayoutSummary => !!r);
}
