/**
 * Round Recap Generator
 * 
 * Generates fun, shareable round recap highlights:
 * - Lowest score
 * - Team winners
 * - Skins locations
 * - Most birdies
 * - Most pars in a row
 * - Highest score (with humor)
 * 
 * No $$ amounts - users check payouts screen for that
 */

import type { Event, PlayerScorecard, ScoreEntry } from '../state/types';

export interface RoundRecapHighlight {
  type: 'low_score' | 'team_winner' | 'skins' | 'birdies' | 'pars_streak' | 'high_score' | 'eagles' | 'aces';
  emoji: string;
  title: string;
  description: string;
  golferNames?: string[];
  value?: number | string;
}

export interface RoundRecap {
  eventName: string;
  courseName: string;
  date: string;
  highlights: RoundRecapHighlight[];
  summary: string;
}

// Helper type for golfer data with scores
interface GolferWithScores {
  id: string;
  name: string;
  scores: ScoreEntry[];
}

/**
 * Get golfer name from event
 */
const getGolferName = (event: Event, golferId: string): string => {
  const golfer = event.golfers.find(g => 
    (g.profileId === golferId) || (g.customName === golferId)
  );
  return golfer?.displayName || golfer?.customName || golferId.slice(0, 8);
};

/**
 * Build golfers with scores array from event
 */
const buildGolfersWithScores = (event: Event): GolferWithScores[] => {
  return event.scorecards
    .filter(sc => sc.scores.length > 0)
    .map(sc => ({
      id: sc.golferId,
      name: getGolferName(event, sc.golferId),
      scores: sc.scores,
    }));
};

/**
 * Calculate total strokes for a scorecard
 */
const getTotalStrokes = (scores: ScoreEntry[]): number => {
  return scores.reduce((sum: number, s: ScoreEntry) => sum + (s.strokes || 0), 0);
};

/**
 * Count birdies (or better) for a scorecard
 */
const countBirdiesOrBetter = (scores: ScoreEntry[], pars: number[]): number => {
  let count = 0;
  scores.forEach((score: ScoreEntry, i: number) => {
    const par = pars[i] || 4;
    if (score.strokes && score.strokes < par) {
      count++;
    }
  });
  return count;
};

/**
 * Count eagles for a scorecard
 */
const countEagles = (scores: ScoreEntry[], pars: number[]): number => {
  let count = 0;
  scores.forEach((score: ScoreEntry, i: number) => {
    const par = pars[i] || 4;
    if (score.strokes && score.strokes <= par - 2) {
      count++;
    }
  });
  return count;
};

/**
 * Find longest streak of pars (or better)
 */
const getLongestParStreak = (scores: ScoreEntry[], pars: number[]): number => {
  let maxStreak = 0;
  let currentStreak = 0;
  
  scores.forEach((score: ScoreEntry, i: number) => {
    const par = pars[i] || 4;
    if (score.strokes && score.strokes <= par) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });
  
  return maxStreak;
};

/**
 * Check for hole-in-ones
 */
const getHoleInOnes = (scores: ScoreEntry[]): number[] => {
  const holes: number[] = [];
  scores.forEach((score: ScoreEntry, i: number) => {
    if (score.strokes === 1) {
      holes.push(i + 1);
    }
  });
  return holes;
};

/**
 * Generate round recap highlights
 */
