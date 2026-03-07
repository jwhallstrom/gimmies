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
  addChatMessage: (eventId: string, text: string, options?: { replyTo?: string; type?: string; metadata?: Record<string, any>; pollQuestion?: string; pollOptions?: { id: string; text: string; votes: string[] }[]; mentions?: string[] }) => Promise<void>;
  clearChat: (eventId: string) => void;
  toggleReaction: (eventId: string, messageId: string, emoji: string) => void;
  deleteMessage: (eventId: string, messageId: string) => void;
  votePoll: (eventId: string, messageId: string, optionId: string) => void;
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
    
    const isGroup = ((initialData as any)?.hubType || 'event') === 'group';
    
    const newEvent: Event = {
      id,
      hubType: (initialData as any)?.hubType || 'event',
      name: initialData?.name || '',
      date: initialData?.date || new Date().toISOString().slice(0, 10),
      course: initialData?.course || {},
      golfers: [eventGolfer],
      groups: [group],
      scorecards: [scorecard],
      games: { nassau: [], skins: [], pinky: [], greenie: [], stableford: [], ninePoint: [], bingoBangoBongo: [], wolf: [], dots: [] },
      ownerProfileId: currentProfile.id,
      scorecardView: 'individual',
      isPublic: isGroup ? false : true,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      chat: [],
      // Groups default to private + invite-only (Phase 1)
      ...(isGroup ? {
        groupSettings: {
          visibility: 'private' as const,
          joinPolicy: 'invite_only' as const,
          membersCanInvite: true,
        },
      } : {}),
      ...initialData
    };
    set((state: any) => ({ events: [...state.events, newEvent] }));
    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      void syncEventToCloud(id, get);
    }
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
        const currentGames = e.games || { nassau: [], skins: [], pinky: [], greenie: [], stableford: [], ninePoint: [], bingoBangoBongo: [], wolf: [], dots: [] };
        const updatedGames = patch.games ? {
          nassau: patch.games.nassau ?? currentGames.nassau ?? [],
          skins: patch.games.skins ?? currentGames.skins ?? [],
          pinky: patch.games.pinky ?? currentGames.pinky ?? [],
          greenie: patch.games.greenie ?? currentGames.greenie ?? [],
          stableford: patch.games.stableford ?? currentGames.stableford ?? [],
          ninePoint: patch.games.ninePoint ?? currentGames.ninePoint ?? [],
          bingoBangoBongo: patch.games.bingoBangoBongo ?? currentGames.bingoBangoBongo ?? [],
          wolf: patch.games.wolf ?? currentGames.wolf ?? [],
          dots: patch.games.dots ?? currentGames.dots ?? [],
        } : currentGames;
        return { ...e, ...patch, games: updatedGames, lastModified: new Date().toISOString() };
      })
    }));

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      const rosterKeysTouched =
        'golfers' in patch ||
        'groups' in patch ||
        'scorecards' in patch;

      if (rosterKeysTouched) {
        await syncEventToCloud(id, get);
      } else {
        try {
          const event = get().events.find((e: Event) => e.id === id);
          const profile = get().currentProfile;
          if (event && profile) {
            const { saveEventPatchToCloud } = await import('../../utils/eventSync');
            await saveEventPatchToCloud(event, patch, profile.id);
          }
        } catch (error) {
          console.error('Failed to sync event patch to cloud:', error);
        }
      }
    }
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

        const alreadyInEvent = e.golfers.some(
          (g: EventGolfer) => g.profileId === golferId || g.customName === golferId
        );
        const hasScorecard = e.scorecards.some((sc: PlayerScorecard) => sc.golferId === golferId);

        if (alreadyInEvent && hasScorecard) {
          return e;
        }

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

        const golfers = alreadyInEvent ? e.golfers : [...e.golfers, eventGolfer];
        const scorecards = hasScorecard ? e.scorecards : [...e.scorecards, scorecard];

        return { ...e, golfers, scorecards, groups, lastModified: new Date().toISOString() };
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
    if (!get().canEditScore(eventId, golferId)) return;

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
      const chatTargetId = event.parentGroupId || eventId;
      set((s: any) => ({
        events: s.events.map((e: Event) => {
          if (e.id !== chatTargetId) return e;
          return { ...e, chat: [...(e.chat || []), msg].slice(-500), lastModified: new Date().toISOString() };
        }),
        completedEvents: s.completedEvents.map((e: Event) => {
          if (e.id !== chatTargetId) return e;
          return { ...e, chat: [...(e.chat || []), msg].slice(-500), lastModified: new Date().toISOString() };
        }),
      }));
      get().addToast(chatMessage.trim(), 'achievement', 5000);

      if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
        try {
          const { saveChatMessageToCloud } = await import('../../utils/eventSync');
          await saveChatMessageToCloud(chatTargetId, msg);
        } catch (error) {
          console.error('Failed to save bot message to cloud:', error);
        }
      }
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
    const nassauGames = Array.isArray(event.games?.nassau) ? event.games.nassau : [];
    const userTeams = nassauGames.flatMap(
      (nassau: any) => nassau.teams?.filter((team: any) => (team.golferIds || []).includes(currentProfile.id)) || []
    );
    const teamGolferIds = new Set(userTeams.flatMap((team: any) => team.golferIds || []));
    if (teamGolferIds.has(golferId)) return true;
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

    const createSafeLocalShareCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      return code;
    };

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

      // Cloud mode but couldn't persist the code: don't generate a local-only code that others can't join.
      try {
        get().addToast?.('Could not create an invite code right now. Please try again.', 'error', 3500);
      } catch {
        // ignore
      }
      return '';
    }

    // Local-only mode
    const shareCode = createSafeLocalShareCode();
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

    const normalized = String(shareCode || '').trim().toUpperCase();
    if (!normalized) {
      return { success: false, error: 'Please enter a valid join code.' };
    }

    if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      try {
        const { joinHubByShareCodeInCloud, loadEventById } = await import('../../utils/eventSync');
        const joinResult = await joinHubByShareCodeInCloud(normalized, currentProfile.id, currentProfile.name);
        if (joinResult.success && joinResult.eventId) {
          const cloudEvent = await loadEventById(joinResult.eventId);
          if (!cloudEvent) {
            return {
              success: false,
              error: 'Join did not complete in cloud. Please try again.',
            };
          }
          const localEvent = get().events.find((e: Event) => e.id === cloudEvent.id);
          if (!localEvent) {
            set((state: any) => ({ events: [...state.events, cloudEvent] }));
          } else {
            set((state: any) => ({ events: state.events.map((e: Event) => e.id === cloudEvent.id ? cloudEvent : e) }));
          }
          return { success: true, eventId: joinResult.eventId };
        }
        return { success: false, error: joinResult.error || 'Could not join this event right now.' };
      } catch (error) {
        console.error('Failed to load event from cloud:', error);
        return { success: false, error: 'Could not join this event right now.' };
      }
    }

    // Local-only fallback: allow joining invite-only games (not necessarily public/discoverable)
    const event = get().events.find((e: Event) => (e.shareCode || '').toUpperCase() === normalized);
    if (!event) {
      return { success: false, error: 'Event not found or share code is invalid.' };
    }

    if (event.hubType === 'group') {
      const groupSettings = event.groupSettings || {
        visibility: 'private' as const,
        joinPolicy: 'open' as const,
        membersCanInvite: true,
      };
      if (groupSettings.joinPolicy !== 'open') {
        if (groupSettings.joinPolicy === 'invite_only') {
          return { success: false, error: 'This group is invite-only. Ask an admin to add you.' };
        }
        return { success: false, error: 'This group requires join approval. Request flow is not enabled yet.' };
      }
    }
    
    const alreadyJoined = event.golfers.some((g: EventGolfer) => g.profileId === currentProfile.id);
    if (alreadyJoined) {
      return { success: true, eventId: event.id };
    }
    
    await get().addGolferToEvent(event.id, currentProfile.id);
    return { success: true, eventId: event.id };
  },
  
  // Chat
  addChatMessage: async (eventId: string, text: string, options?: { replyTo?: string; type?: string; metadata?: Record<string, any>; pollQuestion?: string; pollOptions?: { id: string; text: string; votes: string[] }[]; mentions?: string[] }) => {
    const trimmed = text.trim();
    if (!trimmed && !options?.pollQuestion) return;
    const currentProfile = get().currentProfile;
    if (!currentProfile) return;
    
    const msg: ChatMessage = {
      id: nanoid(10),
      profileId: currentProfile.id,
      senderName: currentProfile.name,
      text: trimmed.slice(0, 2000),
      createdAt: new Date().toISOString(),
      type: (options?.type as any) || 'text',
      replyTo: options?.replyTo,
      metadata: options?.metadata,
      pollQuestion: options?.pollQuestion,
      pollOptions: options?.pollOptions,
      reactions: {},
      mentions: options?.mentions?.length ? options.mentions : undefined,
    };
    
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
  
  toggleReaction: (eventId: string, messageId: string, emoji: string) => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) return;
    
    let updatedMessage: ChatMessage | null = null;

    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            const current = reactions[emoji] || [];
            if (current.includes(currentProfile.id)) {
              reactions[emoji] = current.filter((id: string) => id !== currentProfile.id);
              if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
              reactions[emoji] = [...current, currentProfile.id];
            }
            const next = { ...m, reactions };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
      completedEvents: state.completedEvents.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId) return m;
            const reactions = { ...(m.reactions || {}) };
            const current = reactions[emoji] || [];
            if (current.includes(currentProfile.id)) {
              reactions[emoji] = current.filter((id: string) => id !== currentProfile.id);
              if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
              reactions[emoji] = [...current, currentProfile.id];
            }
            const next = { ...m, reactions };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
    }));

    if (updatedMessage && import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      void (async () => {
        try {
          const { updateChatMessageInCloud } = await import('../../utils/eventSync');
          await updateChatMessageInCloud(eventId, updatedMessage as ChatMessage);
        } catch (error) {
          console.error('Failed to sync reaction to cloud:', error);
        }
      })();
    }
  },
  
  deleteMessage: (eventId: string, messageId: string) => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) return;
    
    let updatedMessage: ChatMessage | null = null;

    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId || m.profileId !== currentProfile.id) return m;
            const next = { ...m, isDeleted: true, text: '', editedAt: new Date().toISOString() };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
      completedEvents: state.completedEvents.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId || m.profileId !== currentProfile.id) return m;
            const next = { ...m, isDeleted: true, text: '', editedAt: new Date().toISOString() };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
    }));

    if (updatedMessage && import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      void (async () => {
        try {
          const { updateChatMessageInCloud } = await import('../../utils/eventSync');
          await updateChatMessageInCloud(eventId, updatedMessage as ChatMessage);
        } catch (error) {
          console.error('Failed to sync message delete to cloud:', error);
        }
      })();
    }
  },
  
  votePoll: (eventId: string, messageId: string, optionId: string) => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) return;
    
    let updatedMessage: ChatMessage | null = null;

    set((state: any) => ({
      events: state.events.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId || m.type !== 'poll' || m.pollClosed) return m;
            const options = (m.pollOptions || []).map(opt => {
              // Remove vote from all options first (single vote)
              const votes = (opt.votes || []).filter((id: string) => id !== currentProfile.id);
              // Add vote to selected option
              if (opt.id === optionId) votes.push(currentProfile.id);
              return { ...opt, votes };
            });
            const next = { ...m, pollOptions: options };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
      completedEvents: state.completedEvents.map((e: Event) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          chat: (e.chat || []).map((m: ChatMessage) => {
            if (m.id !== messageId || m.type !== 'poll' || m.pollClosed) return m;
            const options = (m.pollOptions || []).map(opt => {
              const votes = (opt.votes || []).filter((id: string) => id !== currentProfile.id);
              if (opt.id === optionId) votes.push(currentProfile.id);
              return { ...opt, votes };
            });
            const next = { ...m, pollOptions: options };
            updatedMessage = next;
            return next;
          }),
          lastModified: new Date().toISOString(),
        };
      }),
    }));

    if (updatedMessage && import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
      void (async () => {
        try {
          const { updateChatMessageInCloud } = await import('../../utils/eventSync');
          await updateChatMessageInCloud(eventId, updatedMessage as ChatMessage);
        } catch (error) {
          console.error('Failed to sync poll vote to cloud:', error);
        }
      })();
    }
  },
  
  // completeEvent is complex - keeping in main store.ts for now
  completeEvent: (_eventId: string) => {
    // Will use original implementation in store.ts
    return false;
  },
});
