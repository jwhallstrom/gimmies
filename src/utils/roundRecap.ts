/**
 * Round Recap Generator (Enhanced)
 *
 * Generates insightful, shareable round recap highlights grouped by category:
 *
 * SCORING:   Low gross, net winner, vs-handicap, front 9 / back 9
 * HIGHLIGHTS: Aces, eagles, birdies leader, longest par streak
 * ANALYSIS:  Hole difficulty, par 3/4/5 performance, scoring distribution
 * MONEY:     Biggest winner/loser, skins detail, nassau detail
 *
 * Uses real course par data when available (fixes prior hardcoded-par-4 bug).
 */

import type { Event, ScoreEntry } from '../state/types';
import { getCourseById, getTee } from '../data/cloudCourses';
import { calculateEventPayouts } from '../games/payouts';

// ============================================================================
// Public Types
// ============================================================================

export type HighlightCategory = 'scoring' | 'highlights' | 'analysis' | 'money';

export type HighlightType =
  | 'low_score' | 'net_winner' | 'vs_handicap' | 'front_back'
  | 'aces' | 'eagles' | 'birdies' | 'pars_streak'
  | 'hole_difficulty' | 'par_performance' | 'scoring_dist'
  | 'money_winner' | 'game_highlight' | 'team_winner' | 'skins'
  | 'high_score';

export interface RoundRecapHighlight {
  type: HighlightType;
  category: HighlightCategory;
  emoji: string;
  title: string;
  description: string;
  golferNames?: string[];
  value?: number | string;
  /** Sub-items for expandable detail rows */
  details?: { label: string; value: string }[];
}

export interface RoundRecap {
  eventName: string;
  courseName: string;
  date: string;
  highlights: RoundRecapHighlight[];
  summary: string;
  coursePar?: number;
  holesPlayed?: number;
}

// ============================================================================
// Internal Helpers
// ============================================================================

interface GolferWithScores {
  id: string;
  name: string;
  scores: ScoreEntry[];
  handicap?: number | null;
  teeName?: string;
}

const getGolferName = (event: Event, golferId: string): string => {
  const golfer = event.golfers.find(
    (g) => g.profileId === golferId || g.customName === golferId
  );
  return golfer?.displayName || golfer?.customName || golferId.slice(0, 8);
};

const buildGolfersWithScores = (event: Event): GolferWithScores[] =>
  event.scorecards
    .filter((sc) => sc.scores.length > 0)
    .map((sc) => {
      const golfer = event.golfers.find(
        (g) => g.profileId === sc.golferId || g.customName === sc.golferId
      );
      return {
        id: sc.golferId,
        name: getGolferName(event, sc.golferId),
        scores: sc.scores,
        handicap: golfer?.handicapOverride ?? golfer?.handicapSnapshot ?? null,
        teeName: golfer?.teeName,
      };
    });

/**
 * Build a par array from real course data.
 * Falls back to par 4 for every hole when course data is missing.
 */
const buildParArray = (event: Event): number[] => {
  const tee = getTee(event.course?.courseId, event.course?.teeName);
  if (tee?.holes?.length) {
    const sorted = [...tee.holes].sort((a, b) => a.number - b.number);
    return sorted.map((h) => h.par);
  }
  return Array(18).fill(4);
};

/** Resolve course name from cloud cache, with fallback. */
const resolveCourseName = (event: Event): string => {
  const course = getCourseById(event.course?.courseId);
  return course?.name || event.name || 'the course';
};

const getTotalStrokes = (scores: ScoreEntry[]): number =>
  scores.reduce((sum, s) => sum + (s.strokes || 0), 0);

const getHolesPlayed = (scores: ScoreEntry[]): number =>
  scores.filter((s) => s.strokes != null && s.strokes > 0).length;

/**
 * Course handicap from index.
 * Formula: handicapIndex × (slope / 113), rounded.
 */
const calcCourseHandicap = (
  handicapIndex: number,
  courseId?: string,
  teeName?: string
): number => {
  const tee = getTee(courseId, teeName);
  const slope = tee?.slope ?? tee?.slopeRating ?? 113;
  return Math.round(handicapIndex * (slope / 113));
};

