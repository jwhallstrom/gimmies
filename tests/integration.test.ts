/**
 * Integration Tests
 * Full workflow tests covering multiple slices working together
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
import type { NassauConfig, SkinsConfig } from '../src/state/types';

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

describe('Integration: Full Round Workflow', () => {
  it('completes a full round with scoring', async () => {
    // Setup: Create host
    useStore.getState().createUser('host', 'Host Player');
    const hostId = useStore.getState().currentProfile!.id;
    
    // Create event
    const eventId = useStore.getState().createEvent({ name: 'Saturday Round' })!;
    
    // Enter scores for all 18 holes for host only
    for (let hole = 1; hole <= 18; hole++) {
      await useStore.getState().updateScore(eventId, hostId, hole, 4);
    }
    
    // Complete the event
    const completed = useStore.getState().completeEvent(eventId);
    expect(completed).toBe(true);
    
    // Verify event moved to completed
    expect(useStore.getState().events).toHaveLength(0);
    expect(useStore.getState().completedEvents).toHaveLength(1);
    
    // Verify completed round created
    const rounds = useStore.getState().completedRounds;
    expect(rounds).toHaveLength(1);
    expect(rounds[0].finalScore).toBe(72);
    
    // Verify host's stats updated
    const hostProfile = useStore.getState().profiles.find(p => p.id === hostId);
    expect(hostProfile?.stats.roundsPlayed).toBe(1);
  });

  it('handles partial round (9 holes)', async () => {
    useStore.getState().createUser('player', 'Player');
    const playerId = useStore.getState().currentProfile!.id;
    const eventId = useStore.getState().createEvent()!;
    
    // Only enter front 9
    for (let hole = 1; hole <= 9; hole++) {
      await useStore.getState().updateScore(eventId, playerId, hole, 4);
    }
    
    // Should not be able to complete
    const completed = useStore.getState().completeEvent(eventId);
    expect(completed).toBe(false);
    
    // Event should still be active
    expect(useStore.getState().events).toHaveLength(1);
  });

  it('tracks multiple rounds for handicap calculation', async () => {
    useStore.getState().createUser('regular', 'Regular Player');
    const playerId = useStore.getState().currentProfile!.id;
    
    // Play 3 rounds
    const scores = [
      Array(18).fill(5), // 90
      Array(18).fill(4), // 72
      Array(18).fill(4).map((s, i) => i < 9 ? 5 : 4) // 81
    ];
    
    for (const roundScores of scores) {
      const eventId = useStore.getState().createEvent()!;
      for (let hole = 1; hole <= 18; hole++) {
        await useStore.getState().updateScore(eventId, playerId, hole, roundScores[hole - 1]);
      }
      useStore.getState().completeEvent(eventId);
    }
    
    // Verify 3 completed rounds
    expect(useStore.getState().completedRounds).toHaveLength(3);
    
    // Verify profile stats
    const profile = useStore.getState().profiles.find(p => p.id === playerId);
    expect(profile?.stats.roundsPlayed).toBe(3);
    expect(profile?.stats.bestScore).toBe(72);
  });
});

describe('Integration: User Switching', () => {
  it('maintains separate data for different users', async () => {
    // User 1 creates event
    useStore.getState().createUser('user1', 'User One');
    const user1Id = useStore.getState().currentUser!.id;
    const profile1Id = useStore.getState().currentProfile!.id;
    const event1Id = useStore.getState().createEvent({ name: 'User 1 Event' })!;
    
    // User 2 creates their own event
    useStore.getState().createUser('user2', 'User Two');
    const user2Id = useStore.getState().currentUser!.id;
    const profile2Id = useStore.getState().currentProfile!.id;
    const event2Id = useStore.getState().createEvent({ name: 'User 2 Event' })!;
    
    // Both events exist
    expect(useStore.getState().events).toHaveLength(2);
    
    // Switch back to user 1
    useStore.getState().switchUser(user1Id);
    expect(useStore.getState().currentProfile?.id).toBe(profile1Id);
    
    // Switch to user 2
    useStore.getState().switchUser(user2Id);
    expect(useStore.getState().currentProfile?.id).toBe(profile2Id);
  });
});

describe('Integration: Event Sharing', () => {
  it('supports creating profiles for same user', async () => {
    // Create host
    useStore.getState().createUser('host', 'Host');
    const hostId = useStore.getState().currentProfile!.id;
    
    // Create additional profile (same user, different golfer identity)
    useStore.getState().createProfile('Guest Profile');
    const guestId = useStore.getState().profiles.find(p => p.name === 'Guest Profile')!.id;
    
    // Both profiles should exist
    expect(useStore.getState().profiles).toHaveLength(2);
    expect(hostId).not.toBe(guestId);
  });
});

describe('Integration: Score Entry Permissions', () => {
  it('owner can edit any score', async () => {
    useStore.getState().createUser('owner', 'Owner');
    const eventId = useStore.getState().createEvent()!;
    await useStore.getState().addGolferToEvent(eventId, { customName: 'Guest' });
    
    // Owner can edit guest's score
    expect(useStore.getState().canEditScore(eventId, 'Guest')).toBe(true);
  });

  it('player can edit own score', async () => {
    useStore.getState().createUser('player', 'Player');
    const playerId = useStore.getState().currentProfile!.id;
    const eventId = useStore.getState().createEvent()!;
    
    expect(useStore.getState().canEditScore(eventId, playerId)).toBe(true);
  });
});

describe('Integration: Toast Notifications', () => {
  it('adds and removes toasts', () => {
    useStore.getState().addToast('Test message', 'success');
    
    expect(useStore.getState().toasts).toHaveLength(1);
    expect(useStore.getState().toasts[0].message).toBe('Test message');
    expect(useStore.getState().toasts[0].type).toBe('success');
    
    const toastId = useStore.getState().toasts[0].id;
    useStore.getState().removeToast(toastId);
    
    expect(useStore.getState().toasts).toHaveLength(0);
  });

  it('supports different toast types', () => {
    useStore.getState().addToast('Info', 'info');
    useStore.getState().addToast('Warning', 'warning');
    useStore.getState().addToast('Error', 'error');
    
    const toasts = useStore.getState().toasts;
    expect(toasts).toHaveLength(3);
    expect(toasts.map(t => t.type)).toEqual(['info', 'warning', 'error']);
  });
});
