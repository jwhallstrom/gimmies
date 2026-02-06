/**
 * Game Slice
 * Handles game configuration actions for all game types
 */

import type { PinkyResult, GreenieResult, BingoBangoBongoHoleResult, WolfHoleResult, DotsPlayerResult, Event } from '../types';

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
  // New game types
  removeStableford: (eventId: string, configId: string) => Promise<void>;
  removeNinePoint: (eventId: string, configId: string) => Promise<void>;
  removeBingoBangoBongo: (eventId: string, configId: string) => Promise<void>;
  setBBBResults: (eventId: string, configId: string, results: BingoBangoBongoHoleResult[]) => Promise<void>;
  removeWolf: (eventId: string, configId: string) => Promise<void>;
  setWolfResults: (eventId: string, configId: string, results: WolfHoleResult[]) => Promise<void>;
  removeDots: (eventId: string, configId: string) => Promise<void>;
  setDotsResults: (eventId: string, configId: string, results: DotsPlayerResult[]) => Promise<void>;
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
    await syncEventToCloud(eventId, get);
  },

  // ============================================================================
  // New Game Types
  // ============================================================================

  removeStableford: async (eventId: string, configId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const arr = Array.isArray(e.games.stableford) ? e.games.stableford : [];
        return { ...e, games: { ...e.games, stableford: arr.filter(s => s.id !== configId) }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  removeNinePoint: async (eventId: string, configId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const arr = Array.isArray(e.games.ninePoint) ? e.games.ninePoint : [];
        return { ...e, games: { ...e.games, ninePoint: arr.filter(s => s.id !== configId) }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  removeBingoBangoBongo: async (eventId: string, configId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const arr = Array.isArray(e.games.bingoBangoBongo) ? e.games.bingoBangoBongo : [];
        return { ...e, games: { ...e.games, bingoBangoBongo: arr.filter(s => s.id !== configId) }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  setBBBResults: async (eventId: string, configId: string, results: BingoBangoBongoHoleResult[]) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const bbbResults = e.bbbResults || {};
        return { ...e, bbbResults: { ...bbbResults, [configId]: results }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  removeWolf: async (eventId: string, configId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const arr = Array.isArray(e.games.wolf) ? e.games.wolf : [];
        return { ...e, games: { ...e.games, wolf: arr.filter(s => s.id !== configId) }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  setWolfResults: async (eventId: string, configId: string, results: WolfHoleResult[]) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const wolfResults = e.wolfResults || {};
        return { ...e, wolfResults: { ...wolfResults, [configId]: results }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  removeDots: async (eventId: string, configId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const arr = Array.isArray(e.games.dots) ? e.games.dots : [];
        return { ...e, games: { ...e.games, dots: arr.filter(s => s.id !== configId) }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },

  setDotsResults: async (eventId: string, configId: string, results: DotsPlayerResult[]) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const dotsResults = e.dotsResults || {};
        return { ...e, dotsResults: { ...dotsResults, [configId]: results }, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },
});
