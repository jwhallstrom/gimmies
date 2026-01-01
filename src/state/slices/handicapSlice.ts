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
  calculateScoreDifferential 
} from '../../utils/handicap';
import type { 
  GolferProfile, 
  CompletedRound,
  IndividualRound, 
  CombinedRound 
} from '../types';
import { ScoreEntry as HandicapScoreEntry } from '../../types/handicap';

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
    const rounds: CombinedRound[] = [];

    // Add individual rounds (includes converted event rounds)
    if (profile?.individualRounds) {
      profile.individualRounds.forEach((round: IndividualRound) => {
        const course = getCourseById(round.courseId);
        rounds.push({
          id: round.id,
          type: 'individual',
          date: round.date,
          courseName: course?.name || 'Unknown Course',
          teeName: round.teeName,
          grossScore: round.grossScore,
          netScore: round.netScore,
          scoreDifferential: round.scoreDifferential,
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

    // Get all score differentials
    const differentials = profile.individualRounds
      .map((round: IndividualRound) => round.scoreDifferential)
      .filter((diff: number | undefined) => diff !== undefined && !isNaN(diff));

    if (differentials.length === 0) return;

    // Calculate WHS handicap index - pass ids so we can know which rounds were used
    const roundEntries = profile.individualRounds.map((r: IndividualRound) => ({ 
      id: r.id, 
      differential: r.scoreDifferential 
    }));
    const whsResult = calculateWHSHandicapIndex(roundEntries as any);

    // Create the updated profile object
    const updatedProfile = {
      ...profile,
      handicapIndex: whsResult.handicapIndex,
      handicapHistory: [
        ...(profile.handicapHistory || []),
        {
          date: whsResult.calculationDate,
          handicapIndex: whsResult.handicapIndex,
          rounds: profile.individualRounds || [],
          usedRoundIds: whsResult.usedRoundIds,
          source: 'calculation' as const
        }
      ]
    };

    // Update profile with new handicap and record which rounds were used
    set((state: any) => ({
      profiles: state.profiles.map((p: GolferProfile) =>
        p.id === profileId ? updatedProfile : p
      ),
      // Also update currentProfile if it's the same profile
      currentProfile: state.currentProfile?.id === profileId ? updatedProfile : state.currentProfile
    }));
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
        
        if (tee && completedRound.holesPlayed >= 14) {
          const currentHandicap = completedRound.handicapIndex || 0;
          const cr1 = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
          const sl1 = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
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
            id: nanoid(8),
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
    
    // For each profile, recompute round differentials if possible
    const updatedProfiles = state.profiles.map((profile: GolferProfile) => {
      if (!profile.individualRounds || profile.individualRounds.length === 0) return profile;

      const recomputed = profile.individualRounds.map((r: IndividualRound) => {
        try {
          const course = getCourseById(r.courseId);
          if (!course) return r;
          const tee = course.tees.find(t => t.name === r.teeName);
          if (!tee) return r;

          // Distribute strokes and apply ESC
          const strokeDist = distributeHandicapStrokes(r.courseHandicap || 0, r.courseId, r.teeName);
          let adjustedGross = 0;
          const updatedScores = r.scores.map(s => {
            const raw = s.strokes || 0;
            const par = s.par || 4;
            const handicapStrokes = s.handicapStrokes ?? (strokeDist[s.hole] || 0);
            const adj = applyESCAdjustment(raw, par, handicapStrokes);
            adjustedGross += adj;
            return { ...s, handicapStrokes, adjustedStrokes: adj };
          });

          const cr2 = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
          const sl2 = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
          const diff = calculateScoreDifferential(adjustedGross, cr2, sl2);
          return { ...r, scores: updatedScores, adjustedGrossScore: adjustedGross, scoreDifferential: diff };
        } catch {
          return r;
        }
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
