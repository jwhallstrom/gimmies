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
  // Reset data parts of state without replacing functions
  // Using false (partial) instead of true (replace) keeps the functions
  useStore.setState({
    users: [],
    profiles: [],
    currentUser: null,
    currentProfile: null,
    events: [],
    completedEvents: [],
    completedRounds: [],
  });
});

describe('store', () => {
  it('creates a user and profile', () => {
    const s = useStore.getState();
    s.createUser('tester', 'Tester');
    
    const state = useStore.getState();
    expect(state.currentUser).toBeTruthy();
    expect(state.currentProfile).toBeTruthy();
    expect(state.profiles.length).toBe(1);
  });

  it('creates event after profile exists', () => {
    const s = useStore.getState();
    // First create a user (which also creates a profile)
    s.createUser('tester', 'Tester');
    
    // Now create an event
    const eventId = s.createEvent();
    expect(eventId).toBeTruthy();
    
    const events = useStore.getState().events;
    expect(events.length).toBe(1);
    expect(events[0].id).toBe(eventId);
  });

  it('does not create event without profile', () => {
    const eventId = useStore.getState().createEvent();
    expect(eventId).toBeNull();
    expect(useStore.getState().events.length).toBe(0);
  });
});
