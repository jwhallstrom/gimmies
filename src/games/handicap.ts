// Handicap utilities using cloud-backed course/tee data.
import { Event } from '../state/store';
import { getCourseById, getTee } from '../data/cloudCourses';

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
  const tee = getTee(courseId, event.course.teeName);
  const base = Math.floor(hcap / 18);
  const remainder = hcap % 18;
  const hole = tee?.holes?.find(h => h.number === holeNumber);
  if (!hole || !hole.strokeIndex) return base;
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
  if (!courseId) return Math.round(handicapIndex);
  const course = getCourseById(courseId);
  if (!course || !course.tees?.length) return Math.round(handicapIndex);
  const eventTee = getTee(courseId, event.course.teeName) || course.tees[0];
  const golferTeeName = golfer.teeName || eventTee?.name;
  const golferTee = getTee(courseId, golferTeeName) || eventTee;
  if (!eventTee || !golferTee) return Math.round(handicapIndex);
  const slope = (golferTee.slopeRating ?? golferTee.slope ?? 113) || 113;
  const courseRating = (golferTee.courseRating ?? golferTee.rating ?? null);
  const eventRating = (eventTee.courseRating ?? eventTee.rating ?? null);
  const playerPar = golferTee.par ?? 72;
  const eventPar = eventTee.par ?? 72;
  const playerRatingMinusPar = (courseRating != null ? courseRating : eventPar) - playerPar;
  const referenceRatingMinusPar = (eventRating != null ? eventRating : eventPar) - eventPar;
  // Base WHS for player's tee
  let raw = handicapIndex * (slope / 113) + playerRatingMinusPar;
  // Normalize relative to reference so reference tee users keep exact WHS result, others adjust by rating difference
  raw -= referenceRatingMinusPar;
  return Math.round(raw);
}