/**
 * Net strokes on a single hole.
 * Player receives extra strokes on holes where strokeIndex <= courseHandicap.
 * For handicaps > 18 the cycle repeats (2 strokes on low SI holes, etc.).
 */
const getNetStrokes = (
  gross: number,
  holeStrokeIndex: number,
  courseHandicap: number
): number => {
  const full = Math.floor(courseHandicap / 18);
  const remainder = courseHandicap % 18;
  return gross - full - (holeStrokeIndex <= remainder ? 1 : 0);
};

const fmtToPar = (n: number): string =>
  n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`;

// ============================================================================
// Highlight Generators (each returns null when data is insufficient)
// ============================================================================

/* 1 — Low Gross */
const genLowScore = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  if (!golfers.length) return null;
  const totalPar = pars.reduce((s, p) => s + p, 0);
  const sorted = [...golfers].sort(
    (a, b) => getTotalStrokes(a.scores) - getTotalStrokes(b.scores)
  );
  const low = getTotalStrokes(sorted[0].scores);
  const winners = sorted.filter((g) => getTotalStrokes(g.scores) === low);
  return {
    type: 'low_score',
    category: 'scoring',
    emoji: '🏆',
    title: 'Low Round',
    description: `${winners.map((g) => g.name).join(' & ')} shot ${low} (${fmtToPar(low - totalPar)})`,
    golferNames: winners.map((g) => g.name),
    value: low,
  };
};

/* 2 — Net Score Winner */
const genNetWinner = (
  golfers: GolferWithScores[],
  pars: number[],
  event: Event
): RoundRecapHighlight | null => {
  const withHdcp = golfers.filter((g) => g.handicap != null && g.handicap > 0);
  if (withHdcp.length < 2) return null;

  const courseId = event.course?.courseId;
  const tee = getTee(courseId, event.course?.teeName);
  const holes = tee?.holes
    ? [...tee.holes].sort((a, b) => a.number - b.number)
    : null;
  const totalPar = pars.reduce((s, p) => s + p, 0);

  const netScores = withHdcp.map((g) => {
    const ch = calcCourseHandicap(
      g.handicap!,
      courseId,
      g.teeName || event.course?.teeName
    );
    let net = 0;
    g.scores.forEach((s, i) => {
      if (!s.strokes) return;
      const si = holes?.[i]?.strokeIndex || i + 1;
      net += getNetStrokes(s.strokes, si, ch);
    });
    return { name: g.name, gross: getTotalStrokes(g.scores), net, hdcp: ch };
  });

  netScores.sort((a, b) => a.net - b.net);
  const best = netScores[0];
  const winners = netScores.filter((n) => n.net === best.net);

  return {
    type: 'net_winner',
    category: 'scoring',
    emoji: '🥇',
    title: 'Net Champion',
    description: `${winners.map((w) => w.name).join(' & ')} net ${best.net} (${fmtToPar(best.net - totalPar)}) — gross ${best.gross}, hdcp ${best.hdcp}`,
    golferNames: winners.map((w) => w.name),
    value: best.net,
    details: netScores.slice(0, 6).map((n, i) => ({
      label: `${i + 1}. ${n.name}`,
      value: `Net ${n.net} (gross ${n.gross}, hdcp ${n.hdcp})`,
    })),
  };
};

/* 3 — Aces */
const genAces = (golfers: GolferWithScores[]): RoundRecapHighlight[] => {
  const out: RoundRecapHighlight[] = [];
  golfers.forEach((g) => {
    const aceHoles = g.scores
      .map((s, i) => (s.strokes === 1 ? i + 1 : null))
      .filter(Boolean) as number[];
    if (aceHoles.length) {
      out.push({
        type: 'aces',
        category: 'highlights',
        emoji: '🎯',
        title: 'ACE!',
        description: `${g.name} holed out on ${aceHoles.map((h) => `#${h}`).join(', ')}!`,
        golferNames: [g.name],
        value: aceHoles.join(', '),
      });
    }
  });
  return out;
};

/* 4 — Eagles */
const genEagles = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  const data = golfers
    .map((g) => {
      const holes: number[] = [];
      g.scores.forEach((s, i) => {
        if (s.strokes && s.strokes <= pars[i] - 2) holes.push(i + 1);
      });
      return { name: g.name, count: holes.length, holes };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!data.length) return null;
  const top = data[0].count;
  const winners = data.filter((d) => d.count === top);
  return {
    type: 'eagles',
    category: 'highlights',
    emoji: '🦅',
    title: winners.length > 1 ? 'Eagles Landed' : 'Eagle Alert',
    description: `${winners.map((w) => w.name).join(' & ')} made ${top} eagle${top > 1 ? 's' : ''} (hole${data[0].holes.length > 1 ? 's' : ''} ${data[0].holes.join(', ')})`,
    golferNames: winners.map((w) => w.name),
    value: top,
  };
};

/* 5 — Most Birdies */
const genBirdies = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  const data = golfers
    .map((g) => {
      let count = 0;
      g.scores.forEach((s, i) => {
        if (s.strokes && s.strokes === pars[i] - 1) count++;
      });
      return { name: g.name, count };
    })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!data.length || data[0].count < 2) return null;
  const top = data[0].count;
  const winners = data.filter((d) => d.count === top);
  return {
    type: 'birdies',
    category: 'highlights',
    emoji: '🐦',
    title: 'Birdie Machine',
    description: `${winners.map((w) => w.name).join(' & ')} made ${top} birdies`,
    golferNames: winners.map((w) => w.name),
    value: top,
  };
};

/* 6 — Longest Par Streak */
const genParStreak = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  const data = golfers
    .map((g) => {
      let max = 0;
      let cur = 0;
      g.scores.forEach((s, i) => {
        if (s.strokes && s.strokes <= pars[i]) {
          cur++;
          max = Math.max(max, cur);
        } else {
          cur = 0;
        }
      });
      return { name: g.name, streak: max };
    })
    .filter((d) => d.streak >= 5)
    .sort((a, b) => b.streak - a.streak);

  if (!data.length) return null;
  const top = data[0].streak;
  const winners = data.filter((d) => d.streak === top);
  return {
    type: 'pars_streak',
    category: 'highlights',
    emoji: '🔥',
    title: 'On Fire',
    description: `${winners.map((w) => w.name).join(' & ')} went ${top} holes at par or better`,
    golferNames: winners.map((w) => w.name),
    value: top,
  };
};

/* 7 — Hole Difficulty Analysis */
const genHoleDifficulty = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  if (golfers.length < 2) return null;

  const stats: { hole: number; avg: number; toPar: number; par: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const valid = golfers
      .map((g) => g.scores[i]?.strokes)
      .filter((s): s is number => s != null && s > 0);
    if (valid.length < 2) continue;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    stats.push({
      hole: i + 1,
      avg: Math.round(avg * 100) / 100,
      toPar: Math.round((avg - pars[i]) * 100) / 100,
      par: pars[i],
    });
  }

  if (stats.length < 6) return null;
  const sorted = [...stats].sort((a, b) => b.toPar - a.toPar);
  const hardest = sorted[0];
  const easiest = sorted[sorted.length - 1];

  return {
    type: 'hole_difficulty',
    category: 'analysis',
    emoji: '📊',
    title: 'Course Intel',
    description: `#${hardest.hole} (par ${hardest.par}) was the group killer at +${hardest.toPar.toFixed(1)}. #${easiest.hole} (par ${easiest.par}) was friendliest at ${fmtToPar(+easiest.toPar.toFixed(1))}.`,
    details: [
      ...sorted.slice(0, 3).map((h, i) => ({
        label: `💀 #${i + 1} Hardest`,
        value: `Hole ${h.hole} (par ${h.par}) — avg ${h.avg.toFixed(1)} (+${h.toPar.toFixed(1)})`,
      })),
      ...sorted.slice(-3).reverse().map((h, i) => ({
        label: `✅ #${i + 1} Easiest`,
        value: `Hole ${h.hole} (par ${h.par}) — avg ${h.avg.toFixed(1)} (${fmtToPar(+h.toPar.toFixed(1))})`,
      })),
    ],
  };
};

