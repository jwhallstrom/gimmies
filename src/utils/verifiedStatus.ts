/**
 * Verified Status System - Utilities
 * 
 * Gamification framework to combat sandbagging and vanity handicaps.
 * Users earn status by playing verified events with other users.
 */

import { STATUS_TIERS, StatusTier, VerifiedStatus, Event, GolferProfile } from '../state/types';

const EARNABLE_STATUS_TIERS = STATUS_TIERS.filter(t => !t.isManualOnly);
const FOUNDER_TIER_LEVEL = 5;

/**
 * Manual founder assignments by Cognito user ID.
 * These accounts always resolve to Founder tier in UI.
 */
const FOUNDER_USER_IDS = new Set<string>([
  '24385478-1001-7004-3901-76637abafc12',
  'e42844b8-70b1-70b7-c400-dec832f98821'
]);

/**
 * Optional fallback by email to handle legacy profile records.
 */
const FOUNDER_EMAILS = new Set<string>([
  'victory7500@hotmail.com',
  'jwhallstrom@gmail.com'
]);

// ============================================================================
// Status Calculation
// ============================================================================

/**
 * Get the status tier for a given number of verified rounds
 */
export function getStatusTier(verifiedRounds: number): StatusTier {
  // Find the highest tier the user qualifies for
  for (let i = EARNABLE_STATUS_TIERS.length - 1; i >= 0; i--) {
    if (verifiedRounds >= EARNABLE_STATUS_TIERS[i].minRounds) {
      return EARNABLE_STATUS_TIERS[i];
    }
  }
  return EARNABLE_STATUS_TIERS[0];
}

/**
 * Get status tier by level number
 */
export function getStatusTierByLevel(level: number): StatusTier {
  return STATUS_TIERS[level] || STATUS_TIERS[0];
}

/**
 * True when a profile belongs to a manually designated founder account.
 */
export function isFounderProfile(profile: GolferProfile | undefined): boolean {
  if (!profile) return false;

  if (profile.userId && FOUNDER_USER_IDS.has(profile.userId)) {
    return true;
  }

  const email = profile.email?.trim().toLowerCase();
  return !!email && FOUNDER_EMAILS.has(email);
}

/**
 * Returns verified status with manual founder overrides applied.
 */
export function getEffectiveVerifiedStatus(profile: GolferProfile | undefined): VerifiedStatus {
  const base = profile?.verifiedStatus || {
    verifiedRounds: 0,
    statusLevel: 0,
    badges: []
  };

  if (!isFounderProfile(profile)) {
    return base;
  }

  const badges = base.badges.includes('founder')
    ? base.badges
    : [...base.badges, 'founder'];

  return {
    ...base,
    statusLevel: FOUNDER_TIER_LEVEL,
    badges
  };
}

/**
 * Calculate progress to next tier
 */
export function getProgressToNextTier(verifiedRounds: number): {
  currentTier: StatusTier;
  nextTier: StatusTier | null;
  roundsToNext: number;
  progressPercent: number;
} {
  const currentTier = getStatusTier(verifiedRounds);
  const currentEarnableTierIndex = EARNABLE_STATUS_TIERS.findIndex((t) => t.level === currentTier.level);
  const nextTierIndex = currentEarnableTierIndex + 1;
  
  if (nextTierIndex >= EARNABLE_STATUS_TIERS.length) {
    // Already at max level
    return {
      currentTier,
      nextTier: null,
      roundsToNext: 0,
      progressPercent: 100
    };
  }
  
  const nextTier = EARNABLE_STATUS_TIERS[nextTierIndex];
  const roundsToNext = nextTier.minRounds - verifiedRounds;
  const tierRange = nextTier.minRounds - currentTier.minRounds;
  const progressInTier = verifiedRounds - currentTier.minRounds;
  const progressPercent = Math.min(100, Math.round((progressInTier / tierRange) * 100));
  
  return {
    currentTier,
    nextTier,
    roundsToNext,
    progressPercent
  };
}

// ============================================================================
// Event Verification Logic
// ============================================================================

/**
 * Check if an event qualifies as a "verified round"
 * Criteria:
 * 1. Event is completed
 * 2. At least 2 players with profiles (not custom names)
 * 3. All players have at least Level 1 status (or we're bootstrapping)
 * 4. Scores were entered through the app (not manual handicap entry)
 * 5. Event is not a group (hubType !== 'group')
 */
export function checkEventVerification(
  event: Event,
  profiles: GolferProfile[]
): { isVerified: boolean; reason: string } {
  // Must be an event, not a group
  if (event.hubType === 'group') {
    return { isVerified: false, reason: 'Groups do not count as verified rounds' };
  }
  
  // Must be completed
  if (!event.isCompleted) {
    return { isVerified: false, reason: 'Event not yet completed' };
  }
  
  // Count players with linked profiles
  const playersWithProfiles = event.golfers.filter(g => g.profileId);
  if (playersWithProfiles.length < 2) {
    return { isVerified: false, reason: 'Need at least 2 players with profiles' };
  }
  
  // Check if scores were entered (at least some holes played)
  const scorecards = event.scorecards || [];
  const playersWithScores = scorecards.filter(sc => {
    const scores = sc.scores || [];
    return scores.some(s => s.strokes !== null && s.strokes !== undefined);
  });
  
  if (playersWithScores.length < 2) {
    return { isVerified: false, reason: 'Need at least 2 players with scores entered' };
  }
  
  // Bootstrap mode: For the first rounds, we don't require Level 1 status
  // After a user has 5+ rounds, we require all participants to be Level 1+
  // This prevents new users from being locked out
  const allParticipantProfiles = playersWithProfiles
    .map(g => profiles.find(p => p.id === g.profileId))
    .filter((p): p is GolferProfile => p !== undefined);
  
  // Check if this is a "high-stakes" verified round (all Level 1+)
  const allVerified = allParticipantProfiles.every(p => {
    const status = p.verifiedStatus || { verifiedRounds: 0, statusLevel: 0 };
    return status.statusLevel >= 1;
  });
  
  // For now, allow all completed events with 2+ profiled players
  // In Phase 2, we can be stricter about requiring Level 1+ participants
  
  return { 
    isVerified: true, 
    reason: allVerified 
      ? 'All participants verified (Level 1+)' 
      : 'Bootstrap mode - building verified status'
  };
}

