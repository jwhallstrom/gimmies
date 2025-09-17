// World Handicap System (WHS) Utilities
import { courseMap, courseTeesMap } from '../data/courses';
import { IndividualRound, WHSCalculation, ScoreEntry } from '../types/handicap';

/**
 * Calculate course handicap from handicap index
 * Formula: (Handicap Index × Slope Rating) ÷ 113 + (Course Rating - Par)
 */
export function calculateCourseHandicap(
  handicapIndex: number, 
  slopeRating: number, 
  courseRating: number, 
  par: number
): number {
  const courseHandicap = Math.round((handicapIndex * slopeRating) / 113 + (courseRating - par));
  return Math.max(0, courseHandicap); // Cannot be negative
}

/**
 * Calculate score differential
 * Formula: (Adjusted Gross Score - Course Rating) × 113 ÷ Slope Rating
 */
export function calculateScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  return Number(((adjustedGrossScore - courseRating) * 113 / slopeRating).toFixed(1));
}

/**
 * Apply ESC (Equitable Stroke Control) adjustments
 * Caps hole scores based on course handicap
 */
export function applyESCAdjustment(strokes: number, par: number, handicapStrokes: number): number {
  const maxScore = par + 2 + Math.max(0, handicapStrokes); // Net double bogey
  return Math.min(strokes, maxScore);
}

/**
 * Distribute handicap strokes across holes
 * Uses stroke index (1 = hardest hole gets first stroke)
 */
export function distributeHandicapStrokes(courseHandicap: number, courseId: string): Record<number, number> {
  const course = courseMap[courseId];
  if (!course) return {};

  const distribution: Record<number, number> = {};
  
  course.holes.forEach(hole => {
    // Calculate strokes for this hole
    const fullRounds = Math.floor(courseHandicap / 18);
    const remainingStrokes = courseHandicap % 18;
    
    let strokesForHole = fullRounds;
    if (hole.strokeIndex <= remainingStrokes) {
      strokesForHole += 1;
    }
    
    distribution[hole.number] = strokesForHole;
  });
  
  return distribution;
}

/**
 * Calculate net score for a hole
 */
export function calculateNetScore(grossStrokes: number, handicapStrokes: number): number {
  return Math.max(0, grossStrokes - handicapStrokes);
}

/**
 * Process hole-by-hole scores with handicap calculations
 */
export function processScores(
  holeScores: { hole: number; strokes: number | null }[],
  courseId: string,
  courseHandicap: number
): ScoreEntry[] {
  const course = courseMap[courseId];
  if (!course) return [];

  const strokeDistribution = distributeHandicapStrokes(courseHandicap, courseId);
  
  return course.holes.map(hole => {
    const scoreEntry = holeScores.find(s => s.hole === hole.number);
    const grossStrokes = scoreEntry?.strokes || null;
    const handicapStrokes = strokeDistribution[hole.number] || 0;
    
    return {
      hole: hole.number,
      par: hole.par,
      strokes: grossStrokes,
      handicapStrokes,
      netStrokes: grossStrokes ? calculateNetScore(grossStrokes, handicapStrokes) : undefined
    };
  });
}

/**
 * Calculate WHS Handicap Index from recent score differentials
 * Uses best 8 of most recent 20 scores (or adjusted for fewer rounds)
 */
export function calculateWHSHandicapIndex(input: number[] | { id: string; differential: number }[]): WHSCalculation {
  // Normalize input to array of objects with id and differential
  const entries: { id: string; differential: number }[] = Array.isArray(input) && typeof input[0] === 'number'
    ? (input as number[]).map((d, i) => ({ id: `r${i}`, differential: d }))
    : (input as { id: string; differential: number }[]);

  // Sort by differential (lowest first) but keep ids
  const sorted = [...entries].sort((a, b) => a.differential - b.differential);
  const roundCount = sorted.length;
  const sortedDifferentials = sorted.map(s => s.differential);
  
  let roundsToUse: number;
  let handicapIndex: number;
  let usedIds: string[] = [];
  
  if (roundCount < 3) {
    // Need at least 3 rounds
    handicapIndex = 0;
    roundsToUse = 0;
  } else if (roundCount <= 5) {
    // Use lowest differential minus 2
    handicapIndex = Math.max(0, sortedDifferentials[0] - 2);
    roundsToUse = 1;
  } else if (roundCount === 6) {
    // Average of 2 lowest minus 1
    const avg = (sortedDifferentials[0] + sortedDifferentials[1]) / 2;
    handicapIndex = Math.max(0, avg - 1);
    roundsToUse = 2;
  } else if (roundCount <= 8) {
    // Average of 2 lowest
    handicapIndex = (sortedDifferentials[0] + sortedDifferentials[1]) / 2;
    roundsToUse = 2;
  } else if (roundCount <= 11) {
    // Average of 3 lowest
    handicapIndex = (sortedDifferentials[0] + sortedDifferentials[1] + sortedDifferentials[2]) / 3;
    roundsToUse = 3;
  } else if (roundCount <= 14) {
    // Average of 4 lowest
    handicapIndex = sortedDifferentials.slice(0, 4).reduce((sum: number, d: number) => sum + d, 0) / 4;
    roundsToUse = 4;
  } else if (roundCount <= 16) {
    // Average of 5 lowest
    handicapIndex = sortedDifferentials.slice(0, 5).reduce((sum: number, d: number) => sum + d, 0) / 5;
    roundsToUse = 5;
  } else if (roundCount <= 18) {
    // Average of 6 lowest
    handicapIndex = sortedDifferentials.slice(0, 6).reduce((sum: number, d: number) => sum + d, 0) / 6;
    roundsToUse = 6;
  } else if (roundCount === 19) {
    // Average of 7 lowest
    handicapIndex = sortedDifferentials.slice(0, 7).reduce((sum: number, d: number) => sum + d, 0) / 7;
    roundsToUse = 7;
  } else {
    // 20+ rounds: Average of 8 lowest from most recent 20
    const recent20 = entries.slice(-20).map(e => e.differential);
    const sorted20 = [...recent20].sort((a, b) => a - b);
    handicapIndex = sorted20.slice(0, 8).reduce((sum: number, d: number) => sum + d, 0) / 8;
    roundsToUse = 8;
  }
  
  // Round to 1 decimal place
  handicapIndex = Math.round(handicapIndex * 10) / 10;

  // Determine which specific round ids were used (take lowest N from the most recent window when needed)
  if (roundCount >= 20) {
    const recent20 = entries.slice(-20);
    const sorted20 = [...recent20].sort((a, b) => a.differential - b.differential);
    usedIds = sorted20.slice(0, roundsToUse).map(e => e.id);
  } else {
    usedIds = sorted.slice(0, roundsToUse).map(e => e.id);
  }

  return {
    handicapIndex,
    differentials: sorted.map(s => s.differential),
    roundsUsed: roundsToUse,
    usedRoundIds: usedIds,
    calculationDate: new Date().toISOString()
  };
}

/**
 * Get course and tee info for calculations
 */
export function getCourseInfo(courseId: string, teeName: string) {
  const courseTees = courseTeesMap[courseId];
  const course = courseMap[courseId];
  
  if (!courseTees || !course) {
    throw new Error(`Course ${courseId} not found`);
  }
  
  const tee = courseTees.tees.find(t => t.name === teeName);
  if (!tee) {
    throw new Error(`Tee ${teeName} not found for course ${courseId}`);
  }
  
  return { course, tee, courseTees };
}