/* 8 — Front 9 / Back 9 */
const genFrontBack = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  const splits = golfers
    .filter(
      (g) =>
        g.scores.length >= 18 &&
        g.scores.slice(9).some((s) => s.strokes)
    )
    .map((g) => {
      const front = g.scores
        .slice(0, 9)
        .reduce((s, sc) => s + (sc.strokes || 0), 0);
      const back = g.scores
        .slice(9, 18)
        .reduce((s, sc) => s + (sc.strokes || 0), 0);
      return { name: g.name, front, back, diff: back - front };
    });

  if (!splits.length) return null;

  const byDiff = [...splits].sort((a, b) => b.diff - a.diff);
  const collapse = byDiff[0];
  const comeback = byDiff[byDiff.length - 1];

  let desc = '';
  if (collapse.diff >= 4) {
    desc += `${collapse.name}: ${collapse.front}/${collapse.back} — faded on the back. `;
  }
  if (comeback.diff <= -4) {
    desc += `${comeback.name}: ${comeback.front}/${comeback.back} — surged on the back!`;
  }
  if (!desc) {
    const bestF = [...splits].sort((a, b) => a.front - b.front)[0];
    const bestB = [...splits].sort((a, b) => a.back - b.back)[0];
    desc = `Best front: ${bestF.name} (${bestF.front}). Best back: ${bestB.name} (${bestB.back}).`;
  }

  return {
    type: 'front_back',
    category: 'scoring',
    emoji: '↔️',
    title: 'Front vs. Back',
    description: desc.trim(),
    details: splits.map((s) => ({
      label: s.name,
      value: `${s.front} / ${s.back} (${s.diff > 0 ? '+' : ''}${s.diff})`,
    })),
  };
};

