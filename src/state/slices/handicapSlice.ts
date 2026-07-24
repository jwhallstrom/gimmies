/**
 * Handicap Slice
 * Handles individual rounds and WHS handicap calculations
 */

import { nanoid } from 'nanoid/non-secure';
import { getCourseById, getTee } from '../../data/cloudCourses';
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

export const getRoundDedupKey = (round: IndividualRound): string => {
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
    // Prefer the round that already has a usable differential / more complete data.
    const existingEligible = isRoundEligibleForHandicapIndex(existing);
    const incomingEligible = isRoundEligibleForHandicapIndex(round);
    if (incomingEligible && !existingEligible) {
      byKey.set(key, round);
      return;
    }
    if (existingEligible && !incomingEligible) return;
    if (getRoundTimestamp(round) >= getRoundTimestamp(existing)) {
      byKey.set(key, round);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => getRoundTimestamp(b) - getRoundTimestamp(a));
};

export const mergeIndividualRoundLists = (
  localRounds: IndividualRound[] = [],
  remoteRounds: IndividualRound[] = []
): IndividualRound[] => normalizeIndividualRounds([...localRounds, ...remoteRounds]);

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
      // Oldest → newest so WHS "most recent 20" uses slice(-20) correctly
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
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

    const previousIndex = profile.handicapIndex;
    const indexChanged =
      typeof previousIndex !== 'number' ||
      Math.abs(previousIndex - whsResult.handicapIndex) > 0.05;

    const previousHistory = profile.handicapHistory || [];
    const lastHistory = previousHistory[previousHistory.length - 1];
    const shouldAppendHistory =
      indexChanged &&
      (!lastHistory ||
        lastHistory.handicapIndex !== whsResult.handicapIndex ||
        lastHistory.source !== 'calculation');

    const updatedProfile = {
      ...profile,
      handicapIndex: whsResult.handicapIndex,
      handicapHistory: shouldAppendHistory
        ? [
            ...previousHistory,
            {
              date: whsResult.calculationDate,
              handicapIndex: whsResult.handicapIndex,
              rounds: recomputedRounds,
              usedRoundIds: whsResult.usedRoundIds,
              source: 'calculation' as const
            }
          ]
        : previousHistory.map((entry: any, idx: number) =>
            idx === previousHistory.length - 1 && entry.source === 'calculation'
              ? { ...entry, usedRoundIds: whsResult.usedRoundIds, rounds: recomputedRounds }
              : entry
          ),
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

    // Work on an in-memory copy so newly converted rounds are not wiped by a
    // later set() that still references the pre-conversion snapshot.
    const workingProfiles: GolferProfile[] = state.profiles.map((p: GolferProfile) => ({
      ...p,
      individualRounds: [...(p.individualRounds || [])],
    }));
    const newlyCreatedRounds: IndividualRound[] = [];

    workingProfiles.forEach((profile: GolferProfile) => {
      const existingKeys = new Set(
        (profile.individualRounds || []).flatMap((r: IndividualRound) => {
          const keys = [getRoundDedupKey(r), `${r.date}-${r.courseId}-${r.teeName}`];
          if (r.eventId) keys.push(`event:${r.eventId}:${profile.id}`);
          if (r.completedRoundId) keys.push(`completed:${r.completedRoundId}`);
          return keys;
        })
      );

      const completedRoundsForProfile = state.completedRounds.filter((cr: CompletedRound) =>
        cr.golferId === profile.id &&
        cr.courseId &&
        !existingKeys.has(`${cr.datePlayed}-${cr.courseId}-${cr.teeName}`) &&
        !existingKeys.has(`completed:${cr.id}`) &&
        !existingKeys.has(`event:${cr.eventId}:${profile.id}`)
      );

      completedRoundsForProfile.forEach((completedRound: CompletedRound) => {
        if (!completedRound.courseId) return;

        const course = getCourseById(completedRound.courseId);
        const tee =
          getTee(completedRound.courseId, completedRound.teeName) ||
          course?.tees.find((t: any) => t.name === completedRound.teeName) ||
          course?.tees?.[0];

        if (!tee || completedRound.holesPlayed < 9) return;

        const currentHandicap = completedRound.handicapIndex || 0;
        const { courseRating: cr1, slopeRating: sl1 } = getTeeRatings(tee);
        if (!Number.isFinite(cr1) || !Number.isFinite(sl1) || sl1 <= 0) return;

        const courseHandicap = Math.round(currentHandicap * (sl1 / 113) + (cr1 - tee.par));
        const strokeDist = distributeHandicapStrokes(
          courseHandicap,
          completedRound.courseId!,
          completedRound.teeName || tee.name
        );

        const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map((holeScore) => {
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

        let adjustedGross = 0;
        roundScores.forEach((s) => {
          const adj =
            typeof s.adjustedStrokes === 'number'
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
          eventId: completedRound.eventId,
          completedRoundId: completedRound.id,
          createdAt: new Date().toISOString(),
        };

        profile.individualRounds = [...(profile.individualRounds || []), newIndividualRound];
        newlyCreatedRounds.push(newIndividualRound);
      });
    });

    const updatedProfiles = workingProfiles.map((profile: GolferProfile) => {
      if (!profile.individualRounds || profile.individualRounds.length === 0) return profile;
      const recomputed = normalizeIndividualRounds(profile.individualRounds).map((r: IndividualRound) => {
        if (isRoundEligibleForHandicapIndex(r)) return r;
        return recomputeRoundDifferential(r);
      });
      return { ...profile, individualRounds: recomputed };
    });

    const currentProfileId = state.currentProfile?.id;
    const updatedCurrentProfile = currentProfileId
      ? updatedProfiles.find((p: GolferProfile) => p.id === currentProfileId)
      : null;

    set(() => ({
      profiles: updatedProfiles,
      currentProfile: updatedCurrentProfile || state.currentProfile,
    }));

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && newlyCreatedRounds.length > 0) {
      import('../../utils/roundSync').then(({ batchSaveIndividualRoundsToCloud }) => {
        batchSaveIndividualRoundsToCloud(newlyCreatedRounds).catch((err: unknown) => {
          console.error('❌ recalculateAllDifferentials: Failed to save IndividualRounds:', err);
        });
      });
    }

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
