/**
 * Event Slice
 * Handles event CRUD, golfer management, scoring, sharing, and chat
 */

import { nanoid } from 'nanoid/non-secure';
import { getCourseById, getTee, getHole } from '../../data/cloudCourses';
import { calculateEventPayouts } from '../../games/payouts';
import { distributeHandicapStrokes, applyESCAdjustment, calculateScoreDifferential } from '../../utils/handicap';
import type { 
  Event, EventGolfer, PlayerScorecard, ChatMessage, 
  CompletedRound, GolferProfile, IndividualRound 
} from '../types';
import { ScoreEntry as HandicapScoreEntry } from '../../types/handicap';

// ============================================================================
// Helpers
// ============================================================================

const defaultScoreArray = (courseId?: string) => {
  const tee = getTee(courseId, undefined);
  const holes = tee?.holes?.length ? tee.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4 } as any));
  return holes.map((h: any) => ({ hole: h.number, strokes: null }));
};

const syncEventToCloud = async (eventId: string, get: () => any) => {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return;
  const event = get().events.find((e: Event) => e.id === eventId);
  const profile = get().currentProfile;
  if (event && profile) {
    try {
      const { saveEventToCloud } = await import('../../utils/eventSync');
      await saveEventToCloud(event, profile.id);
    } catch (error) {
      console.error('Failed to sync event to cloud:', error);
    }
  }
};

// ============================================================================
// State Interface
// ============================================================================

export interface EventSliceState {
  events: Event[];
  completedEvents: Event[];
  completedRounds: CompletedRound[];
  isLoadingEventsFromCloud: boolean;
}

// ============================================================================
// Actions Interface  
// ============================================================================

export interface EventSliceActions {
  createEvent: (initialData?: Partial<Event>) => string | null;
  completeEvent: (eventId: string) => boolean;
  setEventCourse: (eventId: string, courseId: string) => Promise<void>;
  setEventTee: (eventId: string, teeName: string) => Promise<void>;
  updateEvent: (id: string, patch: Partial<Event>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  loadEventsFromCloud: () => Promise<void>;
  refreshEventFromCloud: (eventId: string) => Promise<boolean>;
  importData: (data: Event[]) => void;
  exportData: () => string;
  
  // Golfer management
  addGolferToEvent: (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => Promise<void>;
  updateEventGolfer: (eventId: string, golferId: string, patch: Partial<EventGolfer>) => Promise<void>;
  removeGolferFromEvent: (eventId: string, golferId: string) => Promise<void>;
  
  // Groups
  addGroup: (eventId: string) => void;
  assignGolferToGroup: (eventId: string, groupId: string, golferId: string) => void;
  moveGolferToGroup: (eventId: string, golferId: string, targetGroupId: string | null) => void;
  setGroupTeeTime: (eventId: string, groupId: string, teeTime: string) => void;
  removeGroup: (eventId: string, groupId: string) => void;
  
  // Scoring
  updateScore: (eventId: string, golferId: string, hole: number, strokes: number | null) => Promise<void>;
  canEditScore: (eventId: string, golferId: string) => boolean;
  setScorecardView: (eventId: string, view: 'individual' | 'team' | 'admin') => void;
  
  // Sharing
  generateShareCode: (eventId: string) => Promise<string>;
  joinEventByCode: (shareCode: string) => Promise<{ success: boolean; error?: string; eventId?: string }>;
  
  // Chat
  addChatMessage: (eventId: string, text: string) => Promise<void>;
  clearChat: (eventId: string) => void;
}

export type EventSlice = EventSliceState & EventSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialEventState: EventSliceState = {
  events: [],
  completedEvents: [],
  completedRounds: [],
  isLoadingEventsFromCloud: false,
};

// ============================================================================
// Slice Creator (partial - core actions)
// ============================================================================

export const createEventSlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): EventSliceActions => ({
  createEvent: (initialData?: Partial<Event>) => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) return null;
    
    const id = nanoid(8);
    const eventGolfer: EventGolfer = { 
      profileId: currentProfile.id,
      displayName: currentProfile.name,
      handicapSnapshot: currentProfile.handicapIndex ?? null,
      teeName: undefined,
      handicapOverride: null 
    };
    const scorecard: PlayerScorecard = { 
      golferId: currentProfile.id, 
      scores: defaultScoreArray(initialData?.course?.courseId) 
    };
    const group = { id: nanoid(5), golferIds: [currentProfile.id] };
    
    const newEvent: Event = {
      id,
      hubType: (initialData as any)?.hubType || 'event',
      name: initialData?.name || '',
      date: initialData?.date || new Date().toISOString().slice(0, 10),
      course: initialData?.course || {},
      golfers: [eventGolfer],
      groups: [group],
      scorecards: [scorecard],
      games: { nassau: [], skins: [], pinky: [], greenie: [] },
      ownerProfileId: currentProfile.id,
      scorecardView: 'individual',
      isPublic: false,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      chat: [],
      ...initialData
    };
    set((state: any) => ({ events: [...state.events, newEvent] }));
    return id;
  },
  
