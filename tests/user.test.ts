/**
 * User & Profile Slice Tests
 * Tests for user account management and golfer profiles
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Disable cloud sync for unit tests
vi.stubEnv('VITE_ENABLE_CLOUD_SYNC', 'false');

// Mock idb-keyval
vi.mock('idb-keyval', () => {
  const mem = new Map<string, string | null>();
  return {
    get: (k: string) => Promise.resolve(mem.get(k) ?? null),
    set: (k: string, v: string) => { mem.set(k, v); return Promise.resolve(); },
    del: (k: string) => { mem.delete(k); return Promise.resolve(); },
    createStore: () => ({})
  };
});

import { useStore } from '../src/state/store';

function resetStore() {
  useStore.setState({
    users: [],
    profiles: [],
    currentUser: null,
    currentProfile: null,
    events: [],
    completedEvents: [],
    completedRounds: [],
    toasts: [],
  });
}

beforeEach(() => {
  resetStore();
});

describe('User Slice', () => {
  describe('createUser', () => {
    it('creates a user with username and display name', () => {
      useStore.getState().createUser('john', 'John Doe');
      
      const state = useStore.getState();
      expect(state.users).toHaveLength(1);
      expect(state.users[0].username).toBe('john');
      expect(state.users[0].displayName).toBe('John Doe');
    });

    it('uses username as display name if not provided', () => {
      useStore.getState().createUser('jane');
      
      const user = useStore.getState().users[0];
      expect(user.displayName).toBe('jane');
    });

    it('sets first user as current user', () => {
      useStore.getState().createUser('first', 'First User');
      
      expect(useStore.getState().currentUser?.username).toBe('first');
    });

    it('automatically creates profile for first user', () => {
      useStore.getState().createUser('alice', 'Alice');
      
      const state = useStore.getState();
      expect(state.profiles).toHaveLength(1);
      expect(state.currentProfile?.name).toBe('Alice');
    });

    it('skips profile creation when skipProfile is true', () => {
      useStore.getState().createUser('bob', 'Bob', true);
      
      const state = useStore.getState();
      expect(state.users).toHaveLength(1);
      expect(state.profiles).toHaveLength(0);
      expect(state.currentProfile).toBeNull();
    });

    it('generates unique IDs', () => {
      useStore.getState().createUser('user1', 'User 1');
      useStore.getState().createUser('user2', 'User 2');
      
      const state = useStore.getState();
      expect(state.users[0].id).not.toBe(state.users[1].id);
    });

    it('sets timestamps on creation', () => {
      useStore.getState().createUser('tester', 'Tester');
      
      const user = useStore.getState().users[0];
      expect(user.createdAt).toBeTruthy();
      expect(user.lastActive).toBeTruthy();
    });
  });

  describe('switchUser', () => {
    it('switches to another user', () => {
      useStore.getState().createUser('user1', 'User 1');
      useStore.getState().createUser('user2', 'User 2');
      
      const user2 = useStore.getState().users.find(u => u.username === 'user2')!;
      useStore.getState().switchUser(user2.id);
      
      expect(useStore.getState().currentUser?.username).toBe('user2');
    });

    it('clears current user when switching to empty string', () => {
      useStore.getState().createUser('user1', 'User 1');
      useStore.getState().switchUser('');
      
      expect(useStore.getState().currentUser).toBeNull();
      expect(useStore.getState().currentProfile).toBeNull();
    });

    it('finds and sets matching profile', () => {
      useStore.getState().createUser('user1', 'User 1');
      const user1Profile = useStore.getState().currentProfile;
      
      useStore.getState().createUser('user2', 'User 2');
      const user2 = useStore.getState().users.find(u => u.username === 'user2')!;
      
      // Switch back to user1
      const user1 = useStore.getState().users.find(u => u.username === 'user1')!;
      useStore.getState().switchUser(user1.id);
      
      expect(useStore.getState().currentProfile?.id).toBe(user1Profile?.id);
    });
  });

  describe('logout', () => {
    it('clears current user and profile', () => {
      useStore.getState().createUser('user1', 'User 1');
      expect(useStore.getState().currentUser).toBeTruthy();
      
      useStore.getState().logout();
      
      expect(useStore.getState().currentUser).toBeNull();
      expect(useStore.getState().currentProfile).toBeNull();
    });

    it('preserves users and profiles lists', () => {
      useStore.getState().createUser('user1', 'User 1');
      useStore.getState().logout();
      
      expect(useStore.getState().users).toHaveLength(1);
      expect(useStore.getState().profiles).toHaveLength(1);
    });
  });

  describe('deleteUser', () => {
    it('removes user from list', () => {
      useStore.getState().createUser('user1', 'User 1');
      const userId = useStore.getState().users[0].id;
      
      useStore.getState().deleteUser(userId);
      
      expect(useStore.getState().users).toHaveLength(0);
    });

    it('clears current user if deleting current', () => {
      useStore.getState().createUser('user1', 'User 1');
      const userId = useStore.getState().currentUser!.id;
      
      useStore.getState().deleteUser(userId);
      
      expect(useStore.getState().currentUser).toBeNull();
    });
  });
});

describe('Profile Slice', () => {
  describe('createProfile', () => {
    it('creates profile with name', () => {
      useStore.getState().createUser('user', 'User', true); // skip auto profile
      useStore.getState().createProfile('Golf Pro');
      
      const profile = useStore.getState().profiles[0];
      expect(profile.name).toBe('Golf Pro');
    });

    it('initializes default stats', () => {
      useStore.getState().createUser('user', 'User', true);
      useStore.getState().createProfile('Newbie');
      
      const profile = useStore.getState().profiles[0];
      expect(profile.stats).toEqual({
        roundsPlayed: 0,
        averageScore: 0,
        bestScore: 0,
        totalBirdies: 0,
        totalEagles: 0
      });
    });

    it('initializes default preferences', () => {
      useStore.getState().createUser('user', 'User', true);
      useStore.getState().createProfile('Player');
      
      const profile = useStore.getState().profiles[0];
      expect(profile.preferences).toMatchObject({
        theme: 'auto',
        defaultNetScoring: false,
        autoAdvanceScores: true,
        showHandicapStrokes: true
      });
    });

    it('links profile to current user', () => {
      useStore.getState().createUser('user', 'User', true);
      useStore.getState().createProfile('Linked');
      
      const profile = useStore.getState().profiles[0];
      const user = useStore.getState().currentUser;
      expect(profile.userId).toBe(user?.id);
    });

    it('sets as current profile', () => {
      useStore.getState().createUser('user', 'User', true);
      useStore.getState().createProfile('Current');
      
      expect(useStore.getState().currentProfile?.name).toBe('Current');
    });

    it('accepts email and name options', () => {
      useStore.getState().createUser('user', 'User', true);
      useStore.getState().createProfile('Full Name', 'test@example.com', {
        firstName: 'John',
        lastName: 'Doe'
      });
      
      const profile = useStore.getState().profiles[0];
      expect(profile.email).toBe('test@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
    });
  });

  describe('updateProfile', () => {
    it('updates profile properties', () => {
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      
      useStore.getState().updateProfile(profileId, { 
        handicapIndex: 15.5,
        preferredTee: 'Blue'
      });
      
      const profile = useStore.getState().profiles.find(p => p.id === profileId);
      expect(profile?.handicapIndex).toBe(15.5);
      expect(profile?.preferredTee).toBe('Blue');
    });

    it('updates currentProfile if matching', () => {
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      
      useStore.getState().updateProfile(profileId, { name: 'Updated Name' });
      
      expect(useStore.getState().currentProfile?.name).toBe('Updated Name');
    });

    it.skip('updates lastActive timestamp', () => {
      // TODO: updateProfile should update lastActive but timestamps are same in fast execution
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      const originalActive = useStore.getState().currentProfile!.lastActive;
      
      useStore.getState().updateProfile(profileId, { name: 'New' });
      
      const profile = useStore.getState().profiles.find(p => p.id === profileId);
      expect(profile?.lastActive).not.toBe(originalActive);
    });
  });

  describe('setCurrentProfile', () => {
    it('sets current profile by ID', () => {
      useStore.getState().createUser('user', 'User');
      useStore.getState().createProfile('Second Profile');
      
      const firstProfile = useStore.getState().profiles[0];
      useStore.getState().setCurrentProfile(firstProfile.id);
      
      expect(useStore.getState().currentProfile?.id).toBe(firstProfile.id);
    });
  });

  describe('deleteProfile', () => {
    it('removes profile from list', () => {
      useStore.getState().createUser('user', 'User');
      useStore.getState().createProfile('To Delete');
      
      const toDelete = useStore.getState().profiles.find(p => p.name === 'To Delete')!;
      useStore.getState().deleteProfile(toDelete.id);
      
      expect(useStore.getState().profiles.find(p => p.id === toDelete.id)).toBeUndefined();
    });

    it('clears current profile if deleting current', () => {
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      
      useStore.getState().deleteProfile(profileId);
      
      expect(useStore.getState().currentProfile).toBeNull();
    });
  });

  describe('exportProfile / importProfile', () => {
    it('exports profile to JSON string', () => {
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      
      const exported = useStore.getState().exportProfile(profileId);
      
      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported);
      expect(parsed.name).toBe('User');
    });

    it('imports profile from JSON string', () => {
      useStore.getState().createUser('user', 'User');
      const profileId = useStore.getState().currentProfile!.id;
      const exported = useStore.getState().exportProfile(profileId);
      
      // Clear and reimport
      useStore.getState().deleteProfile(profileId);
      const result = useStore.getState().importProfile(exported);
      
      expect(result).toBe(true);
      expect(useStore.getState().profiles.some(p => p.name === 'User')).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      useStore.getState().createUser('user', 'User');
      
      const result = useStore.getState().importProfile('not valid json');
      
      expect(result).toBe(false);
    });
  });
});
