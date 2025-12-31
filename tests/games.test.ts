/**
 * Game Configuration Tests
 * Tests for Nassau, Skins, Pinky, and Greenie game setup and results
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
import type { NassauConfig, SkinsConfig, PinkyConfig, GreenieConfig } from '../src/state/types';

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

function setupEventWithGolfers() {
  useStore.getState().createUser('host', 'Host');
  const eventId = useStore.getState().createEvent()!;
  
  // Add more golfers
  useStore.getState().addGolferToEvent(eventId, { customName: 'Player 2' });
  useStore.getState().addGolferToEvent(eventId, { customName: 'Player 3' });
  useStore.getState().addGolferToEvent(eventId, { customName: 'Player 4' });
  
  return eventId;
}

beforeEach(() => {
  resetStore();
});

describe('Game Slice', () => {
  describe('Nassau', () => {
    it('adds Nassau game to event via updateEvent', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const nassau: NassauConfig = {
        id: 'nassau-1',
        type: 'individual',
        betAmount: 5,
        participants: event.golfers.map(g => g.profileId || g.customName!),
        useHandicaps: true,
        autoPresses: false
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, nassau: [nassau] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.nassau).toHaveLength(1);
      expect(updated?.games.nassau[0].betAmount).toBe(5);
    });

    it('removes Nassau game', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      // Add Nassau first
      const nassau: NassauConfig = {
        id: 'nassau-1',
        type: 'individual',
        betAmount: 10,
        participants: [],
        useHandicaps: true,
        autoPresses: false
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, nassau: [nassau] }
      });
      
      // Now remove it
      useStore.getState().removeNassau(eventId, 'nassau-1');
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.nassau).toHaveLength(0);
    });

    it('supports team Nassau', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const nassau: NassauConfig = {
        id: 'nassau-team',
        type: 'team',
        betAmount: 20,
        participants: [],
        useHandicaps: true,
        autoPresses: false,
        teams: [
          { id: 'team-a', name: 'Team A', golferIds: [event.golfers[0].profileId!, event.golfers[1].customName!] },
          { id: 'team-b', name: 'Team B', golferIds: [event.golfers[2].customName!, event.golfers[3].customName!] }
        ]
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, nassau: [nassau] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.nassau[0].type).toBe('team');
      expect(updated?.games.nassau[0].teams).toHaveLength(2);
    });
  });

  describe('Skins', () => {
    it('adds Skins game to event', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const skins: SkinsConfig = {
        id: 'skins-1',
        betAmount: 2,
        participants: event.golfers.map(g => g.profileId || g.customName!),
        useHandicaps: true,
        carryover: true
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, skins: [skins] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.skins).toHaveLength(1);
      expect(updated?.games.skins[0].carryover).toBe(true);
    });

    it('removes Skins game', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const skins: SkinsConfig = {
        id: 'skins-1',
        betAmount: 2,
        participants: [],
        useHandicaps: false,
        carryover: false
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, skins: [skins] }
      });
      
      useStore.getState().removeSkins(eventId, 'skins-1');
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.skins).toHaveLength(0);
    });
  });

  describe('Pinky', () => {
    it('adds Pinky game to event', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const pinky: PinkyConfig = {
        id: 'pinky-1',
        betAmount: 1,
        participants: event.golfers.map(g => g.profileId || g.customName!),
        holes: [4, 8, 12, 16] // Par 3s typically
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, pinky: [pinky] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.pinky).toHaveLength(1);
      expect(updated?.games.pinky[0].holes).toContain(4);
    });

    it('removes Pinky game', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const pinky: PinkyConfig = {
        id: 'pinky-1',
        betAmount: 1,
        participants: [],
        holes: [4]
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, pinky: [pinky] }
      });
      
      useStore.getState().removePinky(eventId, 'pinky-1');
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.pinky).toHaveLength(0);
    });

    it('sets Pinky results', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      const hostId = event.golfers[0].profileId!;
      
      const pinky: PinkyConfig = {
        id: 'pinky-1',
        betAmount: 1,
        participants: [hostId, 'Player 2'],
        holes: [4]
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, pinky: [pinky] }
      });
      
      // Set result - Host wins on hole 4
      useStore.getState().setPinkyResults(eventId, 'pinky-1', {
        4: { winnerId: hostId, distance: '15 feet' }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.pinkyResults?.['pinky-1']?.[4]?.winnerId).toBe(hostId);
    });
  });

  describe('Greenie', () => {
    it('adds Greenie game to event', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const greenie: GreenieConfig = {
        id: 'greenie-1',
        betAmount: 2,
        participants: event.golfers.map(g => g.profileId || g.customName!),
        holes: [4, 8, 12, 16]
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, greenie: [greenie] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.greenie).toHaveLength(1);
    });

    it('removes Greenie game', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const greenie: GreenieConfig = {
        id: 'greenie-1',
        betAmount: 2,
        participants: [],
        holes: [4]
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, greenie: [greenie] }
      });
      
      useStore.getState().removeGreenie(eventId, 'greenie-1');
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.greenie).toHaveLength(0);
    });

    it('sets Greenie results', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const greenie: GreenieConfig = {
        id: 'greenie-1',
        betAmount: 2,
        participants: ['Player 2', 'Player 3'],
        holes: [4]
      };
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, greenie: [greenie] }
      });
      
      // Player 2 wins greenie on hole 4
      useStore.getState().setGreenieResults(eventId, 'greenie-1', {
        4: { winnerId: 'Player 2', distance: '6 inches' }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.greenieResults?.['greenie-1']?.[4]?.winnerId).toBe('Player 2');
    });
  });

  describe('Multiple games', () => {
    it('supports multiple games of same type', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      
      const nassau1: NassauConfig = {
        id: 'nassau-1',
        type: 'individual',
        betAmount: 5,
        participants: [event.golfers[0].profileId!, event.golfers[1].customName!],
        useHandicaps: true,
        autoPresses: false
      };
      
      const nassau2: NassauConfig = {
        id: 'nassau-2',
        type: 'individual',
        betAmount: 10,
        participants: [event.golfers[2].customName!, event.golfers[3].customName!],
        useHandicaps: false,
        autoPresses: true
      };
      
      useStore.getState().updateEvent(eventId, {
        games: { ...event.games, nassau: [nassau1, nassau2] }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.nassau).toHaveLength(2);
    });

    it('supports different game types simultaneously', async () => {
      const eventId = setupEventWithGolfers();
      const event = useStore.getState().events.find(e => e.id === eventId)!;
      const participants = event.golfers.map(g => g.profileId || g.customName!);
      
      useStore.getState().updateEvent(eventId, {
        games: {
          nassau: [{
            id: 'nassau-1',
            type: 'individual',
            betAmount: 5,
            participants,
            useHandicaps: true,
            autoPresses: false
          }],
          skins: [{
            id: 'skins-1',
            betAmount: 2,
            participants,
            useHandicaps: true,
            carryover: true
          }],
          pinky: [{
            id: 'pinky-1',
            betAmount: 1,
            participants,
            holes: [4, 12]
          }],
          greenie: [{
            id: 'greenie-1',
            betAmount: 2,
            participants,
            holes: [4, 8, 12, 16]
          }]
        }
      });
      
      const updated = useStore.getState().events.find(e => e.id === eventId);
      expect(updated?.games.nassau).toHaveLength(1);
      expect(updated?.games.skins).toHaveLength(1);
      expect(updated?.games.pinky).toHaveLength(1);
      expect(updated?.games.greenie).toHaveLength(1);
    });
  });
});
