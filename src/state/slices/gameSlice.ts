/**
 * Game Slice
 * Handles game configuration actions (Nassau, Skins, Pinky, Greenie)
 */

import type { PinkyResult, GreenieResult, Event } from '../types';

// ============================================================================
// Helper Function
// ============================================================================

const syncEventToCloud = async (eventId: string, get: () => any) => {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return;
  
  const event = get().events.find((e: Event) => e.id === eventId);
  const profile = get().currentProfile;
  
  if (event && profile) {
    try {
      const { saveEventToCloud } = await import('../../utils/eventSync');
      await saveEventToCloud(event, profile.id);
      console.log('✅ Game config synced to cloud:', eventId);
    } catch (error) {
      console.error('Failed to sync game config to cloud:', error);
    }
  }
};

// ============================================================================
// Actions Interface
// ============================================================================

export interface GameSliceActions {
  removeNassau: (eventId: string, nassauId: string) => Promise<void>;
  removeSkins: (eventId: string, skinsId: string) => Promise<void>;
  removePinky: (eventId: string, pinkyId: string) => Promise<void>;
  setPinkyResults: (eventId: string, pinkyId: string, results: PinkyResult[]) => Promise<void>;
  removeGreenie: (eventId: string, greenieId: string) => Promise<void>;
  setGreenieResults: (eventId: string, greenieId: string, results: GreenieResult[]) => Promise<void>;
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createGameSlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): GameSliceActions => ({
  removeNassau: async (eventId: string, nassauId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => 
        e.id === eventId 
          ? { 
              ...e, 
              games: { ...e.games, nassau: e.games.nassau.filter(n => n.id !== nassauId) },
              lastModified: new Date().toISOString()
            } 
          : e
      )
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
  
  removeSkins: async (eventId: string, skinsId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const skinsArr = Array.isArray(e.games.skins) ? e.games.skins : (e.games.skins ? [e.games.skins as any] : []);
        return { 
          ...e, 
          games: { ...e.games, skins: skinsArr.filter(s => s.id !== skinsId) },
          lastModified: new Date().toISOString()
        };
      })
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
  
  removePinky: async (eventId: string, pinkyId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const pinkyArr = Array.isArray(e.games.pinky) ? e.games.pinky : [];
        return { 
          ...e, 
          games: { ...e.games, pinky: pinkyArr.filter(p => p.id !== pinkyId) },
          lastModified: new Date().toISOString()
        };
      })
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
  
  setPinkyResults: async (eventId: string, pinkyId: string, results: PinkyResult[]) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const pinkyResults = e.pinkyResults || {};
        return {
          ...e,
          pinkyResults: { ...pinkyResults, [pinkyId]: results },
          lastModified: new Date().toISOString()
        };
      })
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
  
  removeGreenie: async (eventId: string, greenieId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const greenieArr = Array.isArray(e.games.greenie) ? e.games.greenie : [];
        return { 
          ...e, 
          games: { ...e.games, greenie: greenieArr.filter(g => g.id !== greenieId) },
          lastModified: new Date().toISOString()
        };
      })
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
  
  setGreenieResults: async (eventId: string, greenieId: string, results: GreenieResult[]) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const greenieResults = e.greenieResults || {};
        return {
          ...e,
          greenieResults: { ...greenieResults, [greenieId]: results },
          lastModified: new Date().toISOString()
        };
      })
    }));
    
    // Sync to cloud
    await syncEventToCloud(eventId, get);
  },
});
