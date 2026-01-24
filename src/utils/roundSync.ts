/**
 * IndividualRound Sync Utility
 * Syncs handicap rounds between local Zustand store and AWS Amplify (DynamoDB)
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { IndividualRound } from '../types/handicap';

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return null;
  if (cachedClient) return cachedClient;
  try {
    cachedClient = generateClient<Schema>();
    return cachedClient;
  } catch (e) {
    console.warn('❌ Amplify client unavailable (local/offline mode)', e);
    return null;
  }
}

/**
 * Save an individual round to cloud (DynamoDB)
 */
export async function saveIndividualRoundToCloud(round: IndividualRound): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('Saving individual round to cloud:', round.id);

    const cloudData = {
      id: round.id, // CRITICAL: Preserve local ID for consistency
      profileId: round.profileId,
      date: round.date,
      courseId: round.courseId,
      teeName: round.teeName,
      grossScore: round.grossScore,
      netScore: round.netScore,
      courseHandicap: round.courseHandicap,
      scoreDifferential: round.scoreDifferential,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      scoresJson: JSON.stringify(round.scores), // Must stringify for a.json() type
      eventId: round.eventId, // Track if this round came from an event
      completedRoundId: round.completedRoundId, // Link to CompletedRound if from event
    };

    const { data, errors } = await client.models.IndividualRound.create(cloudData);

    if (errors) {
      console.error('❌ Error saving individual round:', errors);
      console.error('❌ Round data that failed:', cloudData);
      return false;
    }

    console.log('Individual round saved successfully:', data);
    return true;
  } catch (error) {
    console.error('Failed to save individual round to cloud:', error);
    return false;
  }
}

/**
 * Load all individual rounds for a profile from cloud
 */
export async function loadIndividualRoundsFromCloud(profileId: string): Promise<IndividualRound[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('Loading individual rounds from cloud for profile:', profileId);

    const { data: cloudRounds, errors } = await client.models.IndividualRound.list({
      filter: { profileId: { eq: profileId } },
    });

    if (errors) {
      console.error('Error loading individual rounds:', errors);
      return [];
    }

    if (!cloudRounds || cloudRounds.length === 0) {
      console.log('No individual rounds found in cloud');
      return [];
    }

    console.log(`Loaded ${cloudRounds.length} individual rounds from cloud`);

    // Convert cloud rounds to local format
    const rounds: IndividualRound[] = cloudRounds.map(cloudRound => ({
      id: cloudRound.id,
      profileId: cloudRound.profileId,
      courseId: cloudRound.courseId,
      teeName: cloudRound.teeName,
      date: cloudRound.date,
      scores: cloudRound.scoresJson ? JSON.parse(cloudRound.scoresJson as string) : [],
      grossScore: cloudRound.grossScore,
      netScore: cloudRound.netScore || 0,
      scoreDifferential: cloudRound.scoreDifferential || 0,
      courseRating: cloudRound.courseRating || 0,
      slopeRating: cloudRound.slopeRating || 113,
      courseHandicap: cloudRound.courseHandicap || 0,
      eventId: cloudRound.eventId || undefined,
      completedRoundId: cloudRound.completedRoundId || undefined, // Link to CompletedRound
      createdAt: cloudRound.createdAt || new Date().toISOString(),
    }));

    return rounds;
  } catch (error) {
    console.error('Failed to load individual rounds from cloud:', error);
    return [];
  }
}

/**
 * Delete an individual round from cloud
 */
export async function deleteIndividualRoundFromCloud(roundId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('Deleting individual round from cloud:', roundId);

    const { errors } = await client.models.IndividualRound.delete({
      id: roundId,
    });

    if (errors) {
      console.error('Error deleting individual round:', errors);
      return false;
    }

    console.log('Individual round deleted successfully');
    return true;
  } catch (error) {
    console.error('Failed to delete individual round from cloud:', error);
    return false;
  }
}

/**
 * Batch save multiple individual rounds to cloud
 */
export async function batchSaveIndividualRoundsToCloud(rounds: IndividualRound[]): Promise<number> {
  let successCount = 0;

  for (const round of rounds) {
    const success = await saveIndividualRoundToCloud(round);
    if (success) successCount++;
  }

  console.log(`Batch saved ${successCount}/${rounds.length} individual rounds to cloud`);
  return successCount;
}

/**
 * Remove duplicate IndividualRounds from cloud database
 * Keeps the first occurrence of each unique combination of date + courseId + teeName
 */
export async function deduplicateCloudRounds(profileId: string): Promise<{ removed: number; kept: number }> {
  try {
    console.log('🧹 Starting deduplication for profile:', profileId);

    // Load all rounds from cloud
    const rounds = await loadIndividualRoundsFromCloud(profileId);
    console.log(`Found ${rounds.length} total rounds in cloud`);

    if (rounds.length === 0) {
      return { removed: 0, kept: 0 };
    }

    // Group rounds by unique key (date + courseId + teeName)
    const uniqueMap = new Map<string, IndividualRound>();
    const duplicates: IndividualRound[] = [];

    rounds.forEach(round => {
      const key = `${round.date}|${round.courseId}|${round.teeName}`;
      
      if (!uniqueMap.has(key)) {
        // First occurrence - keep it
        uniqueMap.set(key, round);
      } else {
        // Duplicate - mark for deletion
        duplicates.push(round);
      }
    });

    console.log(`Found ${uniqueMap.size} unique rounds, ${duplicates.length} duplicates to remove`);

    // Delete duplicates from cloud
    let removedCount = 0;
    for (const duplicate of duplicates) {
      console.log(`Deleting duplicate round: ${duplicate.date} at ${duplicate.courseId} (${duplicate.teeName})`);
      const success = await deleteIndividualRoundFromCloud(duplicate.id);
      if (success) removedCount++;
    }

    console.log(`✅ Deduplication complete: Kept ${uniqueMap.size}, Removed ${removedCount}`);
    
    return {
      removed: removedCount,
      kept: uniqueMap.size
    };
  } catch (error) {
    console.error('Failed to deduplicate cloud rounds:', error);
    return { removed: 0, kept: 0 };
  }
}
