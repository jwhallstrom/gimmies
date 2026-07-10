/**
 * Handicap Slice
 * Handles individual rounds and WHS handicap calculations
 */

import { nanoid } from 'nanoid/non-secure';
import { getCourseById } from '../../data/cloudCourses';
import { 
  calculateWHSHandicapIndex, 
  distributeHandicapStrokes, 
  applyESCAdjustment, 
  calculateScoreDifferential,
  getTeeRatings,
  recomputeRoundDifferential,
  isRoundEligibleForHandicapIndex,
} from '../../utils/handicap';
import type { 
  GolferProfile, 
  CompletedRound,
  IndividualRound, 
  CombinedRound 
} from '../types';
import { ScoreEntry as HandicapScoreEntry } from '../../types/handicap';

const getRoundTimestamp = (round: IndividualRound): number =>
  new Date(round.createdAt || round.date || 0).getTime();
const sanitizeIdPart = (value: string) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_');
const buildIndividualRoundId = (eventId: string, profileId: string) => `ir-${sanitizeIdPart(eventId)}-${sanitizeIdPart(profileId)}`;

const getRoundDedupKey = (round: IndividualRound): string => {
  if (round.eventId) return `event:${round.eventId}:${round.profileId}`;
  if (round.completedRoundId) return `completed:${round.completedRoundId}`;
  return `manual:${round.date}:${round.courseId}:${round.teeName}:${round.grossScore}`;
};

const normalizeIndividualRounds = (rounds: IndividualRound[] = []): IndividualRound[] => {
  const byKey = new Map<string, IndividualRound>();
  rounds.forEach((round) => {
    const key = getRoundDedupKey(round);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, round);
      return;
    }
    if (getRoundTimestamp(round) >= getRoundTimestamp(existing)) {
      byKey.set(key, round);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => getRoundTimestamp(b) - getRoundTimestamp(a));
};

// ============================================================================
// Actions Interface
// ============================================================================