export const generateRoundRecap = (event: Event): RoundRecap => {
  const highlights: RoundRecapHighlight[] = [];
  const golfers = buildGolfersWithScores(event);
  
  // Get course name - would need to look up by courseId in production
  const courseName = event.course?.courseId ? 'the course' : 'the course';
  
  if (golfers.length === 0) {
    return {
      eventName: event.name,
      courseName,
      date: event.date,
      highlights: [],
      summary: 'No scores recorded yet.',
    };
  }
  
  // Get par array (default to 4 if not available)
  const pars = Array(18).fill(4); // Default pars - could be enhanced with course data
  const totalPar = pars.reduce((sum: number, p: number) => sum + p, 0);
  
  // 1. Lowest Score
  const sortedByScore = [...golfers].sort((a, b) => getTotalStrokes(a.scores) - getTotalStrokes(b.scores));
  const lowestScore = getTotalStrokes(sortedByScore[0].scores);
  const lowScorers = sortedByScore.filter(g => getTotalStrokes(g.scores) === lowestScore);
  
  const scoreToPar = lowestScore - totalPar;
  const scoreString = scoreToPar === 0 ? 'E' : scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
  
  highlights.push({
    type: 'low_score',
    emoji: '🏆',
    title: 'Low Round',
    description: `${lowScorers.map(g => g.name).join(' & ')} shot ${lowestScore} (${scoreString})`,
    golferNames: lowScorers.map(g => g.name),
    value: lowestScore,
  });
  
  // 2. Hole-in-ones (Aces!)
  golfers.forEach(golfer => {
    const aces = getHoleInOnes(golfer.scores);
    if (aces.length > 0) {
      highlights.push({
        type: 'aces',
        emoji: '🎯',
        title: 'ACE!',
        description: `${golfer.name} holed out on ${aces.map(h => `#${h}`).join(', ')}!`,
        golferNames: [golfer.name],
        value: aces.join(', '),
      });
    }
  });
  
  // 3. Eagles
  const eagleMakers = golfers
    .map(g => ({ name: g.name, eagles: countEagles(g.scores, pars) }))
    .filter(g => g.eagles > 0)
    .sort((a, b) => b.eagles - a.eagles);
  
  if (eagleMakers.length > 0) {
    const topEagles = eagleMakers[0].eagles;
    const eaglers = eagleMakers.filter(g => g.eagles === topEagles);
    highlights.push({
      type: 'eagles',
      emoji: '🦅',
      title: eaglers.length > 1 ? 'Eagles Landed' : 'Eagle Alert',
      description: `${eaglers.map(g => g.name).join(' & ')} made ${topEagles} eagle${topEagles > 1 ? 's' : ''}`,
      golferNames: eaglers.map(g => g.name),
      value: topEagles,
    });
  }
  
  // 4. Most Birdies
  const birdieLeaders = golfers
    .map(g => ({ name: g.name, birdies: countBirdiesOrBetter(g.scores, pars) }))
    .filter(g => g.birdies > 0)
    .sort((a, b) => b.birdies - a.birdies);
  
  if (birdieLeaders.length > 0 && birdieLeaders[0].birdies >= 2) {
    const topBirdies = birdieLeaders[0].birdies;
    const birders = birdieLeaders.filter(g => g.birdies === topBirdies);
    highlights.push({
      type: 'birdies',
      emoji: '🐦',
      title: 'Birdie Machine',
      description: `${birders.map(g => g.name).join(' & ')} made ${topBirdies} birdies (or better)`,
      golferNames: birders.map(g => g.name),
      value: topBirdies,
    });
  }
  
  // 5. Longest Par Streak
  const parStreaks = golfers
    .map(g => ({ name: g.name, streak: getLongestParStreak(g.scores, pars) }))
    .filter(g => g.streak >= 5) // Only show if 5+ holes
    .sort((a, b) => b.streak - a.streak);
  
  if (parStreaks.length > 0) {
    const topStreak = parStreaks[0].streak;
    const streakers = parStreaks.filter(g => g.streak === topStreak);
    highlights.push({
      type: 'pars_streak',
      emoji: '🔥',
      title: 'On Fire',
      description: `${streakers.map(g => g.name).join(' & ')} went ${topStreak} holes at par or better`,
      golferNames: streakers.map(g => g.name),
      value: topStreak,
    });
  }
  
  // 6. Skins (if enabled and any won)
  const skinsConfigs = event.games.skins || [];
  if (skinsConfigs.length > 0) {
    const skinsHoles: { hole: number; winner: string }[] = [];
    
    // Find holes where skins were won
    for (let hole = 0; hole < 18; hole++) {
      const holeScores = golfers
        .map(g => ({ name: g.name, strokes: g.scores[hole]?.strokes }))
        .filter(g => g.strokes && g.strokes > 0);
      
      if (holeScores.length > 0) {
        const minScore = Math.min(...holeScores.map(h => h.strokes!));
        const winners = holeScores.filter(h => h.strokes === minScore);
        if (winners.length === 1) {
          skinsHoles.push({ hole: hole + 1, winner: winners[0].name });
        }
      }
    }
    
    if (skinsHoles.length > 0) {
      // Count skins per person
      const skinCounts: Record<string, number> = {};
      skinsHoles.forEach(s => {
        skinCounts[s.winner] = (skinCounts[s.winner] || 0) + 1;
      });
      
      const topSkinCount = Math.max(...Object.values(skinCounts));
      const topSkinners = Object.entries(skinCounts)
        .filter(([, count]) => count === topSkinCount)
        .map(([name]) => name);
      
      highlights.push({
        type: 'skins',
        emoji: '💰',
        title: 'Skins King',
        description: `${topSkinners.join(' & ')} won ${topSkinCount} skin${topSkinCount > 1 ? 's' : ''} (${skinsHoles.length} total won)`,
        golferNames: topSkinners,
        value: topSkinCount,
      });
    }
  }
  
  // 7. Team Winners (Nassau)
  const nassauConfigs = event.games.nassau || [];
  if (nassauConfigs.length > 0 && nassauConfigs.some(n => n.teams && n.teams.length > 0)) {
    const teamCount = nassauConfigs.reduce((sum, n) => sum + (n.teams?.length || 0), 0);
    highlights.push({
      type: 'team_winner',
      emoji: '🤝',
      title: 'Team Match',
      description: `${teamCount} team${teamCount > 1 ? 's' : ''} battled it out - check payouts for results!`,
    });
  }
  
  // 8. Highest Score (with humor - optional, only if gap is significant)
  if (sortedByScore.length > 2) {
    const highestScore = getTotalStrokes(sortedByScore[sortedByScore.length - 1].scores);
    const highScorer = sortedByScore[sortedByScore.length - 1];
    
    // Only show if there's a decent gap (10+ strokes from low)
    if (highestScore - lowestScore >= 10) {
      const funPhrases = [
        'enjoyed the scenery',
        'got their money\'s worth',
        'played the most golf',
        'explored the course thoroughly',
      ];
      const phrase = funPhrases[Math.floor(Math.random() * funPhrases.length)];
      
      highlights.push({
        type: 'high_score',
        emoji: '🏌️',
        title: 'Course Explorer',
        description: `${highScorer.name} ${phrase} with a ${highestScore}`,
        golferNames: [highScorer.name],
        value: highestScore,
      });
    }
  }
  
  // Generate summary
  const summary = generateRecapSummary(event, highlights);
  
  return {
    eventName: event.name,
    courseName,
    date: event.date,
    highlights,
    summary,
  };
};

/**
 * Generate a text summary for notifications
 */
const generateRecapSummary = (event: Event, highlights: RoundRecapHighlight[]): string => {
  const lines: string[] = [];
  
  lines.push(`🏁 ${event.name} - Round Complete!`);
  lines.push('');
  
  highlights.slice(0, 5).forEach(h => {
    lines.push(`${h.emoji} ${h.title}: ${h.description}`);
  });
  
  if (highlights.length > 5) {
    lines.push(`...and ${highlights.length - 5} more highlights!`);
  }
  
  lines.push('');
  lines.push('Check the app for full results! ⛳');
  
  return lines.join('\n');
};

/**
 * Generate a short push notification message
 */
export const generateRecapPushMessage = (recap: RoundRecap): { title: string; body: string } => {
  const lowScore = recap.highlights.find(h => h.type === 'low_score');
  const ace = recap.highlights.find(h => h.type === 'aces');
  
  let body = '';
  
  if (ace) {
    body = `🎯 ${ace.description}`;
  } else if (lowScore) {
    body = `${lowScore.emoji} ${lowScore.description}`;
  } else {
    body = 'Tap to see full results and highlights!';
  }
  
  return {
    title: `🏁 ${recap.eventName} Complete!`,
    body,
  };
};
