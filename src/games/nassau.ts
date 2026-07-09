import { Event, NassauConfig, NassauTeam } from '../state/store';
import { courseMap } from '../data/courses';
import { netScore } from './handicap';
import { getParticipantsForConfig } from './participants';

export interface NassauSegmentResult {
  segment: 'front' | 'back' | 'total';
  winners: string[];
  scores: Record<string, number>;
  toPar: Record<string, number>;
  pot: number;
  mode: 'individual' | 'team';
}

export interface NassauPayoutSummary {
  configId: string;
  groupId: string;
  feePerPlayer: number;
  feesPerPlayer: { out: number; in: number; total: number };
  pot: number;
  segments: NassauSegmentResult[];
  winningsByGolfer: Record<string, number>;
}

function segmentHoles(segment: 'front' | 'back' | 'total'): number[] {
  if (segment === 'front') return Array.from({ length: 9 }, (_, i) => i + 1);
  if (segment === 'back') return Array.from({ length: 9 }, (_, i) => i + 10);
  return Array.from({ length: 18 }, (_, i) => i + 1);
}

export function computeNassauForConfig(event: Event, config: NassauConfig, profiles: any[]): NassauPayoutSummary | null {
  const group = event.groups.find((g) => g.id === config.groupId);
  if (!group || group.golferIds.length < 2) return null;

  const isTeam = Boolean(config.teams && config.teams.length >= 2);
  const players = getParticipantsForConfig(event, config, 'nassau', {
    restrictToGroup: true,
    assignedTeamsOnly: isTeam,
  });
  if (players.length < 2) return null;

  const payingPlayers = players;
  const feesPerPlayer = config.fees ?? { out: config.fee, in: config.fee, total: config.fee };
  if (payingPlayers.length < 2) return null;

  const pot = payingPlayers.length * (feesPerPlayer.out + feesPerPlayer.in + feesPerPlayer.total);
  const winningsByGolfer: Record<string, number> = {};
  payingPlayers.forEach((playerId) => {
    winningsByGolfer[playerId] = 0;
  });

  const segmentFee = (segment: 'front' | 'back' | 'total') =>
    segment === 'front' ? feesPerPlayer.out : segment === 'back' ? feesPerPlayer.in : feesPerPlayer.total;

  const is2TeamMatch = isTeam && config.teams?.length === 2 && config.scoringType === 'match';

  const segments: NassauSegmentResult[] = (['front', 'back', 'total'] as const).map((segment) => {
    const holes = segmentHoles(segment);
    const segmentPot = payingPlayers.length * segmentFee(segment);
    const scores: Record<string, number> = {};
    const toPar: Record<string, number> = {};

    if (!isTeam) {
      players.forEach((playerId) => {
        const scorecard = event.scorecards.find((s) => s.golferId === playerId);
        if (!scorecard) return;
        const relevantScores = scorecard.scores.filter((score) => holes.includes(score.hole) && score.strokes != null);
        const sum = relevantScores.reduce((acc, score) => {
          if (!config.net) return acc + (score.strokes ?? 0);
          return acc + (netScore(event, playerId, score.hole, score.strokes, profiles) ?? 0);
        }, 0);
        scores[playerId] = relevantScores.length === holes.length ? sum : Number.POSITIVE_INFINITY;
      });
    } else if (is2TeamMatch) {
      const team1 = config.teams![0];
      const team2 = config.teams![1];
      const bestCount = config.teamBestCount && config.teamBestCount > 0 ? config.teamBestCount : 1;

      let team1Wins = 0;
      let team2Wins = 0;
      let allComplete = true;

      for (const hole of holes) {
        const getTeamBestScore = (team: NassauTeam): number | null => {
          const memberScores: number[] = [];
          const teamMembers = team.golferIds.filter((golferId) => players.includes(golferId));

          teamMembers.forEach((playerId) => {
            const scorecard = event.scorecards.find((s) => s.golferId === playerId);
            const gross = scorecard?.scores.find((s) => s.hole === hole)?.strokes ?? null;
            const value = gross == null ? null : (config.net ? (netScore(event, playerId, hole, gross, profiles) ?? gross) : gross);
            if (value != null) memberScores.push(value);
          });

          if (memberScores.length === 0) return null;
          memberScores.sort((a, b) => a - b);
          const used = memberScores.slice(0, Math.min(bestCount, memberScores.length));
          return used.reduce((a, b) => a + b, 0);
        };

        const score1 = getTeamBestScore(team1);
        const score2 = getTeamBestScore(team2);
        if (score1 === null || score2 === null) {
          allComplete = false;
          break;
        }

        if (score1 < score2) team1Wins++;
        else if (score2 < score1) team2Wins++;
      }

      scores[team1.id] = allComplete ? -team1Wins : Number.POSITIVE_INFINITY;
      scores[team2.id] = allComplete ? -team2Wins : Number.POSITIVE_INFINITY;
      toPar[team1.id] = team1Wins - team2Wins;
      toPar[team2.id] = team2Wins - team1Wins;
    } else {
      const bestCount = config.teamBestCount && config.teamBestCount > 0 ? config.teamBestCount : 1;

      (config.teams || []).forEach((team) => {
        const teamMembers = team.golferIds.filter((golferId) => players.includes(golferId));
        if (teamMembers.length === 0) return;

        let total = 0;
        let parTotal = 0;
        let allComplete = true;

        for (const hole of holes) {
          const memberScores: number[] = [];
          let holePar = 4;

          if (event.course.courseId) {
            const course = courseMap[event.course.courseId];
            const holeData = course?.holes.find((item: any) => item.number === hole);
            if (holeData) holePar = holeData.par;
          }

          teamMembers.forEach((playerId) => {
            const scorecard = event.scorecards.find((s) => s.golferId === playerId);
            const gross = scorecard?.scores.find((s) => s.hole === hole)?.strokes ?? null;
            const value = gross == null ? null : (config.net ? (netScore(event, playerId, hole, gross, profiles) ?? gross) : gross);
            if (value != null) memberScores.push(value);
          });

          if (memberScores.length === 0) {
            allComplete = false;
            break;
          }

          memberScores.sort((a, b) => a - b);
          const used = memberScores.slice(0, Math.min(bestCount, memberScores.length));
          total += used.reduce((a, b) => a + b, 0);
          parTotal += holePar * used.length;
        }

        scores[team.id] = allComplete ? total : Number.POSITIVE_INFINITY;
        toPar[team.id] = allComplete ? total - parTotal : 0;
      });
    }

    const minScore = Math.min(...Object.values(scores));
    const winners = Object.entries(scores)
      .filter(([, score]) => score === minScore && Number.isFinite(score))
      .map(([id]) => id);

    if (winners.length > 0) {
      const share = segmentPot / winners.length;
      if (!isTeam) {
        winners.forEach((winnerId) => {
          winningsByGolfer[winnerId] += share;
        });
      } else {
        winners.forEach((teamId) => {
          const team = (config.teams || []).find((candidate) => candidate.id === teamId);
          if (!team) return;
          const participatingGolferIds = team.golferIds.filter((golferId) => payingPlayers.includes(golferId));
          if (participatingGolferIds.length === 0) return;
          const perGolfer = share / participatingGolferIds.length;
          participatingGolferIds.forEach((golferId) => {
            winningsByGolfer[golferId] = (winningsByGolfer[golferId] || 0) + perGolfer;
          });
        });
      }
    }

    if (!isTeam && event.course.courseId) {
      const course = courseMap[event.course.courseId];
      const parForSegment = course
        ? course.holes.filter((hole: any) => holes.includes(hole.number)).reduce((acc: number, hole: any) => acc + hole.par, 0)
        : 0;
      if (parForSegment > 0) {
        Object.entries(scores).forEach(([id, value]) => {
          if (Number.isFinite(value)) toPar[id] = value - parForSegment;
        });
      }
    }

    return {
      segment,
      winners,
      scores,
      toPar,
      pot: segmentPot,
      mode: isTeam ? 'team' : 'individual',
    };
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
    .map((config) => computeNassauForConfig(event, config, profiles))
    .filter((summary): summary is NassauPayoutSummary => Boolean(summary));
}