  setEventCourse: async (eventId: string, courseId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          course: { courseId },
          scorecards: e.golfers.map(g => ({ 
            golferId: g.profileId || g.customName || '', 
            scores: defaultScoreArray(courseId) 
          })),
          lastModified: new Date().toISOString()
        };
      })
    }));
    await syncEventToCloud(eventId, get);
  },
  
  setEventTee: async (eventId: string, teeName: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const prevEventTee = e.course.teeName;
        return {
          ...e,
          course: { ...e.course, teeName },
          golfers: e.golfers.map(g => {
            if (!g.teeName || g.teeName === prevEventTee) {
              return { ...g, teeName };
            }
            return g;
          }),
          lastModified: new Date().toISOString()
        };
      })
    }));
    await syncEventToCloud(eventId, get);
  },
  
  updateEvent: async (id: string, patch: Partial<Event>) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== id) return e;
        const currentGames = e.games || { nassau: [], skins: [], pinky: [], greenie: [] };
        const updatedGames = patch.games ? {
          nassau: patch.games.nassau ?? currentGames.nassau ?? [],
          skins: patch.games.skins ?? currentGames.skins ?? [],
          pinky: patch.games.pinky ?? currentGames.pinky ?? [],
          greenie: patch.games.greenie ?? currentGames.greenie ?? []
        } : currentGames;
        return { ...e, ...patch, games: updatedGames, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(id, get);
  },
  
  deleteEvent: async (eventId: string) => {
    set((state: any) => ({
      events: state.events.filter((e: Event) => e.id !== eventId),
      completedEvents: state.completedEvents.filter((e: Event) => e.id !== eventId)
    }));
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      try {
        const { deleteEventFromCloud } = await import('../../utils/eventSync');
        await deleteEventFromCloud(eventId);
      } catch (error) {
        console.error('Error deleting event from cloud:', error);
      }
    }
  },

  // Simplified loadEventsFromCloud - keeping core logic, delegating to original in store.ts for now
  loadEventsFromCloud: async () => {
    // This will be implemented in store.ts using the full logic
    // The slice pattern allows us to gradually migrate
  },
  
  refreshEventFromCloud: async (eventId: string) => {
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return false;
    try {
      const { loadEventById } = await import('../../utils/eventSync');
      const updatedEvent = await loadEventById(eventId);
      if (updatedEvent) {
        set((state: any) => ({
          events: state.events.map((e: Event) => e.id === eventId ? updatedEvent : e)
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to refresh event from cloud:', error);
      return false;
    }
  },
  
  importData: (data: Event[]) => set(() => ({ events: data })),
  exportData: () => JSON.stringify(get().events, null, 2),
  
  // Golfer management
  addGolferToEvent: async (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        const isProfileId = state.profiles.some((p: GolferProfile) => p.id === golferId);
        const profile = isProfileId ? state.profiles.find((p: GolferProfile) => p.id === golferId) : null;
        
        const eventGolfer: EventGolfer = isProfileId 
          ? { profileId: golferId, displayName: profile?.name || 'Unknown', handicapSnapshot: profile?.handicapIndex ?? null, teeName: teeName || undefined, handicapOverride: handicapOverride ?? null, gamePreference: 'all' }
          : { customName: golferId, displayName: golferId, handicapSnapshot: null, teeName: teeName || undefined, handicapOverride: handicapOverride ?? null, gamePreference: 'all' };
        
        const tee = getTee(e.course.courseId, e.course.teeName);
        const holes = tee?.holes?.length ? tee.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1 }));
        const scorecard: PlayerScorecard = { golferId, scores: holes.map(h => ({ hole: h.number, strokes: null })) };
        
        let groups = e.groups;
        if (groups.length === 0) {
          groups = [{ id: nanoid(5), golferIds: [golferId] }];
        } else {
          groups = groups.map(g => ({ ...g, golferIds: Array.from(new Set([...g.golferIds, golferId])) }));
        }
        
        return { ...e, golfers: [...e.golfers, eventGolfer], scorecards: [...e.scorecards, scorecard], groups, lastModified: new Date().toISOString() };
      })
    }));
    await syncEventToCloud(eventId, get);
  },
  
  updateEventGolfer: async (eventId: string, golferId: string, patch: Partial<EventGolfer>) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => 
        e.id === eventId 
          ? { ...e, golfers: e.golfers.map(g => (g.profileId === golferId || g.customName === golferId) ? { ...g, ...patch } : g), lastModified: new Date().toISOString() } 
          : e
      )
    }));
    await syncEventToCloud(eventId, get);
  },
  
  removeGolferFromEvent: async (eventId: string, golferId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          golfers: e.golfers.filter(g => g.profileId !== golferId && g.customName !== golferId),
          scorecards: e.scorecards.filter(sc => sc.golferId !== golferId),
          groups: e.groups.map(g => ({ ...g, golferIds: g.golferIds.filter(id => id !== golferId) })),
          lastModified: new Date().toISOString()
        };
      })
    }));
    await syncEventToCloud(eventId, get);
  },
  
  // Groups
  addGroup: (eventId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        if (e.groups.length === 0) {
          return { ...e, groups: [{ id: nanoid(5), golferIds: e.golfers.map(g => g.profileId || g.customName || '') }], lastModified: new Date().toISOString() };
        }
        return e;
      })
    }));
  },
  
  assignGolferToGroup: (eventId: string, groupId: string, golferId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return { ...e, groups: e.groups.map(g => g.id === groupId ? { ...g, golferIds: g.golferIds.includes(golferId) ? g.golferIds : [...g.golferIds, golferId] } : g), lastModified: new Date().toISOString() };
      })
    }));
  },
  
  moveGolferToGroup: (_eventId: string, _golferId: string, _targetGroupId: string | null) => {
    // Not needed in simplified model; keep for compatibility
  },
  
  setGroupTeeTime: (eventId: string, groupId: string, teeTime: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => 
        e.id === eventId ? { ...e, groups: e.groups.map(g => g.id === groupId ? { ...g, teeTime } : g), lastModified: new Date().toISOString() } : e
      )
    }));
  },
  
  removeGroup: (_eventId: string, _groupId: string) => {
    // Prevent removing the single auto group
  },
  
  // Scoring
  updateScore: async (eventId: string, golferId: string, hole: number, strokes: number | null) => {
    const state = get();
    const event = state.events.find((e: Event) => e.id === eventId);
    if (!event) return;

    const eventGolfer = event.golfers.find((g: EventGolfer) => g.profileId === golferId || g.customName === golferId);
    const profile = eventGolfer?.profileId ? state.profiles.find((p: GolferProfile) => p.id === eventGolfer.profileId) : null;
    const playerName = profile ? profile.name : eventGolfer?.customName || 'Unknown Player';

    let holePar = 4;
    const holeData = getHole(event.course.courseId, hole, event.course.teeName);
    if (holeData) holePar = holeData.par;

    let chatMessage = '';
    if (strokes !== null) {
      const toPar = strokes - holePar;
      if (strokes === 1 && holePar > 1) {
        chatMessage = `🎉 HOLE IN ONE! ${playerName} just aced hole ${hole}! 💎`;
      } else if (toPar <= -2) {
        chatMessage = `🦅 EAGLE ALERT! ${playerName} just made an eagle on hole ${hole}! Amazing shot!`;
      } else if (strokes === 8) {
        chatMessage = `⛄ ${playerName} built a snowman on hole ${hole}! Everyone's been there! 🏌️`;
      }
    }

    set((s: any) => ({
      events: s.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return { ...e, scorecards: e.scorecards.map(sc => sc.golferId === golferId ? { ...sc, scores: sc.scores.map(s => s.hole === hole ? { ...s, strokes } : s) } : sc), lastModified: new Date().toISOString() };
      })
    }));

    if (chatMessage.trim()) {
      const msg: ChatMessage = { id: nanoid(10), profileId: 'gimmies-bot', senderName: '🤖 Gimmies Bot', text: chatMessage.trim(), createdAt: new Date().toISOString() };
      set((s: any) => ({
        events: s.events.map((e: Event) => {
          if (e.id !== eventId) return e;
          return { ...e, chat: [...(e.chat || []), msg].slice(-500), lastModified: new Date().toISOString() };
        })
      }));
      get().addToast(chatMessage.trim(), 'achievement', 5000);
    }
    
    await syncEventToCloud(eventId, get);
  },
  
  canEditScore: (eventId: string, golferId: string) => {
    const event = get().events.find((e: Event) => e.id === eventId) || get().completedEvents.find((e: Event) => e.id === eventId);
    const currentProfile = get().currentProfile;
    if (!event || !currentProfile) return false;
    if (event.isCompleted) return false;
    if (event.ownerProfileId === currentProfile.id) return true;
    if (golferId === currentProfile.id) return true;
    if (event.scorecardView === 'team') {
      const userTeams = event.games.nassau.flatMap((nassau: any) => nassau.teams?.filter((team: any) => team.golferIds.includes(currentProfile.id)) || []);
      const teamGolferIds = userTeams.flatMap((team: any) => team.golferIds);
      return teamGolferIds.includes(golferId);
    }
    return false;
  },
  
  setScorecardView: (eventId: string, view: 'individual' | 'team' | 'admin') => {
    set((state: any) => ({
      events: state.events.map((e: Event) => e.id === eventId ? { ...e, scorecardView: view, lastModified: new Date().toISOString() } : e)
    }));
  },
  
  // Sharing
  generateShareCode: async (eventId: string) => {
    const event = get().events.find((e: Event) => e.id === eventId);
    const currentProfile = get().currentProfile;
    if (!event || !currentProfile) return '';

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      try {
        const { saveEventToCloud } = await import('../../utils/eventSync');
        const shareCode = await saveEventToCloud(event, currentProfile.id);
        if (shareCode) {
          set((state: any) => ({
            // Generating a code should not force the game to be discoverable ("public").
            // Public/discoverable is controlled separately via event.isPublic.
            events: state.events.map((e: Event) => e.id === eventId ? { ...e, shareCode, lastModified: new Date().toISOString() } : e)
          }));
          return shareCode;
        }
      } catch (error) {
        console.error('Failed to generate share code in cloud:', error);
      }
    }

    const shareCode = nanoid(6).toUpperCase();
    set((state: any) => ({
      events: state.events.map((e: Event) => e.id === eventId ? { ...e, shareCode, lastModified: new Date().toISOString() } : e)
    }));
    return shareCode;
  },
  
  joinEventByCode: async (shareCode: string) => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) {
      return { success: false, error: 'Please create a profile first to join events.' };
    }

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      try {
        const { loadEventByShareCode } = await import('../../utils/eventSync');
        const cloudEvent = await loadEventByShareCode(shareCode);
        
        if (cloudEvent) {
          const alreadyJoined = cloudEvent.golfers.some((g: EventGolfer) => g.profileId === currentProfile.id);
          if (alreadyJoined) {
            const localEvent = get().events.find((e: Event) => e.id === cloudEvent.id);
            if (!localEvent) {
              set((state: any) => ({ events: [...state.events, cloudEvent] }));
            }
            return { success: true, eventId: cloudEvent.id };
          }

          const localEvent = get().events.find((e: Event) => e.id === cloudEvent.id);
          if (!localEvent) {
            set((state: any) => ({ events: [...state.events, cloudEvent] }));
          } else {
            set((state: any) => ({ events: state.events.map((e: Event) => e.id === cloudEvent.id ? cloudEvent : e) }));
          }

          await get().addGolferToEvent(cloudEvent.id, currentProfile.id);
          return { success: true, eventId: cloudEvent.id };
        }
      } catch (error) {
        console.error('Failed to load event from cloud:', error);
      }
    }

    // Local-only fallback: allow joining invite-only games (not necessarily public/discoverable)
    const event = get().events.find((e: Event) => e.shareCode === shareCode);
    if (!event) {
      return { success: false, error: 'Event not found or share code is invalid.' };
    }
    
    const alreadyJoined = event.golfers.some((g: EventGolfer) => g.profileId === currentProfile.id);
    if (alreadyJoined) {
      return { success: true, eventId: event.id };
    }
    
    await get().addGolferToEvent(event.id, currentProfile.id);
    return { success: true, eventId: event.id };
  },
  
  // Chat
  addChatMessage: async (eventId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const currentProfile = get().currentProfile;
    if (!currentProfile) return;
    
    const msg: ChatMessage = { id: nanoid(10), profileId: currentProfile.id, senderName: currentProfile.name, text: trimmed.slice(0, 2000), createdAt: new Date().toISOString() };
    
    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return { ...e, chat: [...(e.chat || []), msg].slice(-500), lastModified: new Date().toISOString() };
      })
    }));
    
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      try {
        const { saveChatMessageToCloud } = await import('../../utils/eventSync');
        await saveChatMessageToCloud(eventId, msg);
      } catch (error) {
        console.error('Failed to save message to cloud:', error);
      }
    }
  },
  
  clearChat: (eventId: string) => {
    set((state: any) => ({
      events: state.events.map((e: Event) => e.id === eventId ? { ...e, chat: [], lastModified: new Date().toISOString() } : e)
    }));
  },
  
  // completeEvent is complex - keeping in main store.ts for now
  completeEvent: (_eventId: string) => {
    // Will use original implementation in store.ts
    return false;
  },
});
