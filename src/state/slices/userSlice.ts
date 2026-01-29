/**
 * User & Profile Slice
 * Handles user account management and golfer profiles
 */

import { nanoid } from 'nanoid/non-secure';
import type { User, GolferProfile } from '../types';

// ============================================================================
// State Interface
// ============================================================================

export interface UserSliceState {
  currentUser: User | null;
  users: User[];
  currentProfile: GolferProfile | null;
  profiles: GolferProfile[];
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface UserSliceActions {
  // User management
  createUser: (username: string, displayName?: string, skipProfile?: boolean) => void;
  switchUser: (userId: string) => void;
  logout: () => void;
  deleteUser: (userId: string) => void;
  
  // Profile management
  createProfile: (name: string, email?: string, options?: { firstName?: string; lastName?: string }) => void;
  updateProfile: (profileId: string, patch: Partial<GolferProfile>) => void;
  setCurrentProfile: (profileId: string) => void;
  deleteProfile: (profileId: string) => void;
  cleanupDuplicateProfiles: () => void;
  exportProfile: (profileId: string) => string;
  importProfile: (profileData: string) => boolean;
}

export type UserSlice = UserSliceState & UserSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialUserState: UserSliceState = {
  currentUser: null,
  users: [],
  currentProfile: null,
  profiles: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createUserSlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): UserSliceActions => ({
  createUser: (username: string, displayName?: string, skipProfile?: boolean) => {
    const user: User = {
      id: nanoid(8),
      username,
      displayName: displayName || username,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    
    set((state: any) => ({ users: [...state.users, user] }));
    
    if (!get().currentUser) {
      set(() => ({ currentUser: user }));
      
      // Only create profile automatically if skipProfile is false
      if (!skipProfile) {
        const profile: GolferProfile = {
          id: nanoid(8),
          userId: user.id,
          name: user.displayName,
          stats: {
            roundsPlayed: 0,
            averageScore: 0,
            bestScore: 0,
            totalBirdies: 0,
            totalEagles: 0
          },
          preferences: {
            theme: 'dark',
            defaultNetScoring: false,
            autoAdvanceScores: true,
            showHandicapStrokes: true
          },
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        
        set((state: any) => ({ 
          profiles: [...state.profiles, profile],
          currentProfile: profile
        }));
      }
    }
  },
  
  switchUser: (userId: string) => {
    if (!userId) {
      // Logout case
      set(() => ({ 
        currentUser: null,
        currentProfile: null
      }));
      return;
    }
    
    const user = get().users.find((u: User) => u.id === userId);
    if (user) {
      // Find existing profile for this user
      const userProfile = get().profiles.find((p: GolferProfile) => p.userId === userId);
      
      set(() => ({ 
        currentUser: user,
        currentProfile: userProfile || null
      }));
    }
  },
  
  logout: () => {
    set(() => ({ 
      currentUser: null,
      currentProfile: null
    }));
  },
  
  deleteUser: (userId: string) => {
    const state = get();
    set((s: any) => ({
      users: s.users.filter((u: User) => u.id !== userId),
      profiles: s.profiles.filter((p: GolferProfile) => p.userId !== userId),
      events: s.events.filter((e: any) => e.ownerProfileId && 
        !s.profiles.some((p: GolferProfile) => p.id === e.ownerProfileId && p.userId === userId))
    }));
    
    if (state.currentUser?.id === userId) {
      const remainingUsers = get().users.filter((u: User) => u.id !== userId);
      set(() => ({ 
        currentUser: remainingUsers.length > 0 ? remainingUsers[0] : null,
        currentProfile: null
      }));
    }
  },
  
  createProfile: (name: string, email?: string, options?: { firstName?: string; lastName?: string }) => {
    const currentUser = get().currentUser;
    if (!currentUser) return;
    
    // Check if user already has a profile with this name
    const existingProfile = get().profiles.find((p: GolferProfile) => 
      p.userId === currentUser.id && p.name.toLowerCase() === name.toLowerCase()
    );
    if (existingProfile) {
      // If profile exists but isn't current, set it as current
      if (get().currentProfile?.id !== existingProfile.id) {
        set(() => ({ currentProfile: existingProfile }));
      }
      return;
    }
    
    const profile: GolferProfile = {
      id: nanoid(8),
      userId: currentUser.id,
      name,
      firstName: options?.firstName,
      lastName: options?.lastName,
      email,
      stats: {
        roundsPlayed: 0,
        averageScore: 0,
        bestScore: 0,
        totalBirdies: 0,
        totalEagles: 0
      },
      preferences: {
        theme: 'dark',
        defaultNetScoring: false,
        autoAdvanceScores: true,
        showHandicapStrokes: true
      },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    set((state: any) => ({ profiles: [...state.profiles, profile] }));
    
    if (!get().currentProfile) {
      set(() => ({ currentProfile: profile }));
    }
  },
  
  updateProfile: (profileId: string, patch: Partial<GolferProfile>) => {
    set((state: any) => ({
      profiles: state.profiles.map((p: GolferProfile) => 
        p.id === profileId ? { ...p, ...patch, lastActive: new Date().toISOString() } : p
      ),
      currentProfile: state.currentProfile?.id === profileId 
        ? { ...state.currentProfile, ...patch, lastActive: new Date().toISOString() }
        : state.currentProfile
    }));
  },
  
  setCurrentProfile: (profileId: string) => {
    const profile = get().profiles.find((p: GolferProfile) => p.id === profileId);
    if (profile && profile.userId === get().currentUser?.id) {
      set(() => ({ currentProfile: profile }));
    }
  },
  
  deleteProfile: (profileId: string) => {
    set((state: any) => ({
      profiles: state.profiles.filter((p: GolferProfile) => p.id !== profileId),
      events: state.events.filter((e: any) => e.ownerProfileId !== profileId)
    }));
    
    if (get().currentProfile?.id === profileId) {
      const userProfiles = get().profiles.filter((p: GolferProfile) => 
        p.userId === get().currentUser?.id && p.id !== profileId
      );
      set(() => ({ currentProfile: userProfiles.length > 0 ? userProfiles[0] : null }));
    }
    
    // Delete from cloud
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      import('../../utils/profileSync').then(({ deleteProfileFromCloud }) => {
        deleteProfileFromCloud(profileId).then(() => {
          console.log('✅ deleteProfile: Profile deleted from cloud:', profileId);
        }).catch((err: unknown) => {
          console.error('❌ deleteProfile: Failed to delete profile from cloud:', err);
        });
      });
    }
  },
  
  exportProfile: (profileId: string) => {
    const profile = get().profiles.find((p: GolferProfile) => p.id === profileId);
    return profile ? JSON.stringify(profile, null, 2) : '';
  },
  
  importProfile: (profileData: string) => {
    try {
      const profile: GolferProfile = JSON.parse(profileData);
      const currentUser = get().currentUser;
      if (!currentUser || profile.userId !== currentUser.id) return false;
      
      // Check if profile already exists
      const existingIndex = get().profiles.findIndex((p: GolferProfile) => p.id === profile.id);
      if (existingIndex >= 0) {
        // Update existing profile
        set((state: any) => ({
          profiles: state.profiles.map((p: GolferProfile, i: number) => 
            i === existingIndex ? profile : p
          )
        }));
      } else {
        // Add new profile
        set((state: any) => ({ profiles: [...state.profiles, profile] }));
      }
      return true;
    } catch {
      return false;
    }
  },
  
  cleanupDuplicateProfiles: () => {
    const allProfiles = get().profiles;
    const uniqueProfiles = allProfiles.filter((profile: GolferProfile, index: number, self: GolferProfile[]) => 
      index === self.findIndex((p: GolferProfile) => p.name === profile.name && p.userId === profile.userId)
    );
    set(() => ({ profiles: uniqueProfiles }));
  },
});
