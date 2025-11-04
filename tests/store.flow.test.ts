import { describe, it, expect, beforeEach, vi } from 'vitest';

// Disable cloud sync for unit test speed and determinism
vi.stubEnv('VITE_ENABLE_CLOUD_SYNC', 'false');

// Mock idb-keyval to an in-memory map for Zustand persist
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

beforeEach(() => {
  // Reset key parts of state to avoid bleed between tests
  useStore.setState({
    users: [],
    profiles: [],
    currentUser: null,
    currentProfile: null,
    events: [],
    completedEvents: [],
    completedRounds: [],
  } as any, true);
});

describe('store flow (local only)', () => {
  it('creates an event, fills scores, and completes it', async () => {
    const s = useStore.getState();
    // Create user + profile (createUser auto-creates a profile if skipProfile=false)
    s.createUser('tester', 'Tester');
    const profileId = useStore.getState().currentProfile!.id;

    // Create an event (auto-adds current profile as golfer)
    const eventId = s.createEvent()!;
    expect(eventId).toBeTruthy();

    // Fill scores for 18 holes for the current golfer
    for (let hole = 1; hole <= 18; hole++) {
      await s.updateScore(eventId, profileId, hole, 4);
    }

    // Complete event
    const ok = s.completeEvent(eventId);
    expect(ok).toBe(true);

    // Assert event moved to completedEvents and rounds recorded
    const state = useStore.getState();
    expect(state.events.find(e => e.id === eventId)).toBeUndefined();
    expect(state.completedEvents.find(e => e.id === eventId)).toBeTruthy();
    expect(state.completedRounds.length).toBeGreaterThan(0);
  });
});