/* 9 — vs. Handicap */
const genVsHandicap = (
  golfers: GolferWithScores[],
  pars: number[],
  event: Event
): RoundRecapHighlight | null => {
  const totalPar = pars.reduce((s, p) => s + p, 0);
  const withHdcp = golfers.filter((g) => g.handicap != null && g.handicap > 0);
  if (!withHdcp.length) return null;

  const courseId = event.course?.courseId;
  const results = withHdcp.map((g) => {
    const ch = calcCourseHandicap(
      g.handicap!,
      courseId,
      g.teeName || event.course?.teeName
    );
    const expected = totalPar + ch;
    const actual = getTotalStrokes(g.scores);
    return { name: g.name, expected, actual, courseHdcp: ch, diff: actual - expected };
  });

  results.sort((a, b) => a.diff - b.diff);
  const best = results[0];
  const beatOrMissed =
    best.diff <= 0
      ? `beat their handicap by ${Math.abs(best.diff)}!`
      : `missed their handicap by ${best.diff}.`;

  return {
    type: 'vs_handicap',
    category: 'scoring',
    emoji: '🎯',
    title: 'vs. Handicap',
    description: `${best.name} shot ${best.actual} (expected ${best.expected}) — ${beatOrMissed}`,
    golferNames: [best.name],
    value: best.diff,
    details: results.map((r) => ({
      label: r.name,
      value: `Shot ${r.actual}, expected ${r.expected} (${r.diff > 0 ? '+' : ''}${r.diff})`,
    })),
  };
};

/* 10 — Scoring Distribution */
const genScoringDist = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  if (!golfers.length) return null;

  let eagles = 0;
  let birdies = 0;
  let parsC = 0;
  let bogeys = 0;
  let doubles = 0;
  let triples = 0;

  golfers.forEach((g) => {
    g.scores.forEach((s, i) => {
      if (!s.strokes) return;
      const diff = s.strokes - pars[i];
      if (diff <= -2) eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0) parsC++;
      else if (diff === 1) bogeys++;
      else if (diff === 2) doubles++;
      else triples++;
    });
  });

  const total = eagles + birdies + parsC + bogeys + doubles + triples;
  if (!total) return null;

  const parts: string[] = [];
  if (eagles) parts.push(`${eagles} eagle${eagles > 1 ? 's' : ''}`);
  if (birdies) parts.push(`${birdies} birdie${birdies > 1 ? 's' : ''}`);
  parts.push(`${parsC} par${parsC !== 1 ? 's' : ''}`);
  if (bogeys) parts.push(`${bogeys} bogey${bogeys > 1 ? 's' : ''}`);
  if (doubles) parts.push(`${doubles} double${doubles > 1 ? 's' : ''}`);
  if (triples) parts.push(`${triples} triple+`);

  return {
    type: 'scoring_dist',
    category: 'analysis',
    emoji: '📈',
    title: 'Scoring Breakdown',
    description: `Field totals: ${parts.join(', ')}`,
    details: [
      { label: '🦅 Eagles', value: `${eagles}` },
      { label: '🐦 Birdies', value: `${birdies}` },
      { label: '✅ Pars', value: `${parsC}` },
      { label: '🟡 Bogeys', value: `${bogeys}` },
      { label: '🟠 Doubles', value: `${doubles}` },
      { label: '🔴 Triple+', value: `${triples}` },
    ],
  };
};

