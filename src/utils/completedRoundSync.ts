/**
 * CompletedRound Sync Utility
 * Syncs analytics/history rounds between local Zustand store and AWS Amplify (DynamoDB)
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type { CompletedRound } from '../state/store';

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
 * Save a completed round to cloud (DynamoDB)
 */
export async function saveCompletedRoundToCloud(round: CompletedRound): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('☁️ Saving completed round to cloud:', round.id);

    const cloudData = {
      id: round.id, // CRITICAL: Preserve local ID so IndividualRounds can link to it
      eventId: round.eventId,
      eventName: round.eventName,
      datePlayed: round.datePlayed,
      courseId: round.courseId || '',
      courseName: round.courseName,
      teeName: round.teeName || '',
      golferId: round.golferId,
      golferName: round.golferName,
      handicapIndex: round.handicapIndex,
      finalScore: round.finalScore,
      scoreToPar: round.scoreToPar,
      holesPlayed: round.holesPlayed,
      holeScoresJson: JSON.stringify(round.holeScores),
      gameResultsJson: JSON.stringify(round.gameResults),
      statsJson: JSON.stringify(round.stats),
    };

    const { data, errors } = await client.models.CompletedRound.create(cloudData);

    if (errors) {
      console.error('❌ Error saving completed round:', errors);
      console.error('❌ Round data that failed:', cloudData);
      return false;
    }

    console.log('✅ Completed round saved successfully:', data);
    return true;
  } catch (error) {
    console.error('❌ Failed to save completed round to cloud:', error);
    return false;
  }
}

/**
 * Load all completed rounds for a golfer from cloud
 */
export async function loadCompletedRoundsFromCloud(golferId: string): Promise<CompletedRound[]> {
  try {
    const client = getClient();
    if (!client) return [];

    console.log('📥 Loading completed rounds from cloud for golfer:', golferId);

    const { data: cloudRounds, errors } = await client.models.CompletedRound.list({
      filter: { golferId: { eq: golferId } },
    });

    if (errors) {
      console.error('❌ Error loading completed rounds:', errors);
      return [];
    }

    if (!cloudRounds || cloudRounds.length === 0) {
      console.log('No completed rounds found in cloud');
      return [];
    }

    console.log(`✅ Loaded ${cloudRounds.length} completed rounds from cloud`);

    // Convert cloud rounds to local format
    const rounds: CompletedRound[] = cloudRounds.map(cloudRound => ({
      id: cloudRound.id,
      eventId: cloudRound.eventId,
      eventName: cloudRound.eventName,
      datePlayed: cloudRound.datePlayed,
      courseId: cloudRound.courseId || undefined,
      courseName: cloudRound.courseName,
      teeName: cloudRound.teeName || undefined,
      golferId: cloudRound.golferId,
      golferName: cloudRound.golferName,
      handicapIndex: cloudRound.handicapIndex || undefined,
      finalScore: cloudRound.finalScore,
      scoreToPar: cloudRound.scoreToPar || 0,
      holesPlayed: cloudRound.holesPlayed,
      holeScores: cloudRound.holeScoresJson ? JSON.parse(cloudRound.holeScoresJson as string) : [],
      gameResults: cloudRound.gameResultsJson ? JSON.parse(cloudRound.gameResultsJson as string) : {},
      stats: cloudRound.statsJson ? JSON.parse(cloudRound.statsJson as string) : {
        birdies: 0,
        eagles: 0,
        pars: 0,
        bogeys: 0,
        doubleBogeys: 0,
        triplesOrWorse: 0
      },
      createdAt: cloudRound.createdAt || new Date().toISOString(),
    }));

    return rounds;
  } catch (error) {
    console.error('❌ Failed to load completed rounds from cloud:', error);
    return [];
  }
}

/**
 * Delete a completed round from cloud
 */
export async function deleteCompletedRoundFromCloud(roundId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('🗑️ Deleting completed round from cloud:', roundId);

    const { errors } = await client.models.CompletedRound.delete({
      id: roundId,
    });

    if (errors) {
      console.error('❌ Error deleting completed round:', errors);
      return false;
    }

    console.log('✅ Completed round deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete completed round from cloud:', error);
    return false;
  }
}

/**
 * Batch save multiple completed rounds to cloud
 */
export async function batchSaveCompletedRoundsToCloud(rounds: CompletedRound[]): Promise<number> {
  let successCount = 0;

  for (const round of rounds) {
    const success = await saveCompletedRoundToCloud(round);
    if (success) successCount++;
  }

  console.log(`✅ Batch saved ${successCount}/${rounds.length} completed rounds to cloud`);
  return successCount;
}