/**
 * Calculate updated status after completing a verified round
 */
export function calculateNewStatus(
  currentStatus: VerifiedStatus | undefined,
  eventId: string
): { 
  newStatus: VerifiedStatus; 
  leveledUp: boolean; 
  newTier?: StatusTier;
  oldTier?: StatusTier;
} {
  const current: VerifiedStatus = currentStatus || {
    verifiedRounds: 0,
    statusLevel: 0,
    badges: []
  };
  
  const oldTier = getStatusTierByLevel(current.statusLevel);
  const newRounds = current.verifiedRounds + 1;
  const newTier = getStatusTier(newRounds);
  const leveledUp = newTier.level > current.statusLevel;
  
  // Build new badges
  const badges = [...current.badges];
  
  // First verified round badge
  if (newRounds === 1 && !badges.includes('first_verified')) {
    badges.push('first_verified');
  }
  
  // Level up badges
  if (leveledUp && !badges.includes(newTier.name.toLowerCase().replace(/\s+/g, '_'))) {
    badges.push(newTier.name.toLowerCase().replace(/\s+/g, '_'));
  }
  
  // Milestone badges
  if (newRounds === 10 && !badges.includes('milestone_10')) {
    badges.push('milestone_10');
  }
  if (newRounds === 25 && !badges.includes('milestone_25')) {
    badges.push('milestone_25');
  }
  if (newRounds === 50 && !badges.includes('milestone_50')) {
    badges.push('milestone_50');
  }
  if (newRounds === 100 && !badges.includes('milestone_100')) {
    badges.push('milestone_100');
  }
  
  const newStatus: VerifiedStatus = {
    ...current,
    verifiedRounds: newRounds,
    statusLevel: newTier.level,
    badges,
    lastVerifiedEventId: eventId,
    lastVerifiedEventDate: new Date().toISOString()
  };
  
  return {
    newStatus,
    leveledUp,
    newTier: leveledUp ? newTier : undefined,
    oldTier: leveledUp ? oldTier : undefined
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get display info for a user's verified status
 */
export function getStatusDisplay(profile: GolferProfile | undefined): {
  tier: StatusTier;
  verifiedRounds: number;
  isHandicapVerified: boolean;
  label: string;
} {
  const status = getEffectiveVerifiedStatus(profile);
  const tier = getStatusTierByLevel(status.statusLevel);
  
  return {
    tier,
    verifiedRounds: status.verifiedRounds,
    isHandicapVerified: tier.level >= 2, // Birdie Boss or higher
    label: `${tier.emoji} ${tier.name}`
  };
}

/**
 * Format handicap with verification indicator
 */
export function formatVerifiedHandicap(
  handicap: number | undefined,
  profile: GolferProfile | undefined
): { value: string; isVerified: boolean; badge: string } {
  const display = getStatusDisplay(profile);
  const value = handicap !== undefined ? handicap.toFixed(1) : '-';
  
  return {
    value,
    isVerified: display.isHandicapVerified,
    badge: display.isHandicapVerified ? '✓' : '~'
  };
}

/**
 * Get badge display info
 */
export function getBadgeInfo(badgeId: string): { name: string; emoji: string; description: string } {
  const badges: Record<string, { name: string; emoji: string; description: string }> = {
    first_verified: { name: 'First Steps', emoji: '👣', description: 'Completed your first verified round' },
    provisional_member: { name: 'Provisional Member', emoji: '🏌️', description: 'Started your golf journey' },
    club_member: { name: 'Club Member', emoji: '⭐', description: 'Reached Foundation Level' },
    platinum_contender: { name: 'Platinum Contender', emoji: '💎', description: 'Reached Established Level' },
    elite_member: { name: 'Elite Member', emoji: '🦅', description: 'Reached Elite Level' },
    gold_jacket: { name: 'Gold Jacket', emoji: '🧥', description: 'Achieved Hall of Fame status' },
    founder: { name: 'Founder', emoji: '\u{1F451}', description: 'Reserved platform architect status' },
    milestone_10: { name: '10 Rounds', emoji: '🔟', description: '10 verified rounds played' },
    milestone_25: { name: '25 Rounds', emoji: '🎯', description: '25 verified rounds played' },
    milestone_50: { name: '50 Rounds', emoji: '🌟', description: '50 verified rounds played' },
    milestone_100: { name: 'Century Club', emoji: '💯', description: '100 verified rounds played' },
    streak_5: { name: 'Hot Streak', emoji: '🔥', description: '5 weeks in a row with verified play' }
  };
  
  return badges[badgeId] || { name: badgeId, emoji: '🏷️', description: 'Achievement unlocked' };
}