/* 11 — Par 3/4/5 Performance */
const genParPerformance = (
  golfers: GolferWithScores[],
  pars: number[]
): RoundRecapHighlight | null => {
  if (!golfers.length) return null;

  const buckets: Record<number, { total: number; count: number }> = {};
  golfers.forEach((g) => {
    g.scores.forEach((s, i) => {
      if (!s.strokes) return;
      const p = pars[i];
      if (!buckets[p]) buckets[p] = { total: 0, count: 0 };
      buckets[p].total += s.strokes;
      buckets[p].count++;
    });
  });

  const entries = Object.entries(buckets)
    .map(([par, d]) => ({
      par: Number(par),
      avg: d.total / d.count,
      toPar: d.total / d.count - Number(par),
    }))
    .sort((a, b) => a.par - b.par);

  if (entries.length < 2) return null;
  const worst = [...entries].sort((a, b) => b.toPar - a.toPar)[0];

  return {
    type: 'par_performance',
    category: 'analysis',
    emoji: '⛳',
    title: 'Par Breakdown',
    description: `Par ${worst.par}s were toughest — group averaged ${worst.avg.toFixed(1)} (${fmtToPar(+worst.toPar.toFixed(1))})`,
    details: entries.map((e) => ({
      label: `Par ${e.par}s`,
      value: `Avg ${e.avg.toFixed(1)} (${fmtToPar(+e.toPar.toFixed(1))})`,
    })),
  };
};

/* 12 — Money Highlights (requires profiles) */
const genMoneyHighlights = (
  event: Event,
  golfers: GolferWithScores[],
  profiles: any[]
): RoundRecapHighlight[] => {
  const out: RoundRecapHighlight[] = [];

  try {
    const payouts = calculateEventPayouts(event, profiles);

    // Big winner / big loser
    const entries = Object.entries(payouts.totalByGolfer)
      .map(([gid, amt]) => ({ id: gid, name: getGolferName(event, gid), amount: amt }))
      .filter((e) => e.amount !== 0)
      .sort((a, b) => b.amount - a.amount);

    if (entries.length) {
      const winner = entries[0];
      const loser = entries[entries.length - 1];

      if (winner.amount > 0) {
        let desc = `${winner.name} walked away +$${winner.amount.toFixed(2)}`;
        if (loser.amount < 0)
          desc += `. ${loser.name} owes $${Math.abs(loser.amount).toFixed(2)}.`;

        out.push({
          type: 'money_winner',
          category: 'money',
          emoji: '💰',
          title: 'Big Winner',
          description: desc,
          golferNames: [winner.name],
          value: winner.amount,
          details: entries.map((e) => ({
            label: e.name,
            value: `${e.amount >= 0 ? '+' : '-'}$${Math.abs(e.amount).toFixed(2)}`,
          })),
        });
      }
    }

    // Skins detail
    const skinsResults = payouts.skins.filter(Boolean);
    if (skinsResults.length) {
      const skinsByGolfer: Record<string, number[]> = {};
      skinsResults.forEach((s) => {
        if (!s) return;
        Object.entries(s.winningHolesByGolfer).forEach(([gid, holes]) => {
          if (holes.length) {
            if (!skinsByGolfer[gid]) skinsByGolfer[gid] = [];
            skinsByGolfer[gid].push(...holes);
          }
        });
      });

      const skinEntries = Object.entries(skinsByGolfer)
        .map(([gid, holes]) => ({
          name: getGolferName(event, gid),
          holes,
          count: holes.length,
        }))
        .sort((a, b) => b.count - a.count);

      if (skinEntries.length && skinEntries[0].count > 0) {
        const top = skinEntries[0];
        out.push({
          type: 'skins',
          category: 'money',
          emoji: '🏅',
          title: 'Skins King',
          description: `${top.name} won ${top.count} skin${top.count > 1 ? 's' : ''} on hole${top.holes.length > 1 ? 's' : ''} ${top.holes.join(', ')}`,
          golferNames: [top.name],
          value: top.count,
          details: skinEntries.map((e) => ({
            label: e.name,
            value: `${e.count} skin${e.count !== 1 ? 's' : ''} (holes ${e.holes.join(', ')})`,
          })),
        });
      }
    }

    // Nassau detail
    if (payouts.nassau.length) {
      const nassauWinners: string[] = [];
      payouts.nassau.forEach((n) => {
        Object.entries(n.winningsByGolfer).forEach(([gid, amt]) => {
          if (amt > 0) nassauWinners.push(getGolferName(event, gid));
        });
      });
      const unique = [...new Set(nassauWinners)];
      if (unique.length) {
        out.push({
          type: 'team_winner',
          category: 'money',
          emoji: '🤝',
          title: 'Nassau Winners',
          description: `${unique.join(', ')} came out on top in the Nassau`,
          golferNames: unique,
        });
      }
    }
  } catch {
    // payout calculation may fail for incomplete data — skip
  }

  return out;
};

