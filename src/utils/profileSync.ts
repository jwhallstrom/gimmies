/**
 * Profile Sync Utility
 * Syncs user profile between local Zustand store and AWS Amplify (DynamoDB)
 */

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import useStore from '../state/store';

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

// Verified Status for gamification sync
export interface SyncableVerifiedStatus {
  verifiedRounds: number;
  statusLevel: number;
  badges: string[];
  lastVerifiedEventId?: string;
  lastVerifiedEventDate?: string;
  weeklyStreak?: number;
  totalEventsWithBets?: number;
}

export interface SyncableProfile {
  id: string;
  userId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  handicapIndex?: number;
  preferredTee?: string;
  stats: {
    roundsPlayed: number;
    averageScore: number;
    bestScore: number;
    totalBirdies: number;
    totalEagles: number;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    defaultNetScoring: boolean;
    autoAdvanceScores: boolean;
    showHandicapStrokes: boolean;
    homeCourseId?: string;
    homeCourseName?: string;
    homeCourse?: string; // legacy
    favoriteCourseIds?: string[]; // pinned courses
    showVerifiedStatus?: boolean; // public status display
  };
  verifiedStatus?: SyncableVerifiedStatus;
  createdAt: string;
  lastActive: string;
}

function mapCloudProfileToSyncable(cloudProfile: any): SyncableProfile {
  return {
    id: cloudProfile.id,
    userId: cloudProfile.userId,
    name: cloudProfile.name,
    firstName: cloudProfile.firstName || undefined,
    lastName: cloudProfile.lastName || undefined,
    email: cloudProfile.email || undefined,
    avatar: cloudProfile.avatar || undefined,
    handicapIndex: cloudProfile.handicapIndex ?? undefined,
    preferredTee: cloudProfile.preferredTee || undefined,
    stats: cloudProfile.statsJson ? JSON.parse(cloudProfile.statsJson as string) : {
      roundsPlayed: 0,
      averageScore: 0,
      bestScore: 0,
      totalBirdies: 0,
      totalEagles: 0,
    },
    preferences: cloudProfile.preferencesJson ? JSON.parse(cloudProfile.preferencesJson as string) : {
      theme: 'auto',
      defaultNetScoring: false,
      autoAdvanceScores: true,
      showHandicapStrokes: true,
    },
    verifiedStatus: cloudProfile.verifiedStatusJson
      ? JSON.parse(cloudProfile.verifiedStatusJson as string)
      : undefined,
    createdAt: cloudProfile.createdAt || new Date().toISOString(),
    lastActive: cloudProfile.lastActive || new Date().toISOString(),
  };
}

/**
 * Fetch user's profile from cloud (DynamoDB)
 */
export async function fetchCloudProfile(userId: string): Promise<SyncableProfile | null> {
  try {
    const client = getClient();
    if (!client) return null;

    console.log('Fetching cloud profile for user:', userId);
    
    const { data: profiles, errors } = await client.models.Profile.list({
      filter: { userId: { eq: userId } }
    });

    if (errors) {
      console.error('Error fetching profile:', errors);
      return null;
    }

    if (!profiles || profiles.length === 0) {
      console.log('No cloud profile found for user:', userId);
      return null;
    }

    const cloudProfile = profiles[0];
    console.log('Found cloud profile:', cloudProfile);

    // Convert cloud profile to local format
    return mapCloudProfileToSyncable(cloudProfile);
  } catch (error) {
    console.error('Failed to fetch cloud profile:', error);
    return null;
  }
}

/**
 * Fetch many cloud profiles by profile ID.
 * Used to hydrate participant cards (name/avatar/status) for other users.
 */
export async function loadCloudProfilesByIds(profileIds: string[]): Promise<SyncableProfile[]> {
  try {
    const client = getClient();
    if (!client) return [];

    const ids = Array.from(new Set((profileIds || []).filter(Boolean)));
    if (ids.length === 0) return [];

    const { data: profiles, errors } = await client.models.Profile.list();
    if (errors) {
      console.error('Error loading profiles by ids:', errors);
      return [];
    }

    const idSet = new Set(ids);
    return (profiles || [])
      .filter((p: any) => idSet.has(p.id))
      .map(mapCloudProfileToSyncable);
  } catch (error) {
    console.error('Failed to load profiles by ids:', error);
    return [];
  }
}

/**
 * Save/Update profile to cloud (DynamoDB)
 */
