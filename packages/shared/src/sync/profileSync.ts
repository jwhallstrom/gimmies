/**
 * Profile Cloud Sync
 * Shared profile sync utilities
 */

import { getAmplifyClient } from './amplifyClient';
import type { GolferProfile } from '../types';

/**
 * Load profile from cloud by user ID
 */
export async function loadProfileFromCloud(userId: string): Promise<GolferProfile | null> {
  try {
    const client = getAmplifyClient();
    if (!client) return null;

    const { data: profiles, errors } = await (client.models as any).Profile.list({
      filter: { userId: { eq: userId } }
    });

    if (errors || !profiles || profiles.length === 0) {
      return null;
    }

    const cloudProfile = profiles[0];
    return {
      id: cloudProfile.id,
      userId: cloudProfile.userId,
      name: cloudProfile.name,
      firstName: cloudProfile.firstName || undefined,
      lastName: cloudProfile.lastName || undefined,
      email: cloudProfile.email || undefined,
      avatar: cloudProfile.avatar || undefined,
      handicapIndex: cloudProfile.handicapIndex || undefined,
      preferredTee: cloudProfile.preferredTee || undefined,
      preferences: cloudProfile.preferencesJson ? JSON.parse(cloudProfile.preferencesJson) : undefined,
      stats: cloudProfile.statsJson ? JSON.parse(cloudProfile.statsJson) : undefined,
      verifiedStatus: cloudProfile.verifiedStatusJson ? JSON.parse(cloudProfile.verifiedStatusJson) : undefined,
    };
  } catch (error) {
    console.error('❌ loadProfileFromCloud error:', error);
    return null;
  }
}

/**
 * Save profile to cloud
 */
export async function saveProfileToCloud(profile: GolferProfile): Promise<boolean> {
  try {
    const client = getAmplifyClient();
    if (!client) return false;

    const cloudData = {
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      firstName: profile.firstName || undefined,
      lastName: profile.lastName || undefined,
      email: profile.email || undefined,
      avatar: profile.avatar || undefined,
      handicapIndex: profile.handicapIndex || undefined,
      preferredTee: profile.preferredTee || undefined,
      preferencesJson: profile.preferences ? JSON.stringify(profile.preferences) : undefined,
      statsJson: profile.stats ? JSON.stringify(profile.stats) : undefined,
      verifiedStatusJson: profile.verifiedStatus ? JSON.stringify(profile.verifiedStatus) : undefined,
    };

    const { data, errors } = await (client.models as any).Profile.update(cloudData);

    if (errors || !data) {
      const createResult = await (client.models as any).Profile.create(cloudData);
      if (createResult.errors) {
        console.error('❌ Profile create failed:', createResult.errors);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ saveProfileToCloud error:', error);
    return false;
  }
}