/** Fallback skins/nassau mentions when profiles aren't available */
const genLegacyGameHighlights = (
  event: Event,
  golfers: GolferWithScores[]
): RoundRecapHighlight[] => {
  const out: RoundRecapHighlight[] = [];

  const skinsConfigs = event.games.skins || [];
  if (skinsConfigs.length) {
    const skinsHoles: { hole: number; winner: string }[] = [];
    for (let h = 0; h < 18; h++) {
      const scores = golfers
        .map((g) => ({ name: g.name, strokes: g.scores[h]?.strokes }))
        .filter((s) => s.strokes && s.strokes > 0);
      if (!scores.length) continue;
      const min = Math.min(...scores.map((s) => s.strokes!));
      const winners = scores.filter((s) => s.strokes === min);
      if (winners.length === 1)
        skinsHoles.push({ hole: h + 1, winner: winners[0].name });
    }
    if (skinsHoles.length) {
      const counts: Record<string, number> = {};
      skinsHoles.forEach((s) => {
        counts[s.winner] = (counts[s.winner] || 0) + 1;
      });
      const topCount = Math.max(...Object.values(counts));
      const topNames = Object.entries(counts)
        .filter(([, c]) => c === topCount)
        .map(([n]) => n);
      out.push({
        type: 'skins',
        category: 'money',
        emoji: '💰',
        title: 'Skins King',
        description: `${topNames.join(' & ')} won ${topCount} skin${topCount > 1 ? 's' : ''} (${skinsHoles.length} total won)`,
        golferNames: topNames,
        value: topCount,
      });
    }
  }

  const nassau = event.games.nassau || [];
  if (nassau.length && nassau.some((n) => n.teams?.length)) {
    out.push({
      type: 'team_winner',
      category: 'money',
      emoji: '🤝',
      title: 'Team Match',
      description: 'Team match played — check payouts for results!',
    });
  }

  return out;
};

/* 13 — Highest Score (humor) */
const genHighScore = (
  golfers: GolferWithScores[],
  lowestScore: number
): RoundRecapHighlight | null => {
  if (golfers.length <= 2) return null;
  const sorted = [...golfers].sort(
    (a, b) => getTotalStrokes(a.scores) - getTotalStrokes(b.scores)
  );
  const high = sorted[sorted.length - 1];
  const score = getTotalStrokes(high.scores);
  if (score - lowestScore < 10) return null;

  const phrases = [
    'enjoyed the scenery',
    "got their money's worth",
    'played the most golf',
    'explored the course thoroughly',
  ];
  return {
    type: 'high_score',
    category: 'scoring',
    emoji: '🏌️',
    title: 'Course Explorer',
    description: `${high.name} ${phrases[Math.floor(Math.random() * phrases.length)]} with a ${score}`,
    golferNames: [high.name],
    value: score,
  };
};

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a full round recap.
 *
 * @param event    The event (completed or in-progress)
 * @param profiles Optional golfer profiles — enables detailed money highlights
 */
