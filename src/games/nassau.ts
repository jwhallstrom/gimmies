import { Event, NassauConfig, NassauTeam } from '../state/store';
import { netScore } from './handicap';
import { courseMap } from '../data/courses';

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
  /** Total per-player buy-in across all segments. */
  feePerPlayer: number;
  /** Per-segment fees per player. */
  feesPerPlayer: { out: number; in: number; total: number };
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
  const prefFor = (gid: string): 'all' | 'skins' | 'none' => {
    const eg = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === gid);
    return (eg?.gamePreference as any) || 'all';
  };
  const eligible = (gid: string) => prefFor(gid) === 'all';
  // Allow restricting golfers for this Nassau (subset scenario)
  const base = group.golferIds.filter(eligible);
  const players = (config.participantGolferIds && config.participantGolferIds.length > 1)
    ? base.filter(id => config.participantGolferIds!.includes(id))
    : base;
  if (players.length < 2) return null;
  const isTeam = !!(config.teams && config.teams.length >= 2);

  // Determine who is participating/paying.
  // Fee semantics:
  // - If `config.fees` exists, those are per-player segment fees.
  // - Otherwise treat legacy `config.fee` as a per-segment fee (i.e., 5 => 5/5/5).
  let payingPlayers = players;
  if (isTeam) {
    const teamGolferIds = new Set<string>();
    (config.teams || []).forEach(t => t.golferIds.forEach(gid => { if (players.includes(gid)) teamGolferIds.add(gid); }));
    payingPlayers = players.filter(p => teamGolferIds.has(p));
  }

  if (payingPlayers.length < 2) return null; // not enough paying participants
  const feesPerPlayer = config.fees ?? { out: config.fee, in: config.fee, total: config.fee };
  const pot =
    payingPlayers.length * (feesPerPlayer.out + feesPerPlayer.in + feesPerPlayer.total);
  const winningsByGolfer: Record<string, number> = {};
  payingPlayers.forEach(p => (winningsByGolfer[p] = 0));

  const segmentFee = (segment: 'front' | 'back' | 'total') =>
    segment === 'front' ? feesPerPlayer.out : segment === 'back' ? feesPerPlayer.in : feesPerPlayer.total;

  const segments: NassauSegmentResult[] = (['front', 'back', 'total'] as const).map(segment => {
    const holes = segmentHoles(segment);
    const segmentPot = payingPlayers.length * segmentFee(segment);
  const scores: Record<string, number> = {};
  const toPar: Record<string, number> = {};
    
    console.log(`🏌️ Nassau ${segment} calculation:`, { holes, isTeam });
    
    if (!isTeam) {
  players.forEach(pid => {
        const sc = event.scorecards.find(s => s.golferId === pid);
        if (!sc) return;
        const relevantScores = sc.scores.filter(s => holes.includes(s.hole) && s.strokes != null);
        const sum = relevantScores.reduce((acc, s) => acc + (config.net ? (netScore(event, pid, s.hole, s.strokes, profiles) ?? 0) : (s.strokes ?? 0)), 0);
        const playedHoles = relevantScores.length;
        scores[pid] = playedHoles === holes.length ? sum : Number.POSITIVE_INFINITY;
        
        console.log(`  Player ${pid}: ${playedHoles}/${holes.length} holes, score=${scores[pid]} (sum=${sum})`);
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
      console.log(`  Team mode: bestCount=${bestCount}, teams=${config.teams?.length || 0}`);
      
      (config.teams || []).forEach(team => {
        const teamMembers = team.golferIds.filter(gid => players.includes(gid));
        if (teamMembers.length === 0) {
          return;
        }
        // aggregate per hole: sort team members' scores (net/gross) and take best N
        let total = 0;
        let parTotal = 0;
        let allComplete = true;
        console.log(`  Calculating team ${team.id} (${team.name}):`, teamMembers);
        
        for (const h of holes) {
          const memberScores: number[] = [];
          let holePar = 4; // default par
          
          // Get hole par from course data
          if (event.course.courseId) {
            const course = courseMap[event.course.courseId];
            if (course) {
              const holeData = course.holes.find((hole: any) => hole.number === h);
              if (holeData) holePar = holeData.par;
            }
          }
          
            teamMembers.forEach(pid => {
              const sc = event.scorecards.find(s => s.golferId === pid);
              const gross = sc?.scores.find(s => s.hole === h)?.strokes ?? null;
              const value = gross == null ? null : (config.net ? (netScore(event, pid, h, gross, profiles) ?? gross) : gross);
              if (value != null) memberScores.push(value);
            });
          if (memberScores.length === 0) { allComplete = false; break; }
          memberScores.sort((a,b)=>a-b);
          const used = memberScores.slice(0, Math.min(bestCount, memberScores.length));
          const holeTotal = used.reduce((a,b)=>a+b,0);
          total += holeTotal;
          parTotal += holePar * used.length; // par for the number of scores used
          console.log(`    Hole ${h}: par=${holePar}, memberScores=[${memberScores.join(', ')}], used=[${used.join(', ')}], holeTotal=${holeTotal}`);
        }
        // Store the raw total strokes AND compute toPar using the accumulated parTotal
        scores[team.id] = allComplete ? total : Number.POSITIVE_INFINITY;
        toPar[team.id] = allComplete ? total - parTotal : 0;
        console.log(`  Team ${team.id} final: total=${total}, parTotal=${parTotal}, toPar=${total - parTotal}`);
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
            const participatingGolferIds = team.golferIds.filter(gid => payingPlayers.includes(gid));
            if (participatingGolferIds.length === 0) return;
            const perGolfer = share / participatingGolferIds.length;
            participatingGolferIds.forEach(gid => { winningsByGolfer[gid] = (winningsByGolfer[gid] || 0) + perGolfer; });
          }
        });
      }
    }
    // compute toPar for INDIVIDUAL mode (team mode already computed toPar above)
    let parForSegment = 0;
    if (!isTeam) {
      if (event.course.courseId) {
        const course = courseMap[event.course.courseId];
        if (course) {
          parForSegment = course.holes.filter((h: any)=>holes.includes(h.number)).reduce((a: number,h: any)=>a+h.par,0);
        }
      }
      if (parForSegment > 0) {
        Object.entries(scores).forEach(([id, val]) => {
          if (Number.isFinite(val)) {
            toPar[id] = val - parForSegment;
            console.log(`  ${id} toPar: ${val} - ${parForSegment} = ${toPar[id]}`);
          }
        });
      }
    }
    
    console.log(`🏌️ Nassau ${segment} results:`, { scores, toPar, winners, parForSegment: isTeam ? 'N/A (team mode)' : parForSegment });
    
    return { segment, winners, scores, toPar, pot: segmentPot, mode: isTeam ? 'team' : 'individual' };
  });

  return {
    configId: config.id,
    groupId: config.groupId,
    feePerPlayer: feesPerPlayer.out + feesPerPlayer.in + feesPerPlayer.total,
    feesPerPlayer,
    pot,
    segments,
    winningsByGolfer,
  };
}

export function computeAllNassau(event: Event, profiles: any[]): NassauPayoutSummary[] {
  return event.games.nassau
    .map(cfg => computeNassauForConfig(event, cfg, profiles))
    .filter((r): r is NassauPayoutSummary => !!r);
}