export interface HandicapSliceActions {
  addIndividualRound: (round: Omit<IndividualRound, 'id' | 'createdAt'>) => string;
  getProfileRounds: (profileId: string) => CombinedRound[];
  calculateAndUpdateHandicap: (profileId: string) => void;
  recalculateAllDifferentials: () => void;
  deleteIndividualRound: (roundId: string) => void;
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createHandicapSlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): HandicapSliceActions => ({
  addIndividualRound: (roundData: Omit<IndividualRound, 'id' | 'createdAt'>): string => {
    const roundId = nanoid();
    const newRound: IndividualRound = {
      ...roundData,
      id: roundId,
      createdAt: new Date().toISOString()
    };

    // Find the profile to update
    const profileToUpdate = get().profiles.find((p: GolferProfile) => p.id === roundData.profileId);
    if (!profileToUpdate) return roundId;

    // Create updated profile with new round and stats
    const updatedProfile = {
      ...profileToUpdate,
      individualRounds: [...(profileToUpdate.individualRounds || []), newRound],
      stats: {
        ...profileToUpdate.stats,
        roundsPlayed: profileToUpdate.stats.roundsPlayed + 1,
        averageScore: profileToUpdate.stats.roundsPlayed > 0 
          ? ((profileToUpdate.stats.averageScore * profileToUpdate.stats.roundsPlayed) + roundData.grossScore) / (profileToUpdate.stats.roundsPlayed + 1)
          : roundData.grossScore,
        bestScore: profileToUpdate.stats.bestScore === 0 || roundData.grossScore < profileToUpdate.stats.bestScore
          ? roundData.grossScore
          : profileToUpdate.stats.bestScore
      }
    };

    set((state: any) => ({
      profiles: state.profiles.map((profile: GolferProfile) =>
        profile.id === roundData.profileId ? updatedProfile : profile
      ),
      // Also update currentProfile if it's the same profile
      currentProfile: state.currentProfile?.id === roundData.profileId ? updatedProfile : state.currentProfile
    }));

    // Auto-calculate handicap after adding round
    get().calculateAndUpdateHandicap(roundData.profileId);
    
    // Sync to cloud
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      import('../../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
        saveIndividualRoundToCloud(newRound).then(() => {
          console.log('✅ addIndividualRound: Round saved to cloud:', newRound.id);
        }).catch((err: unknown) => {
          console.error('❌ addIndividualRound: Failed to save round to cloud:', err);
        });
      });
    }
    
    return roundId;
  },

  getProfileRounds: (profileId: string): CombinedRound[] => {
    const profile = get().profiles.find((p: GolferProfile) => p.id === profileId);
    const completedEvents = get().completedEvents || [];
    const rounds: CombinedRound[] = [];
    const normalizedRounds = normalizeIndividualRounds(profile?.individualRounds || []);

    // Add individual rounds (includes converted event rounds)
    if (normalizedRounds.length > 0) {
      normalizedRounds.forEach((round: IndividualRound) => {
        const course = getCourseById(round.courseId);
        
        // If this round came from an event, get the event name
        let eventName: string | undefined;
        if (round.eventId) {
          const sourceEvent = completedEvents.find((e: any) => e.id === round.eventId);
          eventName = sourceEvent?.name;
        }
        
        rounds.push({
          id: round.id,
          type: round.eventId ? 'event' : 'individual',
          date: round.date,
          courseName: course?.name || 'Unknown Course',
          teeName: round.teeName,
          grossScore: round.grossScore,
          netScore: round.netScore,
          scoreDifferential: round.scoreDifferential,
          eventName,
          eventId: round.eventId,
          scores: round.scores,
          completedRoundId: round.completedRoundId
        });
      });
    }

    // Sort by date (most recent first)
    return rounds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  calculateAndUpdateHandicap: (profileId: string): void => {
    const profile = get().profiles.find((p: GolferProfile) => p.id === profileId);
    if (!profile?.individualRounds) return;
    const normalizedRounds = normalizeIndividualRounds(profile.individualRounds);
    if (normalizedRounds.length === 0) return;

    // Self-heal: dedupe + backfill missing score differentials from hole data.
    const recomputedRounds = normalizedRounds.map((round: IndividualRound) => {
      if (isRoundEligibleForHandicapIndex(round)) return round;
      const fixed = recomputeRoundDifferential(round);
      return isRoundEligibleForHandicapIndex(fixed) ? fixed : recomputeRoundDifferential(round);
    });

    const roundEntries = recomputedRounds
      .filter((r: IndividualRound) => isRoundEligibleForHandicapIndex(r))
      .map((r: IndividualRound) => ({ id: r.id, differential: r.scoreDifferential as number }));

    const roundsChanged =
      recomputedRounds.length !== profile.individualRounds.length ||
      recomputedRounds.some((r, i) => r.scoreDifferential !== profile.individualRounds?.[i]?.scoreDifferential);

    // Nothing to calculate yet — still persist repaired differentials.
    if (roundEntries.length === 0) {
      if (!roundsChanged) return;
      const repairedOnly = { ...profile, individualRounds: recomputedRounds };
      set((state: any) => ({
        profiles: state.profiles.map((p: GolferProfile) => (p.id === profileId ? repairedOnly : p)),
        currentProfile: state.currentProfile?.id === profileId ? repairedOnly : state.currentProfile,
      }));
      return;
    }

    // WHS requires 3+ rounds — don't overwrite a manual index with 0 while building history.
    if (roundEntries.length < 3) {
      const pendingProfile = { ...profile, individualRounds: recomputedRounds };
      set((state: any) => ({
        profiles: state.profiles.map((p: GolferProfile) => (p.id === profileId ? pendingProfile : p)),
        currentProfile: state.currentProfile?.id === profileId ? pendingProfile : state.currentProfile,
      }));
      return;
    }

    const whsResult = calculateWHSHandicapIndex(roundEntries);

    const updatedProfile = {
      ...profile,
      handicapIndex: whsResult.handicapIndex,
      handicapHistory: [
        ...(profile.handicapHistory || []),
        {
          date: whsResult.calculationDate,
          handicapIndex: whsResult.handicapIndex,
          rounds: recomputedRounds,
          usedRoundIds: whsResult.usedRoundIds,
          source: 'calculation' as const
        }
      ],
      individualRounds: recomputedRounds,
    };

    set((state: any) => ({
      profiles: state.profiles.map((p: GolferProfile) =>
        p.id === profileId ? updatedProfile : p
      ),
      currentProfile: state.currentProfile?.id === profileId ? updatedProfile : state.currentProfile
    }));

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      import('../../utils/profileSync').then(({ saveCloudProfile }) => {
        saveCloudProfile(updatedProfile as any).catch((err: unknown) => {
          console.error('Failed to save calculated handicap to cloud:', err);
        });
      });
      import('../../utils/roundSync').then(({ batchSaveIndividualRoundsToCloud }) => {
        const changedRounds = recomputedRounds.filter((r) =>
          !profile.individualRounds?.some(
            (existing: IndividualRound) => existing.id === r.id && existing.scoreDifferential === r.scoreDifferential
          )
        );
        if (changedRounds.length > 0) {
          batchSaveIndividualRoundsToCloud(changedRounds).catch(console.error);
        }
      });
    }
  },

  recalculateAllDifferentials: (): void => {
    const state = get();
    
    // First, check if any completed rounds should be added to individual rounds for handicap
    state.profiles.forEach((profile: GolferProfile) => {
      // Create a set of existing individual round dates/courses to avoid duplicates
      const existingRounds = new Set(
        profile.individualRounds?.map((r: IndividualRound) => `${r.date}-${r.courseId}-${r.teeName}`) || []
      );
      const completedRoundsForProfile = state.completedRounds.filter((cr: CompletedRound) => 
        cr.golferId === profile.id && 
        cr.courseId && 
        !existingRounds.has(`${cr.datePlayed}-${cr.courseId}-${cr.teeName}`)
      );
      
      completedRoundsForProfile.forEach((completedRound: CompletedRound) => {
        if (!completedRound.courseId) return;
        
        // Convert completed event round to individual round
        const course = getCourseById(completedRound.courseId!);
        const tee = course?.tees.find((t: any) => t.name === completedRound.teeName);
        
        if (tee && completedRound.holesPlayed >= 9) {
          const currentHandicap = completedRound.handicapIndex || 0;
          const cr1 = getTeeRatings(tee).courseRating;
          const sl1 = getTeeRatings(tee).slopeRating;
          const courseHandicap = Math.round(currentHandicap * (sl1 / 113) + (cr1 - tee.par));
          
          // Build scores array
          const strokeDist = distributeHandicapStrokes(courseHandicap, completedRound.courseId!, completedRound.teeName);
          const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map(holeScore => {
            const handicapStrokes = strokeDist[holeScore.hole] || 0;
            const strokes = holeScore.strokes;
            return {
              hole: holeScore.hole,
              par: holeScore.par,
              strokes,
              handicapStrokes,
              netStrokes: strokes - handicapStrokes,
              adjustedStrokes: applyESCAdjustment(strokes ?? 0, holeScore.par, handicapStrokes),
            };
          });
          
          // Apply ESC and calculate differential
          let adjustedGross = 0;
          roundScores.forEach(s => {
            const adj = typeof s.adjustedStrokes === 'number'
              ? s.adjustedStrokes
              : applyESCAdjustment(s.strokes ?? 0, s.par, s.handicapStrokes);
            adjustedGross += adj;
          });
          
          const scoreDifferential = calculateScoreDifferential(adjustedGross, cr1, sl1);
          
          const newIndividualRound: IndividualRound = {
            id: buildIndividualRoundId(completedRound.eventId, profile.id),
            profileId: profile.id,
            date: completedRound.datePlayed,
            courseId: completedRound.courseId,
            teeName: completedRound.teeName || tee.name,
            grossScore: completedRound.finalScore,
            netScore: completedRound.finalScore - courseHandicap,
            courseHandicap,
            scoreDifferential,
            courseRating: cr1,
            slopeRating: sl1,
            scores: roundScores,
            adjustedGrossScore: adjustedGross,
            eventId: completedRound.eventId, // Link back to source event
            completedRoundId: completedRound.id, // Link to CompletedRound to prevent double-counting
            createdAt: new Date().toISOString()
          };
          
          // Add to profile's individual rounds
          set((s: any) => ({
            profiles: s.profiles.map((p: GolferProfile) =>
              p.id === profile.id ? {
                ...p,
                individualRounds: [...(p.individualRounds || []), newIndividualRound]
              } : p
            )
          }));
          
          // Sync IndividualRound to cloud
          if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
            import('../../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
              saveIndividualRoundToCloud(newIndividualRound).then(() => {
                console.log('✅ recalculateAllDifferentials: IndividualRound saved to cloud:', newIndividualRound.id);
              }).catch((err: unknown) => {
                console.error('❌ recalculateAllDifferentials: Failed to save IndividualRound to cloud:', err);
              });
            });
          }
        }
      });
    });
    
    // For each profile, recompute round differentials (uses stored ratings + course cache fallbacks).
    const updatedProfiles = state.profiles.map((profile: GolferProfile) => {
      if (!profile.individualRounds || profile.individualRounds.length === 0) return profile;

      const recomputed = profile.individualRounds.map((r: IndividualRound) => {
        if (isRoundEligibleForHandicapIndex(r)) return r;
        return recomputeRoundDifferential(r);
      });

      return { ...profile, individualRounds: recomputed };
    });

    // Find the updated current profile if it exists
    const currentProfileId = get().currentProfile?.id;
    const updatedCurrentProfile = currentProfileId 
      ? updatedProfiles.find((p: GolferProfile) => p.id === currentProfileId) 
      : null;

    set(() => ({ 
      profiles: updatedProfiles,
      // Also update currentProfile if it was updated
      currentProfile: updatedCurrentProfile || get().currentProfile
    }));

    // Recalculate handicap for each profile that had rounds
    updatedProfiles.forEach((p: GolferProfile) => {
      if (p.individualRounds && p.individualRounds.length > 0) get().calculateAndUpdateHandicap(p.id);
    });
  },

  deleteIndividualRound: (roundId: string): void => {
    let affectedProfileId: string | null = null;
    let affectedProfile: GolferProfile | null = null;

    const updatedProfiles = get().profiles.map((profile: GolferProfile) => {
      const updatedRounds = profile.individualRounds?.filter((round: IndividualRound) => {
        if (round.id === roundId) {
          affectedProfileId = profile.id;
          return false;
        }
        return true;
      });

      if (updatedRounds?.length !== profile.individualRounds?.length) {
        const updated = {
          ...profile,
          individualRounds: updatedRounds,
          stats: {
            ...profile.stats,
            roundsPlayed: Math.max(0, profile.stats.roundsPlayed - 1)
          }
        };
        if (profile.id === affectedProfileId) {
          affectedProfile = updated;
        }
        return updated;
      }
      return profile;
    });

    set((state: any) => ({
      profiles: updatedProfiles,
      // Also update currentProfile if it's the affected profile
      currentProfile: state.currentProfile?.id === affectedProfileId && affectedProfile 
        ? affectedProfile 
        : state.currentProfile
    }));

    // Recalculate handicap if a round was removed
    if (affectedProfileId) {
      get().calculateAndUpdateHandicap(affectedProfileId);
    }
    
    // Delete from cloud
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      import('../../utils/roundSync').then(({ deleteIndividualRoundFromCloud }) => {
        deleteIndividualRoundFromCloud(roundId).then(() => {
          console.log('✅ deleteIndividualRound: Round deleted from cloud:', roundId);
        }).catch((err: unknown) => {
          console.error('❌ deleteIndividualRound: Failed to delete round from cloud:', err);
        });
      });
    }
  },
});