export const generateRoundRecap = (
  event: Event,
  profiles?: any[]
): RoundRecap => {
  const golfers = buildGolfersWithScores(event);
  const courseName = resolveCourseName(event);
  const pars = buildParArray(event);
  const totalPar = pars.reduce((s, p) => s + p, 0);

  if (!golfers.length) {
    return {
      eventName: event.name,
      courseName,
      date: event.date,
      highlights: [],
      summary: 'No scores recorded yet.',
      coursePar: totalPar,
    };
  }

  const highlights: RoundRecapHighlight[] = [];

  // ── Scoring ──────────────────────────────────────────────
  const lowScore = genLowScore(golfers, pars);
  if (lowScore) highlights.push(lowScore);

  const netWinner = genNetWinner(golfers, pars, event);
  if (netWinner) highlights.push(netWinner);

  // ── Highlights ───────────────────────────────────────────
  highlights.push(...genAces(golfers));

  const eagles = genEagles(golfers, pars);
  if (eagles) highlights.push(eagles);

  const birdies = genBirdies(golfers, pars);
  if (birdies) highlights.push(birdies);

  const parStreak = genParStreak(golfers, pars);
  if (parStreak) highlights.push(parStreak);

  // ── Analysis ─────────────────────────────────────────────
  const holeDiff = genHoleDifficulty(golfers, pars);
  if (holeDiff) highlights.push(holeDiff);

  const frontBack = genFrontBack(golfers, pars);
  if (frontBack) highlights.push(frontBack);

  const vsHdcp = genVsHandicap(golfers, pars, event);
  if (vsHdcp) highlights.push(vsHdcp);

  const parPerf = genParPerformance(golfers, pars);
  if (parPerf) highlights.push(parPerf);

  const scoringDist = genScoringDist(golfers, pars);
  if (scoringDist) highlights.push(scoringDist);

  // ── Money ────────────────────────────────────────────────
  if (profiles) {
    highlights.push(...genMoneyHighlights(event, golfers, profiles));
  } else {
    highlights.push(...genLegacyGameHighlights(event, golfers));
  }

  // ── Humor ────────────────────────────────────────────────
  const lowVal = lowScore ? (lowScore.value as number) : 0;
  const highScore = genHighScore(golfers, lowVal);
  if (highScore) highlights.push(highScore);

  // ── Build output ─────────────────────────────────────────
  const holesPlayed = Math.max(...golfers.map((g) => getHolesPlayed(g.scores)));

  return {
    eventName: event.name,
    courseName,
    date: event.date,
    highlights,
    summary: generateRecapSummary(event, highlights),
    coursePar: totalPar,
    holesPlayed,
  };
};

// ============================================================================
// Summary / Push Notification
// ============================================================================

const generateRecapSummary = (
  event: Event,
  highlights: RoundRecapHighlight[]
): string => {
  const lines: string[] = [`🏁 ${event.name} — Round Complete!`, ''];
  highlights.slice(0, 6).forEach((h) => {
    lines.push(`${h.emoji} ${h.title}: ${h.description}`);
  });
  if (highlights.length > 6) {
    lines.push(`...and ${highlights.length - 6} more highlights!`);
  }
  lines.push('', 'Check the app for full results! ⛳');
  return lines.join('\n');
};

export const generateRecapPushMessage = (
  recap: RoundRecap
): { title: string; body: string } => {
  const ace = recap.highlights.find((h) => h.type === 'aces');
  const lowScore = recap.highlights.find((h) => h.type === 'low_score');
  let body = '';
  if (ace) body = `🎯 ${ace.description}`;
  else if (lowScore) body = `${lowScore.emoji} ${lowScore.description}`;
  else body = 'Tap to see full results and highlights!';
  return { title: `🏁 ${recap.eventName} Complete!`, body };
};