export async function saveCloudProfile(profile: SyncableProfile): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('Saving profile to cloud:', profile);

    // Check if profile exists
    const { data: existingProfiles } = await client.models.Profile.list({
      filter: { userId: { eq: profile.userId } }
    });

    // Ensure stats and preferences are valid JSON objects (not undefined/null)
    const statsJson = profile.stats || {
      roundsPlayed: 0,
      averageScore: 0,
      bestScore: 0,
      totalBirdies: 0,
      totalEagles: 0,
    };

    const preferencesJson = profile.preferences || {
      theme: 'auto',
      defaultNetScoring: false,
      autoAdvanceScores: true,
      showHandicapStrokes: true,
    };

    const cloudData = {
      userId: profile.userId,
      name: profile.name,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      email: profile.email || null,
      avatar: profile.avatar || null,
      handicapIndex: profile.handicapIndex ?? null,
      preferredTee: profile.preferredTee || null,
      statsJson: JSON.stringify(statsJson), // Stringify for storage
      preferencesJson: JSON.stringify(preferencesJson), // Stringify for storage
      verifiedStatusJson: profile.verifiedStatus ? JSON.stringify(profile.verifiedStatus) : null,
      lastActive: new Date().toISOString(),
    };

    console.log('Cloud data to save:', cloudData);

    if (existingProfiles && existingProfiles.length > 0) {
      const cloudId = existingProfiles[0].id;
      if (cloudId !== profile.id) {
        remapLocalProfileId(profile.id, cloudId);
      }

      // Update existing profile
      console.log('Updating existing cloud profile:', cloudId);
      const { data, errors } = await client.models.Profile.update({
        id: cloudId,
        ...cloudData,
      });

      if (errors) {
        console.error('Error updating profile:', errors);
        return false;
      }

      console.log('Profile updated successfully:', data);
      return true;
    }

    // Create new profile — use the same id as local store so joins reference the right row.
    console.log('Creating new cloud profile with id:', profile.id);
    const { data, errors } = await client.models.Profile.create({
      id: profile.id,
      ...cloudData,
    });

    if (errors) {
      console.error('Error creating profile:', errors);
      console.error('Error details:', JSON.stringify(errors, null, 2));
      return false;
    }

    console.log('Profile created successfully:', data);
    return true;
  } catch (error) {
    console.error('Failed to save cloud profile:', error);
    return false;
  }
}

/** Keep local profile id aligned with DynamoDB (required for hub join mutations). */
function remapLocalProfileId(localId: string, cloudId: string) {
  if (!localId || !cloudId || localId === cloudId) return;

  useStore.setState((state: any) => {
    const remap = (p: any) => (p?.id === localId ? { ...p, id: cloudId } : p);
    return {
      profiles: (state.profiles || []).map(remap),
      currentProfile:
        state.currentProfile?.id === localId
          ? { ...state.currentProfile, id: cloudId }
          : state.currentProfile,
    };
  });
}

/**
 * Wait until the cloud profile row exists and matches the signed-in user.
 * Invite auto-join runs immediately after profile creation — this avoids races.
 */
export async function waitForCloudProfileReady(
  userId: string,
  profileId: string,
  options?: { attempts?: number; baseDelayMs?: number },
): Promise<boolean> {
  const client = getClient();
  if (!client) return true;

  const attempts = options?.attempts ?? 8;
  const baseDelayMs = options?.baseDelayMs ?? 400;

  for (let i = 0; i < attempts; i++) {
    try {
      const { data } = await client.models.Profile.get({ id: profileId });
      if (data && data.userId === userId) return true;
    } catch {
      // ignore — row may not exist yet
    }

    const cloud = await fetchCloudProfile(userId);
    if (cloud?.id === profileId) return true;
    if (cloud && cloud.id !== profileId) {
      remapLocalProfileId(profileId, cloud.id);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (i + 1)));
  }

  return false;
}

/**
 * Delete profile from cloud (DynamoDB)
 */
export async function deleteCloudProfile(userId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('Deleting cloud profile for user:', userId);

    const { data: existingProfiles } = await client.models.Profile.list({
      filter: { userId: { eq: userId } }
    });

    if (!existingProfiles || existingProfiles.length === 0) {
      console.log('No cloud profile to delete');
      return true;
    }

    const { errors } = await client.models.Profile.delete({
      id: existingProfiles[0].id,
    });

    if (errors) {
      console.error('Error deleting profile:', errors);
      return false;
    }

    console.log('Profile deleted successfully');
    return true;
  } catch (error) {
    console.error('Failed to delete cloud profile:', error);
    return false;
  }
}

/**
 * Delete a profile from cloud by profileId
 */
export async function deleteProfileFromCloud(profileId: string): Promise<boolean> {
  try {
    const client = getClient();
    if (!client) return false;

    console.log('🗑️ Deleting cloud profile:', profileId);

    const { errors } = await client.models.Profile.delete({
      id: profileId,
    });

    if (errors) {
      console.error('❌ Error deleting profile:', errors);
      return false;
    }

    console.log('✅ Profile deleted successfully from cloud');
    return true;
  } catch (error) {
    console.error('❌ Failed to delete cloud profile:', error);
    return false;
  }
}
