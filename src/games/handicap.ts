// Basic handicap stroke allocation utilities (future expansion for slope/rating)
import { Event } from '../state/store';
import { courseMap, courseTeesMap } from '../data/courses';

// Returns strokes to apply for a golfer on a given hole based on simple index (1 stroke every 18, repeating)
export function strokesForHole(event: Event, golferId: string, holeNumber: number, profiles: any[]): number {
  const golfer = event.golfers.find(g => g.profileId === golferId || g.customName === golferId);
  if (!golfer) return 0;
  
  // Get handicap index from profile or use override
  const handicapIndex = golfer.handicapOverride != null ? golfer.handicapOverride : 
    // Get from profile if available
    (golfer.profileId ? profiles.find(p => p.id === golfer.profileId)?.handicapIndex : null) ??
    0;
    
  if (handicapIndex == null) return 0;
  // Use course handicap (rounded) for strokes distribution
  const ch = courseHandicap(event, golferId, profiles);
  const hcap = Math.max(0, ch == null ? 0 : ch);
  const courseId = event.course.courseId;
  const def = courseId ? courseMap[courseId] : undefined;
  if (!def) {
    const base = Math.floor(hcap / 18);
    const remainder = hcap % 18;
    return base + (holeNumber <= remainder ? 1 : 0);
  }
  // Use strokeIndex ordering: holes with strokeIndex 1..remainder get the extra stroke
  const base = Math.floor(hcap / 18);
  const remainder = hcap % 18;
  const hole = def.holes.find(h => h.number === holeNumber);
  if (!hole || !hole.strokeIndex) return base; // if no stroke index treat as easier
  return base + (hole.strokeIndex <= remainder ? 1 : 0);
}

export function netScore(event: Event, golferId: string, holeNumber: number, gross: number | null, profiles: any[]): number | null {
  if (gross == null) return null;
  return gross - strokesForHole(event, golferId, holeNumber, profiles);
}

// Full WHS style course handicap approximation.
// Core formula (simplified for single round):
//   Course Handicap = round( HandicapIndex * (Slope / 113) + (Course Rating - Par) )
// When players use different tees in the same competition, apply an additional tee difference adjustment so that
// everyone competes on the same par / rating basis. Common approach (USGA): if tees have different course ratings,
// add (PlayerTeeRating - ReferenceTeeRating) to the calculation (already inherent if we use player's own (Rating - Par)).
// To keep equity when event uses a reference (event tee), we: compute base using player's tee (Slope & Rating - Par),
// then subtract (eventTee.courseRating - eventTee.par) so that reference tee players are unaffected and others gain / lose
// only the differential vs reference rating.
export function courseHandicap(event: Event, golferId: string, profiles: any[]): number | null {
  const golfer = event.golfers.find(g => g.profileId === golferId || g.customName === golferId);
  if (!golfer) return null;
  
  // Get handicap index from profile or use override
  const handicapIndex = golfer.handicapOverride != null ? golfer.handicapOverride : 
    // Get from profile if available
    (golfer.profileId ? profiles.find(p => p.id === golfer.profileId)?.handicapIndex : null);
    
  if (handicapIndex == null) return null;
  const courseId = event.course.courseId;
  if (!courseId) return Math.round(handicapIndex); // fallback
  const teesDef = courseTeesMap[courseId];
  if (!teesDef) return Math.round(handicapIndex);
  const eventTeeName = event.course.teeName || teesDef.tees[0]?.name;
  const eventTee = teesDef.tees.find(t => t.name === eventTeeName);
  const golferTeeName = golfer.teeName || eventTeeName;
  const golferTee = teesDef.tees.find(t => t.name === golferTeeName) || eventTee;
  if (!eventTee || !golferTee) return Math.round(handicapIndex);
  const slope = golferTee.slopeRating;
  const playerRatingMinusPar = golferTee.courseRating - golferTee.par; // (Rating - Par) for player's tee
  const referenceRatingMinusPar = eventTee.courseRating - eventTee.par; // baseline reference
  // Base WHS for player's tee
  let raw = handicapIndex * (slope / 113) + playerRatingMinusPar;
  // Normalize relative to reference so reference tee users keep exact WHS result, others adjust by rating difference
  raw -= referenceRatingMinusPar;
  return Math.round(raw);
}
