import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import { nanoid } from 'nanoid/non-secure';
import { getCourseById, getTee, getHole } from '../data/cloudCourses';
import { calculateWHSHandicapIndex, distributeHandicapStrokes, applyESCAdjustment, calculateScoreDifferential } from '../utils/handicap';
import { calculateEventPayouts } from '../games/payouts';
import { IndividualRound, HandicapHistory, CombinedRound, ScoreEntry as HandicapScoreEntry } from '../types/handicap';

// Domain models (simplified initial draft)
export interface HoleDef { number: number; par: number; strokeIndex?: number; }
// Course definitions now live in data/courses

// User account for profile isolation
export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  lastActive: string;
}

// Extended Golfer Profile
export interface GolferProfile {
  id: string;
  userId: string; // Links profile to a specific user
  name: string; // Full display name (for backward compatibility)
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string; // base64 or URL
  handicapIndex?: number;
  preferredTee?: string; // default tee preference
  individualRounds?: IndividualRound[]; // Individual handicap rounds
  handicapHistory?: HandicapHistory[]; // WHS calculation history
  stats: {
    roundsPlayed: number;
    averageScore: number;
    bestScore: number;
    totalBirdies: number;
    totalEagles: number;
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    defaultNetScoring: boolean;
    autoAdvanceScores: boolean;
    showHandicapStrokes: boolean;
  };
  createdAt: string;
  lastActive: string;
}

// Golfer in event context (references profile or custom name)
export interface EventGolfer {
  profileId?: string; // references GolferProfile.id (optional for custom names)
  customName?: string; // custom name for casual players without profiles
  displayName?: string; // ✅ Snapshot of name at join time (for cross-device visibility)
  handicapSnapshot?: number | null; // ✅ Snapshot of handicap at join time
  teeName?: string; // event-specific tee override
  handicapOverride?: number | null; // event-specific handicap override
}

export interface Group { id: string; golferIds: string[]; teeTime?: string; }
export interface NassauTeam { id: string; name: string; golferIds: string[]; }
export interface NassauConfig { id: string; groupId: string; fee: number; net: boolean; pressesOff?: boolean; teams?: NassauTeam[]; teamBestCount?: number; participantGolferIds?: string[]; }
export interface SkinsConfig { id: string; fee: number; net: boolean; participantGolferIds?: string[]; }
export interface PinkyConfig { id: string; fee: number; participantGolferIds?: string[]; }
export interface PinkyResult { golferId: string; count: number; }
export interface GreenieConfig { id: string; fee: number; participantGolferIds?: string[]; }
export interface GreenieResult { golferId: string; count: number; }
export interface ScoreEntry { hole: number; strokes: number | null; }
export interface PlayerScorecard { golferId: string; scores: ScoreEntry[]; }
export interface EventGameConfig { nassau: NassauConfig[]; skins: SkinsConfig[]; pinky: PinkyConfig[]; greenie: GreenieConfig[]; }
export interface EventCourseSelection { courseId?: string; teeName?: string; }

// Event scoped chat message
export interface ChatMessage {
  id: string;            // unique id
  profileId: string;     // sender profile id
  senderName?: string;   // sender display name snapshot (for cross-device)
  text: string;          // message body (plain text for now)
  createdAt: string;     // ISO timestamp
}

// Toast notification interface
export interface Toast {
  id: string;
  message: string;
  type: 'achievement' | 'info' | 'success' | 'error';
  duration?: number;
  createdAt: string;
}

// Event interface
export interface Event {
  id: string;
  name: string;
  date: string;
  course: EventCourseSelection;
  golfers: EventGolfer[];
  groups: Group[];
  scorecards: PlayerScorecard[];
  games: EventGameConfig;
  pinkyResults?: Record<string, PinkyResult[]>; // pinkyConfigId -> results array
  greenieResults?: Record<string, GreenieResult[]>; // greenieConfigId -> results array
  ownerProfileId: string;
  scorecardView: 'individual' | 'team' | 'admin';
  isPublic: boolean;
  createdAt: string;
  lastModified: string;
  chat: ChatMessage[];
  shareCode?: string;
  isCompleted?: boolean; // Mark event as completed (read-only)
  completedAt?: string; // When the event was completed
}

// Completed Round for analytics and history
export interface CompletedRound {
  id: string;
  eventId: string; // Reference to original event
  eventName: string;
  datePlayed: string;
  courseId?: string;
  courseName: string;
  teeName?: string;
  golferId: string; // Profile ID or custom name
  golferName: string;
  handicapIndex?: number;
  finalScore: number;
  scoreToPar: number; // Total strokes relative to par
  holesPlayed: number;
  holeScores: { hole: number; strokes: number; par: number; toPar: number }[];
  gameResults: {
    nassau?: { winnings: number; position: number };
    skins?: { winnings: number; skinsWon: number };
  };
  stats: {
    birdies: number;
    eagles: number;
    pars: number;
    bogeys: number;
    doubleBogeys: number;
    triplesOrWorse: number;
    fairwaysHit?: number; // Future enhancement
    greensInRegulation?: number; // Future enhancement
  };
  createdAt: string;
}

interface State {
  // Current user session
  currentUser: User | null;
  users: User[];
  
  // Current user profile
  currentProfile: GolferProfile | null;
  profiles: GolferProfile[];
  
  events: Event[];
  completedEvents: Event[]; // Completed events moved here
  completedRounds: CompletedRound[]; // Completed rounds for analytics
  toasts: Toast[]; // Toast notifications
  isLoadingEventsFromCloud: boolean; // Prevent duplicate cloud loads
  
  createEvent: (initialData?: Partial<Event>) => string | null;
  completeEvent: (eventId: string) => boolean; // Complete event and record rounds
  setEventCourse: (eventId: string, courseId: string) => Promise<void>;
  setEventTee: (eventId: string, teeName: string) => Promise<void>;
  updateEvent: (id: string, patch: Partial<Event>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  loadEventsFromCloud: () => Promise<void>;
  refreshEventFromCloud: (eventId: string) => Promise<boolean>;
  importData: (data: Event[]) => void;
  exportData: () => string;
  
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
  
  // Event golfer management
  addGolferToEvent: (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => Promise<void>;
  updateEventGolfer: (eventId: string, golferId: string, patch: Partial<EventGolfer>) => Promise<void>;
  removeGolferFromEvent: (eventId: string, golferId: string) => Promise<void>;
  
  addGroup: (eventId: string) => void;
  assignGolferToGroup: (eventId: string, groupId: string, golferId: string) => void;
  updateScore: (eventId: string, golferId: string, hole: number, strokes: number | null) => Promise<void>;
  moveGolferToGroup: (eventId: string, golferId: string, targetGroupId: string | null) => void;
  setGroupTeeTime: (eventId: string, groupId: string, teeTime: string) => void;
  removeGroup: (eventId: string, groupId: string) => void;
  removeNassau: (eventId: string, nassauId: string) => Promise<void>;
  removeSkins: (eventId: string, skinsId: string) => Promise<void>;
  removePinky: (eventId: string, pinkyId: string) => Promise<void>;
  setPinkyResults: (eventId: string, pinkyId: string, results: PinkyResult[]) => Promise<void>;
  removeGreenie: (eventId: string, greenieId: string) => Promise<void>;
  setGreenieResults: (eventId: string, greenieId: string, results: GreenieResult[]) => Promise<void>;
  
  // Event sharing
  generateShareCode: (eventId: string) => Promise<string>;
  joinEventByCode: (shareCode: string) => Promise<{ success: boolean; error?: string; eventId?: string }>;
  // Chat
  addChatMessage: (eventId: string, text: string) => Promise<void>;
  clearChat: (eventId: string) => void;
  // Scorecard permissions
  canEditScore: (eventId: string, golferId: string) => boolean;
  setScorecardView: (eventId: string, view: 'individual' | 'team' | 'admin') => void;
  // Toast notifications
  addToast: (message: string, type?: 'achievement' | 'info' | 'success' | 'error', duration?: number) => void;
  removeToast: (toastId: string) => void;
  
  // Individual Handicap Rounds
  addIndividualRound: (round: Omit<IndividualRound, 'id' | 'createdAt'>) => string;
  getProfileRounds: (profileId: string) => CombinedRound[];
  calculateAndUpdateHandicap: (profileId: string) => void;
  recalculateAllDifferentials: () => void;
  deleteIndividualRound: (roundId: string) => void;
}

const defaultScoreArray = (courseId?: string) => {
  const tee = getTee(courseId, undefined);
  const holes = tee?.holes?.length ? tee.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4 } as any));
  return holes.map((h: any) => ({ hole: h.number, strokes: null }));
};

// Helper function to sync event to cloud after updates
const syncEventToCloud = async (eventId: string, get: () => State) => {
  if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return;
  
  const event = get().events.find(e => e.id === eventId);
  const profile = get().currentProfile;
  
  if (event && profile) {
    try {
      const { saveEventToCloud } = await import('../utils/eventSync');
      await saveEventToCloud(event, profile.id);
      console.log('✅ Event synced to cloud:', eventId);
    } catch (error) {
      console.error('Failed to sync event to cloud:', error);
    }
  }
};

export const useStore = create<State>()(
  persist(
    (set: any, get: () => State) => ({
      currentUser: null,
      users: [],
      currentProfile: null,
      profiles: [],
      events: [],
      completedEvents: [],
      completedRounds: [],
      toasts: [],
      isLoadingEventsFromCloud: false,
      
      createUser: (username: string, displayName?: string, skipProfile?: boolean) => {
        const user: User = {
          id: nanoid(8),
          username,
          displayName: displayName || username,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        
        console.log('createUser: Creating user', user, 'skipProfile:', skipProfile);
        set({ users: [...get().users, user] });
        
        if (!get().currentUser) {
          console.log('createUser: Setting as current user');
          set({ currentUser: user });
          
          // Only create profile automatically if skipProfile is false
          if (!skipProfile) {
            console.log('createUser: Creating profile for new user');
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
                theme: 'auto',
                defaultNetScoring: false,
                autoAdvanceScores: true,
                showHandicapStrokes: true
              },
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString()
            };
            
            console.log('createUser: Adding profile to store');
            set({ 
              profiles: [...get().profiles, profile],
              currentProfile: profile
            });
            console.log('createUser: User and profile creation complete');
          } else {
            console.log('createUser: Skipping automatic profile creation');
          }
        }
      },
      
      switchUser: (userId: string) => {
        if (!userId) {
          // Logout case
          set({ 
            currentUser: null,
            currentProfile: null
          });
          return;
        }
        
        const user = get().users.find(u => u.id === userId);
        if (user) {
          console.log('switchUser: Found user', user);
          
          // Find existing profile for this user
          const userProfile = get().profiles.find(p => p.userId === userId);
          console.log('switchUser: Found profile', userProfile?.id);
          
          set({ 
            currentUser: user,
            currentProfile: userProfile || null
          });
          
          console.log('switchUser: Switch complete', { user: user.id, profile: userProfile?.id });
        }
      },
      
      logout: () => {
        set({ 
          currentUser: null,
          currentProfile: null
        });
      },
      
      deleteUser: (userId: string) => {
        set({
          users: get().users.filter(u => u.id !== userId),
          profiles: get().profiles.filter(p => p.userId !== userId),
          events: get().events.filter(e => e.ownerProfileId && 
            !get().profiles.some(p => p.id === e.ownerProfileId && p.userId === userId))
        });
        if (get().currentUser?.id === userId) {
          const remainingUsers = get().users.filter(u => u.id !== userId);
          set({ 
            currentUser: remainingUsers.length > 0 ? remainingUsers[0] : null,
            currentProfile: null
          });
        }
      },
      
      createProfile: (name: string, email?: string, options?: { firstName?: string; lastName?: string }) => {
        const currentUser = get().currentUser;
        if (!currentUser) {
          console.log('createProfile: No current user');
          return;
        }
        
        console.log('createProfile: Creating profile for user', currentUser.id, 'with name', name);
        
        // Check if user already has a profile with this name
        const existingProfile = get().profiles.find(p => 
          p.userId === currentUser.id && p.name.toLowerCase() === name.toLowerCase()
        );
        if (existingProfile) {
          console.log('createProfile: Found existing profile, setting as current');
          // If profile exists but isn't current, set it as current
          if (get().currentProfile?.id !== existingProfile.id) {
            set({ currentProfile: existingProfile });
            console.log('createProfile: Set existing profile as current:', existingProfile.id);
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
            theme: 'auto',
            defaultNetScoring: false,
            autoAdvanceScores: true,
            showHandicapStrokes: true
          },
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        console.log('createProfile: Created new profile', profile.id);
        set({ profiles: [...get().profiles, profile] });
        if (!get().currentProfile) {
          console.log('createProfile: Setting as current profile');
          set({ currentProfile: profile });
          console.log('createProfile: Current profile set to:', profile.id);
          console.log('createProfile: Verifying currentProfile after set:', get().currentProfile?.id);
        } else {
          console.log('createProfile: Current profile already exists:', get().currentProfile?.id);
        }
      },
      
      updateProfile: (profileId: string, patch: Partial<GolferProfile>) => {
        set({
          profiles: get().profiles.map(p => 
            p.id === profileId ? { ...p, ...patch, lastActive: new Date().toISOString() } : p
          ),
          currentProfile: get().currentProfile?.id === profileId 
            ? { ...get().currentProfile, ...patch, lastActive: new Date().toISOString() }
            : get().currentProfile
        });
      },
      
      setCurrentProfile: (profileId: string) => {
        console.log('setCurrentProfile called with:', profileId);
        const profile = get().profiles.find(p => p.id === profileId);
        console.log('Found profile:', profile);
        if (profile && profile.userId === get().currentUser?.id) {
          console.log('Setting current profile to:', profile);
          set({ currentProfile: profile });
          console.log('Current profile set successfully');
        } else {
          console.log('Profile not found or user mismatch');
        }
      },
      
      deleteProfile: (profileId: string) => {
        set({
          profiles: get().profiles.filter(p => p.id !== profileId),
          events: get().events.filter(e => e.ownerProfileId !== profileId)
        });
        if (get().currentProfile?.id === profileId) {
          const userProfiles = get().profiles.filter(p => p.userId === get().currentUser?.id && p.id !== profileId);
          set({ currentProfile: userProfiles.length > 0 ? userProfiles[0] : null });
        }
        
        // Delete from cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          import('../utils/profileSync').then(({ deleteProfileFromCloud }) => {
            deleteProfileFromCloud(profileId).then(() => {
              console.log('✅ deleteProfile: Profile deleted from cloud:', profileId);
            }).catch((err: unknown) => {
              console.error('❌ deleteProfile: Failed to delete profile from cloud:', err);
            });
          });
        }
      },
      
      exportProfile: (profileId: string) => {
        const profile = get().profiles.find(p => p.id === profileId);
        return profile ? JSON.stringify(profile, null, 2) : '';
      },
      
      importProfile: (profileData: string) => {
        try {
          const profile: GolferProfile = JSON.parse(profileData);
          const currentUser = get().currentUser;
          if (!currentUser || profile.userId !== currentUser.id) return false;
          
          // Check if profile already exists
          const existingIndex = get().profiles.findIndex(p => p.id === profile.id);
          if (existingIndex >= 0) {
            // Update existing profile
            set({
              profiles: get().profiles.map((p, i) => 
                i === existingIndex ? profile : p
              )
            });
          } else {
            // Add new profile
            set({ profiles: [...get().profiles, profile] });
          }
          return true;
        } catch {
          return false;
        }
      },
      
      cleanupDuplicateProfiles: () => {
        const allProfiles = get().profiles;
        const uniqueProfiles = allProfiles.filter((profile, index, self) => 
          index === self.findIndex(p => p.name === profile.name && p.userId === profile.userId)
        );
        set({ profiles: uniqueProfiles });
      },
      
      createEvent: (initialData?: Partial<Event>) => {
        const currentProfile = get().currentProfile;
        if (!currentProfile) return null;
        
        const id = nanoid(8);
        const eventGolfer: EventGolfer = { 
          profileId: currentProfile.id,
          displayName: currentProfile.name, // ✅ Save name snapshot at creation
          handicapSnapshot: currentProfile.handicapIndex ?? null, // ✅ Save handicap snapshot
          teeName: undefined,
          handicapOverride: null 
        };
        console.log('👤 createEvent: Creating EventGolfer with snapshot:', eventGolfer);
        const scorecard: PlayerScorecard = { 
          golferId: currentProfile.id, 
          scores: defaultScoreArray(initialData?.course?.courseId) 
        };
        const group = { id: nanoid(5), golferIds: [currentProfile.id] };
        
        const newEvent: Event = {
          id,
          name: initialData?.name || '',
          date: initialData?.date || new Date().toISOString().slice(0, 10),
          course: initialData?.course || {},
          golfers: [eventGolfer],
          groups: [group],
          scorecards: [scorecard],
          games: { nassau: [], skins: [], pinky: [], greenie: [] },
          ownerProfileId: currentProfile.id,
          scorecardView: 'individual', // Default to individual view for owner
          isPublic: false,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          chat: [],
          ...initialData // Spread any other initial data
        };
        set({ events: [...get().events, newEvent] });
        console.log('Event created with current user as golfer:', newEvent);
        return id;
      },
      
      setEventCourse: async (eventId: string, courseId: string) => {
        set({
          events: get().events.map(e => {
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
        });
        await syncEventToCloud(eventId, get);
      },
      
      setEventTee: async (eventId: string, teeName: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const prevEventTee = e.course.teeName;
            return {
              ...e,
              course: { ...e.course, teeName },
              golfers: e.golfers.map(g => {
                // If golfer had no explicit tee or was inheriting previous event tee, adopt new tee.
                if (!g.teeName || g.teeName === prevEventTee) {
                  return { ...g, teeName };
                }
                return g;
              }),
              lastModified: new Date().toISOString()
            };
          })
        });
        await syncEventToCloud(eventId, get);
      },
      
      updateEvent: async (id: string, patch: Partial<Event>) => {
        console.log('📝 updateEvent: Updating event:', id, 'Patch:', Object.keys(patch));
        
        set({
          events: get().events.map((e: Event) => {
            if (e.id !== id) return e;
            
            // Ensure games object has all required arrays before merging
            const currentGames = e.games || { nassau: [], skins: [], pinky: [], greenie: [] };
            const updatedGames = patch.games ? {
              nassau: patch.games.nassau ?? currentGames.nassau ?? [],
              skins: patch.games.skins ?? currentGames.skins ?? [],
              pinky: patch.games.pinky ?? currentGames.pinky ?? [],
              greenie: patch.games.greenie ?? currentGames.greenie ?? []
            } : currentGames;
            
            return {
              ...e,
              ...patch,
              games: updatedGames,
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud immediately
        console.log('☁️ updateEvent: Syncing to cloud...');
        await syncEventToCloud(id, get);
        console.log('✅ updateEvent: Synced to cloud');
      },
      
      deleteEvent: async (eventId: string) => {
        // Delete from local state
        set({
          events: get().events.filter(e => e.id !== eventId),
          completedEvents: get().completedEvents.filter(e => e.id !== eventId)
        });
        
        // Delete from cloud if cloud sync enabled
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          try {
            const { deleteEventFromCloud } = await import('../utils/eventSync');
            const success = await deleteEventFromCloud(eventId);
            if (success) {
              console.log('✅ Event deleted from cloud:', eventId);
            } else {
              console.warn('⚠️ Failed to delete event from cloud:', eventId);
            }
          } catch (error) {
            console.error('❌ Error deleting event from cloud:', error);
          }
        }
      },
      
      loadEventsFromCloud: async () => {
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') {
          console.log('⚠️ loadEventsFromCloud: Cloud sync disabled');
          return;
        }
        
        // Prevent duplicate simultaneous calls
        if (get().isLoadingEventsFromCloud) {
          console.log('⚠️ loadEventsFromCloud: Already loading, skipping duplicate call');
          return;
        }
        
        const currentProfile = get().currentProfile;
        if (!currentProfile) {
          console.warn('⚠️ loadEventsFromCloud: No current profile');
          return;
        }
        
        try {
          set({ isLoadingEventsFromCloud: true });
          console.log('📥 loadEventsFromCloud: Loading events for profile:', currentProfile.id);
          const { loadUserEventsFromCloud, loadChatMessagesFromCloud } = await import('../utils/eventSync');
          
          // Load all events from cloud
          const cloudEvents = await loadUserEventsFromCloud();
          console.log('📥 loadEventsFromCloud: Loaded', cloudEvents.length, 'events from cloud');
          
          // Filter to only events where current profile is a golfer
          const myEvents = cloudEvents.filter(event => 
            event.golfers.some(g => g.profileId === currentProfile.id)
          );
          console.log('📥 loadEventsFromCloud: Filtered to', myEvents.length, 'events where user is a golfer');
          
          // Load chat messages for each event
          for (const event of myEvents) {
            const chatMessages = await loadChatMessagesFromCloud(event.id);
            event.chat = chatMessages;
          }
          
          // Separate active and completed events
          const activeEvents = myEvents.filter(e => !e.isCompleted);
          const completedEvents = myEvents.filter(e => e.isCompleted);
          console.log('📥 loadEventsFromCloud: Active:', activeEvents.length, 'Completed:', completedEvents.length);
          
          // Log current state for debugging
          console.log('🔍 Current completedRounds count:', get().completedRounds.length);
          console.log('🔍 Current individualRounds count:', currentProfile.individualRounds?.length || 0);
          
          // Process completed events to create CompletedRounds and IndividualRounds for current user
          const newCompletedRoundsFromCloud: CompletedRound[] = [];
          const newIndividualRoundsFromCloud: IndividualRound[] = [];
          
          completedEvents.forEach(event => {
            const eventGolfer = event.golfers.find(g => g.profileId === currentProfile.id);
            if (!eventGolfer) {
              console.log('⏭️ Skipping event (user not a golfer):', event.name);
              return;
            }
            
            const scorecard = event.scorecards.find(sc => sc.golferId === currentProfile.id);
            if (!scorecard) {
              console.log('⏭️ Skipping event (no scorecard):', event.name);
              return;
            }
            
            console.log('🔍 Processing event:', event.name, 'for user:', currentProfile.name);
            
            // Check if we already have a CompletedRound for this event
            const existingCompletedRound = get().completedRounds.find(
              r => r.eventId === event.id && r.golferId === currentProfile.id
            );
            
            // Determine which tee name to use (for deduplication)
            const effectiveTeeName = eventGolfer.teeName || event.course.teeName || currentProfile.preferredTee;
            
            // Check if we already have an IndividualRound for this event
            const existingIndividualRound = currentProfile.individualRounds?.find(
              r => r.date === event.date && r.courseId === event.course.courseId && r.teeName === effectiveTeeName
            );
            
            console.log('🔍 effectiveTeeName:', effectiveTeeName, 'existingCompletedRound:', !!existingCompletedRound, 'existingIndividualRound:', !!existingIndividualRound);
            
            // Calculate common data needed for both types of rounds
            let totalScore = 0;
            let totalPar = 0;
            let holesPlayed = 0;
            const holeScores: any[] = [];
            const stats = { birdies: 0, eagles: 0, pars: 0, bogeys: 0, doubleBogeys: 0, triplesOrWorse: 0 };
            
            scorecard.scores.forEach((score: any) => {
              if (score.strokes != null) {
                let holePar = 4;
                const holeData = getHole(event.course.courseId, score.hole, event.course.teeName);
                if (holeData) holePar = holeData.par;
                
                totalScore += score.strokes;
                totalPar += holePar;
                holesPlayed++;
                
                const toPar = score.strokes - holePar;
                holeScores.push({ hole: score.hole, strokes: score.strokes, par: holePar, toPar });
                
                if (toPar <= -2) stats.eagles++;
                else if (toPar === -1) stats.birdies++;
                else if (toPar === 0) stats.pars++;
                else if (toPar === 1) stats.bogeys++;
                else if (toPar === 2) stats.doubleBogeys++;
                else if (toPar >= 3) stats.triplesOrWorse++;
              }
            });
            
            // Create CompletedRound if it doesn't exist
            let completedRoundForLinking: CompletedRound | undefined;
            if (!existingCompletedRound) {
              const completedRound: CompletedRound = {
                id: nanoid(8),
                eventId: event.id,
                eventName: event.name,
                datePlayed: event.date,
                courseId: event.course.courseId,
                courseName: event.course.courseId ? (getCourseById(event.course.courseId)?.name || 'Unknown Course') : 'Custom Course',
                teeName: eventGolfer.teeName,
                golferId: currentProfile.id,
                golferName: currentProfile.name,
                handicapIndex: eventGolfer.handicapOverride ?? currentProfile.handicapIndex,
                finalScore: totalScore,
                scoreToPar: totalScore - totalPar,
                holesPlayed,
                holeScores,
                gameResults: {}, // Could calculate from event.games if needed
                stats,
                createdAt: new Date().toISOString()
              };
              
              completedRoundForLinking = completedRound;
              newCompletedRoundsFromCloud.push(completedRound);
              console.log('✅ Created CompletedRound for completed event:', event.name, 'Score:', totalScore);
            } else {
              completedRoundForLinking = existingCompletedRound;
            }
            
            // Create IndividualRound if it doesn't exist and we have valid course data
            if (!existingIndividualRound && event.course.courseId && holesPlayed >= 14) {
              console.log('🔍 Creating IndividualRound for event:', event.name, 'courseId:', event.course.courseId, 'holesPlayed:', holesPlayed);
              
              const course = getCourseById(event.course.courseId);
              const courseTees = course?.tees ? { tees: course.tees } as any : undefined;
              
              // Try to find the tee - priority: eventGolfer.teeName > event.course.teeName > profile.preferredTee > middle tee
              let tee = courseTees?.tees.find((t: any) => t.name === eventGolfer.teeName);
              
              if (!tee && courseTees) {
                // Try event's default tee
                tee = courseTees.tees.find((t: any) => t.name === event.course.teeName);
                
                if (!tee) {
                  // Try user's preferred tee
                  tee = courseTees.tees.find((t: any) => t.name === currentProfile.preferredTee);
                  
                  // If still not found, use the middle tee (usually white/blue)
                  if (!tee && courseTees.tees.length > 0) {
                    const middleIndex = Math.floor(courseTees.tees.length / 2);
                    tee = courseTees.tees[middleIndex];
                    console.log('🔍 Using middle tee as fallback:', tee.name);
                  }
                }
              }
              
              console.log('🔍 Course tees found:', !!courseTees, 'Tee found:', !!tee, 'eventGolfer.teeName:', eventGolfer.teeName, 'event.course.teeName:', event.course.teeName, 'Selected tee:', tee?.name);
              
              if (courseTees && tee) {
                        // Calculate course handicap and score differential
                        const currentHandicap = eventGolfer.handicapOverride ?? currentProfile.handicapIndex ?? 0;
                        const courseHandicap = Math.round(currentHandicap * (tee.slopeRating / 113) + (tee.courseRating - tee.par));
                        
                        // Build scores array for differential calculation with proper handicap strokes
                        const strokeDist = distributeHandicapStrokes(courseHandicap, event.course.courseId, tee?.name);
                        const roundScores: any[] = scorecard.scores.map((score: any) => {
                          const courseHole = getHole(event.course.courseId!, score.hole, tee?.name);
                          const par = courseHole?.par || 4;
                          const handicapStrokes = strokeDist[score.hole] || 0;
                          const strokes = score.strokes || 0;
                          
                          return {
                            hole: score.hole,
                            par,
                            strokes,
                            handicapStrokes,
                            netStrokes: strokes - handicapStrokes
                          };
                        });
                        
                        // Apply ESC and calculate differential
                        let adjustedGross = 0;
                        roundScores.forEach((s: any) => {
                          const raw = s.strokes || 0;
                          const par = s.par;
                          const strokesReceived = s.handicapStrokes;
                          const maxScore = applyESCAdjustment(raw, par, strokesReceived);
                          adjustedGross += maxScore;
                        });
                        
                        const cr0 = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
                        const sl0 = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
                        const scoreDifferential = calculateScoreDifferential(adjustedGross, cr0, sl0);
                        
                        const individualRound: IndividualRound = {
                          id: nanoid(8),
                          profileId: currentProfile.id,
                          date: event.date,
                          courseId: event.course.courseId,
                          teeName: tee.name, // Use the actual tee we selected
                          grossScore: totalScore,
                          netScore: totalScore - courseHandicap,
                          courseHandicap,
                          scoreDifferential,
                          courseRating: tee.courseRating,
                          slopeRating: tee.slopeRating,
                          scores: roundScores,
                          eventId: event.id, // Link to source event
                          completedRoundId: completedRoundForLinking?.id, // Link to CompletedRound
                          createdAt: new Date().toISOString()
                        };
                        
                        newIndividualRoundsFromCloud.push(individualRound);
                        console.log('✅ Created IndividualRound for completed event:', event.name, 'Differential:', scoreDifferential.toFixed(1), 'CompletedRoundId:', completedRoundForLinking?.id);
                      } else {
                        console.warn('❌ Could not create IndividualRound: Missing courseTees or tee data');
                      }
            } else if (event.course.courseId) {
              console.log('⏭️ Skipping IndividualRound creation:', 
                'holesPlayed:', holesPlayed, 
                'needs14+:', holesPlayed >= 14);
            }
          });
          
          // Merge with existing local events (don't overwrite local changes)
          const localEventIds = new Set(get().events.map(e => e.id));
          const localCompletedEventIds = new Set(get().completedEvents.map(e => e.id));
          
          const newActiveEvents = activeEvents.filter(e => !localEventIds.has(e.id));
          const newCompletedEvents = completedEvents.filter(e => !localCompletedEventIds.has(e.id));
          
          // Also remove any events from events[] that are actually completed (cleanup)
          const completedEventIds = new Set(completedEvents.map(e => e.id));
          const cleanedActiveEvents = get().events.filter(e => !completedEventIds.has(e.id));
          
          if (newActiveEvents.length > 0 || newCompletedEvents.length > 0 || cleanedActiveEvents.length !== get().events.length || newCompletedRoundsFromCloud.length > 0 || newIndividualRoundsFromCloud.length > 0) {
            console.log('✅ loadEventsFromCloud: Adding', newActiveEvents.length, 'active and', newCompletedEvents.length, 'completed events');
            console.log('✅ loadEventsFromCloud: Adding', newCompletedRoundsFromCloud.length, 'completed rounds from cloud events');
            console.log('✅ loadEventsFromCloud: Adding', newIndividualRoundsFromCloud.length, 'individual rounds from cloud events');
            console.log('✅ loadEventsFromCloud: Cleaning', get().events.length - cleanedActiveEvents.length, 'completed events from active array');
            
            // Update profiles with new IndividualRounds (deduplicate before adding)
            set({
              events: [...cleanedActiveEvents, ...newActiveEvents],
              completedEvents: [...get().completedEvents, ...newCompletedEvents],
              completedRounds: [...get().completedRounds, ...newCompletedRoundsFromCloud],
              profiles: get().profiles.map(p => {
                if (p.id === currentProfile.id) {
                  const existingRounds = p.individualRounds || [];
                  
                  // Deduplicate: only add rounds that don't already exist
                  // Check by ID first (exact match), then by date/course/tee (duplicate prevention)
                  const roundsToAdd = newIndividualRoundsFromCloud.filter(newRound => {
                    return !existingRounds.some(existing => 
                      existing.id === newRound.id || // Exact ID match
                      (existing.date === newRound.date && 
                       existing.courseId === newRound.courseId && 
                       existing.teeName === newRound.teeName &&
                       existing.grossScore === newRound.grossScore) // Same score too
                    );
                  });
                  
                  console.log(`🔍 Deduplication: ${newIndividualRoundsFromCloud.length} new rounds, ${roundsToAdd.length} unique to add, ${existingRounds.length} existing`);
                  
                  return {
                    ...p,
                    individualRounds: [...existingRounds, ...roundsToAdd]
                  };
                }
                return p;
              })
            });
            
            // Save new IndividualRounds to cloud
            if (newIndividualRoundsFromCloud.length > 0) {
              const roundsToAdd = newIndividualRoundsFromCloud.filter(newRound => {
                const existingRounds = currentProfile.individualRounds || [];
                return !existingRounds.some(existing => 
                  existing.id === newRound.id || // Exact ID match
                  (existing.date === newRound.date && 
                   existing.courseId === newRound.courseId && 
                   existing.teeName === newRound.teeName &&
                   existing.grossScore === newRound.grossScore) // Same score too
                );
              });
              
              if (roundsToAdd.length > 0) {
                console.log(`☁️ Saving ${roundsToAdd.length} new IndividualRounds to cloud...`);
                import('../utils/roundSync').then(({ batchSaveIndividualRoundsToCloud }) => {
                  batchSaveIndividualRoundsToCloud(roundsToAdd).then((savedCount) => {
                    console.log(`✅ Saved ${savedCount}/${roundsToAdd.length} IndividualRounds to cloud`);
                  }).catch((err: unknown) => {
                    console.error('❌ Failed to save IndividualRounds to cloud:', err);
                  });
                });
              }
            }
            
            // Recalculate handicap if we added new rounds
            if (newIndividualRoundsFromCloud.length > 0) {
              setTimeout(() => {
                get().calculateAndUpdateHandicap(currentProfile.id);
              }, 0);
            }
          } else {
            console.log('✅ loadEventsFromCloud: No new events to add');
          }
          
          // Load CompletedRounds from cloud (for analytics)
          try {
            const { loadCompletedRoundsFromCloud } = await import('../utils/completedRoundSync');
            const cloudCompletedRounds = await loadCompletedRoundsFromCloud(currentProfile.id);
            
            if (cloudCompletedRounds.length > 0) {
              // Deduplicate: only add rounds that don't already exist
              const existingCompletedRounds = get().completedRounds;
              const roundsToAdd = cloudCompletedRounds.filter(newRound => {
                return !existingCompletedRounds.some(existing => 
                  existing.eventId === newRound.eventId && 
                  existing.golferId === newRound.golferId
                );
              });
              
              if (roundsToAdd.length > 0) {
                console.log(`✅ loadEventsFromCloud: Adding ${roundsToAdd.length} CompletedRounds from cloud`);
                set({
                  completedRounds: [...existingCompletedRounds, ...roundsToAdd]
                });
              } else {
                console.log('✅ loadEventsFromCloud: All CompletedRounds already exist locally');
              }
            }
          } catch (error) {
            console.error('❌ loadEventsFromCloud: Failed to load CompletedRounds from cloud:', error);
          }
        } catch (error) {
          console.error('❌ loadEventsFromCloud: Error:', error);
        } finally {
          set({ isLoadingEventsFromCloud: false });
        }
      },
      
      refreshEventFromCloud: async (eventId: string) => {
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return false;
        
        console.log('🔄 refreshEventFromCloud: Starting refresh for:', eventId);
        const beforeRefresh = get().events.find(e => e.id === eventId);
        console.log('🔄 refreshEventFromCloud: Local event before refresh has', beforeRefresh?.golfers.length, 'golfers');
        
        // Track chat messages before refresh
        const chatCountBefore = beforeRefresh?.chat.length || 0;
        
        try {
          const { loadEventById } = await import('../utils/eventSync');
          const updatedEvent = await loadEventById(eventId);
          
          if (updatedEvent) {
            console.log('🔄 refreshEventFromCloud: Cloud event has', updatedEvent.golfers.length, 'golfers');
            
            // Check for new chat messages
            const chatCountAfter = updatedEvent.chat.length;
            const newMessagesCount = chatCountAfter - chatCountBefore;
            
            // Merge with local events
            set({
              events: get().events.map(e => e.id === eventId ? updatedEvent : e)
            });
            console.log('✅ refreshEventFromCloud: Event refreshed from cloud with', updatedEvent.golfers.length, 'golfers');
            
            // Show notification for new chat messages (especially bot alerts)
            if (newMessagesCount > 0) {
              const lastMessage = updatedEvent.chat[updatedEvent.chat.length - 1];
              if (lastMessage?.profileId === 'gimmies-bot') {
                // Show achievement alert
                get().addToast(lastMessage.text, 'achievement', 5000);
              } else if (newMessagesCount === 1) {
                // Show notification for single new message
                const senderName = lastMessage?.senderName || 'Someone';
                get().addToast(`💬 ${senderName}: ${lastMessage?.text.substring(0, 50)}${lastMessage?.text.length > 50 ? '...' : ''}`, 'info', 4000);
              } else {
                // Multiple new messages
                get().addToast(`💬 ${newMessagesCount} new messages`, 'info', 3000);
              }
            }
            
            return true;
          }
          return false;
        } catch (error) {
          console.error('❌ refreshEventFromCloud: Failed to refresh event from cloud:', error);
          return false;
        }
      },
      
      addGolferToEvent: async (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => {
        console.log('➕ addGolferToEvent called:', { eventId, golferId, teeName, handicapOverride });
        
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            
            console.log('📝 Found event to modify:', e.id, 'Current golfers:', e.golfers.length);
            
            // Check if golferId is a profile ID or custom name
            const isProfileId = get().profiles.some(p => p.id === golferId);
            const profile = isProfileId ? get().profiles.find(p => p.id === golferId) : null;
            
            const eventGolfer: EventGolfer = isProfileId 
              ? { 
                  profileId: golferId,
                  displayName: profile?.name || 'Unknown', // ✅ Save name snapshot
                  handicapSnapshot: profile?.handicapIndex ?? null, // ✅ Save handicap snapshot
                  teeName: teeName || undefined, 
                  handicapOverride: handicapOverride ?? null 
                }
              : { 
                  customName: golferId,
                  displayName: golferId, // ✅ Custom name is the display name
                  handicapSnapshot: null,
                  teeName: teeName || undefined, 
                  handicapOverride: handicapOverride ?? null 
                };
            
            console.log('👤 Creating EventGolfer:', eventGolfer);
            
            const tee = getTee(e.course.courseId, e.course.teeName);
            const holes = tee?.holes?.length ? tee.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1 }));
            const scorecard: PlayerScorecard = { 
              golferId, 
              scores: holes.map(h => ({ hole: h.number, strokes: null })) 
            };
            let groups = e.groups;
            if (groups.length === 0) {
              groups = [{ id: nanoid(5), golferIds: [golferId] }];
            } else {
              groups = groups.map(g => ({ ...g, golferIds: Array.from(new Set([...g.golferIds, golferId])) }));
            }
            
            const updatedEvent = { 
              ...e, 
              golfers: [...e.golfers, eventGolfer], 
              scorecards: [...e.scorecards, scorecard], 
              groups,
              lastModified: new Date().toISOString()
            };
            
            console.log('✅ Event updated with new golfer. New golfers count:', updatedEvent.golfers.length);
            return updatedEvent;
          })
        });
        
        // Sync to cloud after adding golfer
        console.log('☁️ Syncing event to cloud...');
        await syncEventToCloud(eventId, get);
        console.log('✅ addGolferToEvent complete');
      },
      
      updateEventGolfer: async (eventId: string, golferId: string, patch: Partial<EventGolfer>) => {
        set({
          events: get().events.map(e => 
            e.id === eventId 
              ? { 
                  ...e, 
                  golfers: e.golfers.map(g => 
                    (g.profileId === golferId || g.customName === golferId) ? { ...g, ...patch } : g
                  ),
                  lastModified: new Date().toISOString()
                } 
              : e
          )
        });
        await syncEventToCloud(eventId, get);
      },
      
      removeGolferFromEvent: async (eventId: string, golferId: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            return {
              ...e,
              golfers: e.golfers.filter(g => g.profileId !== golferId && g.customName !== golferId),
              scorecards: e.scorecards.filter(sc => sc.golferId !== golferId),
              groups: e.groups.map(g => ({ ...g, golferIds: g.golferIds.filter(id => id !== golferId) })),
              lastModified: new Date().toISOString()
            };
          })
        });
        await syncEventToCloud(eventId, get);
      },
      
      addGroup: (eventId: string) => {
        // Simplified: ensure only one group exists; ignore additional group creations
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            if (e.groups.length === 0) {
              return { 
                ...e, 
                groups: [{ id: nanoid(5), golferIds: e.golfers.map(g => g.profileId || g.customName || '') }],
                lastModified: new Date().toISOString()
              };
            }
            return e; // already have a group
          })
        });
      },
      
      assignGolferToGroup: (eventId: string, groupId: string, golferId: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            return { 
              ...e, 
              groups: e.groups.map(g => 
                g.id === groupId 
                  ? { ...g, golferIds: g.golferIds.includes(golferId) ? g.golferIds : [...g.golferIds, golferId] } 
                  : g
              ),
              lastModified: new Date().toISOString()
            };
          })
        });
      },
      
      updateScore: async (eventId: string, golferId: string, hole: number, strokes: number | null) => {
        const state = get();
        const event = state.events.find(e => e.id === eventId);
        if (!event) return;

        // Get player name for chat messages
        const eventGolfer = event.golfers.find(g => g.profileId === golferId || g.customName === golferId);
        const profile = eventGolfer?.profileId ? state.profiles.find(p => p.id === eventGolfer.profileId) : null;
        const playerName = profile ? profile.name : eventGolfer?.customName || 'Unknown Player';

        // Get course info for par calculations
        let holePar = 4; // default
        const holeData = getHole(event.course.courseId, hole, event.course.teeName);
        if (holeData) holePar = holeData.par;

        // Check for achievements if strokes is not null
        let chatMessage = '';
        if (strokes !== null) {
          const toPar = strokes - holePar;
          
          // Check for specific achievements
          if (strokes === 1 && holePar > 1) {
            chatMessage = `🎉 HOLE IN ONE! ${playerName} just aced hole ${hole}! 💎`;
          } else if (toPar <= -2) {
            chatMessage = `🦅 EAGLE ALERT! ${playerName} just made an eagle on hole ${hole}! Amazing shot!`;
          } else if (strokes === 8) {
            chatMessage = `⛄ ${playerName} built a snowman on hole ${hole}! Everyone's been there! 🏌️`;
          }

          // Check for birdie streaks after updating the score
          const updatedScorecard = event.scorecards.find(sc => sc.golferId === golferId);
          if (updatedScorecard && toPar === -1) {
            // Count consecutive birdies including this one
            const allScores = [...updatedScorecard.scores].map(s => 
              s.hole === hole ? { ...s, strokes } : s
            ).filter(s => s.strokes != null)
              .sort((a, b) => a.hole - b.hole);

            let consecutiveBirdies = 0;
            for (let i = allScores.length - 1; i >= 0; i--) {
              const score = allScores[i];
              let scorePar = 4;
              const scoreHoleData = getHole(event.course.courseId, score.hole, event.course.teeName);
              if (scoreHoleData) scorePar = scoreHoleData.par;
              
              if (score.strokes === scorePar - 1) {
                consecutiveBirdies++;
              } else {
                break;
              }
            }

            if (consecutiveBirdies >= 3) {
              chatMessage = `🔥 ${playerName} is ON FIRE! ${consecutiveBirdies} birdies in a row! Check it out! 🔥`;
            } else if (consecutiveBirdies === 2) {
              chatMessage = `🐦 ${playerName} is flying high with back-to-back birdies! 🐦`;
            }
          }
        }

        // Update the scorecard
        const updatedEvents = state.events.map(e => {
          if (e.id !== eventId) return e;
          return {
            ...e,
            scorecards: e.scorecards.map(sc => 
              sc.golferId === golferId 
                ? { ...sc, scores: sc.scores.map(s => s.hole === hole ? { ...s, strokes } : s) } 
                : sc
            ),
            lastModified: new Date().toISOString()
          };
        });

        set({ events: updatedEvents });

        // Add chat message if there's an achievement
        if (chatMessage.trim()) {
          const msg: ChatMessage = {
            id: nanoid(10),
            profileId: 'gimmies-bot', // Special ID for bot messages
            senderName: '🤖 Gimmies Bot', // Bot display name
            text: chatMessage.trim(),
            createdAt: new Date().toISOString()
          };

          // Add to local state immediately
          set({
            events: get().events.map(e => {
              if (e.id !== eventId) return e;
              const existing = e.chat || [];
              const next = [...existing, msg].slice(-500);
              return { ...e, chat: next, lastModified: new Date().toISOString() };
            })
          });

          // Save to cloud so it persists
          if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
            import('../utils/eventSync').then(({ saveChatMessageToCloud }) => {
              saveChatMessageToCloud(eventId, msg).catch((err: unknown) => {
                console.error('❌ Failed to save achievement message to cloud:', err);
              });
            });
          }

          // Also show toast notification for the achievement
          get().addToast(chatMessage.trim(), 'achievement', 5000);
        }
        
        // Sync to cloud after score update
        await syncEventToCloud(eventId, get);
      },
      
      moveGolferToGroup: (eventId: string, profileId: string, targetGroupId: string | null) => {
        // Not needed in simplified model; keep for compatibility no-op
      },
      
      setGroupTeeTime: (eventId: string, groupId: string, teeTime: string) => {
        set({
          events: get().events.map(e => 
            e.id === eventId 
              ? { 
                  ...e, 
                  groups: e.groups.map(g => g.id === groupId ? { ...g, teeTime } : g),
                  lastModified: new Date().toISOString()
                } 
              : e
          )
        });
      },
      
      removeGroup: (eventId: string, groupId: string) => {
        // Prevent removing the single auto group
      },
      
      removeNassau: async (eventId: string, nassauId: string) => {
        set({
          events: get().events.map(e => 
            e.id === eventId 
              ? { 
                  ...e, 
                  games: { ...e.games, nassau: e.games.nassau.filter(n => n.id !== nassauId) },
                  lastModified: new Date().toISOString()
                } 
              : e
          )
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      removeSkins: async (eventId: string, skinsId: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const skinsArr = Array.isArray(e.games.skins) ? e.games.skins : (e.games.skins ? [e.games.skins as any] : []);
            return { 
              ...e, 
              games: { ...e.games, skins: skinsArr.filter(s => s.id !== skinsId) },
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      removePinky: async (eventId: string, pinkyId: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const pinkyArr = Array.isArray(e.games.pinky) ? e.games.pinky : [];
            return { 
              ...e, 
              games: { ...e.games, pinky: pinkyArr.filter(p => p.id !== pinkyId) },
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      setPinkyResults: async (eventId: string, pinkyId: string, results: PinkyResult[]) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const pinkyResults = e.pinkyResults || {};
            return {
              ...e,
              pinkyResults: { ...pinkyResults, [pinkyId]: results },
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      removeGreenie: async (eventId: string, greenieId: string) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const greenieArr = Array.isArray(e.games.greenie) ? e.games.greenie : [];
            return { 
              ...e, 
              games: { ...e.games, greenie: greenieArr.filter(g => g.id !== greenieId) },
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      setGreenieResults: async (eventId: string, greenieId: string, results: GreenieResult[]) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const greenieResults = e.greenieResults || {};
            return {
              ...e,
              greenieResults: { ...greenieResults, [greenieId]: results },
              lastModified: new Date().toISOString()
            };
          })
        });
        
        // Sync to cloud
        await syncEventToCloud(eventId, get);
      },
      
      generateShareCode: async (eventId: string) => {
        const event = get().events.find(e => e.id === eventId);
        if (!event) return '';

        const currentProfile = get().currentProfile;
        if (!currentProfile) return '';

        // If cloud sync is enabled, save to cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          try {
            const { saveEventToCloud } = await import('../utils/eventSync');
            const shareCode = await saveEventToCloud(event, currentProfile.id);
            
            if (shareCode) {
              // Update local state with the share code
              set({
                events: get().events.map(e => 
                  e.id === eventId ? { ...e, shareCode, isPublic: true, lastModified: new Date().toISOString() } : e
                )
              });
              return shareCode;
            }
          } catch (error) {
            console.error('Failed to generate share code in cloud:', error);
          }
        }

        // Fallback to local-only mode
        const shareCode = nanoid(6).toUpperCase();
        set({
          events: get().events.map(e => 
            e.id === eventId ? { ...e, shareCode, isPublic: true, lastModified: new Date().toISOString() } : e
          )
        });
        return shareCode;
      },
      
      joinEventByCode: async (shareCode: string) => {
        const currentProfile = get().currentProfile;
        if (!currentProfile) {
          return { success: false, error: 'Please create a profile first to join events.' };
        }

        console.log('🔍 Joining event with code:', shareCode, 'Profile:', currentProfile.name);

        // If cloud sync is enabled, try to load from cloud first
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          try {
            const { loadEventByShareCode } = await import('../utils/eventSync');
            const cloudEvent = await loadEventByShareCode(shareCode);
            
            if (cloudEvent) {
              console.log('📥 Event loaded from cloud:', cloudEvent.id, 'Golfers:', cloudEvent.golfers.length);
              
              // Check if already joined
              const alreadyJoined = cloudEvent.golfers.some(g => g.profileId === currentProfile.id);
              if (alreadyJoined) {
                console.log('✅ Already joined this event');
                // Ensure event is in local state
                const localEvent = get().events.find(e => e.id === cloudEvent.id);
                if (!localEvent) {
                  set({ events: [...get().events, cloudEvent] });
                }
                return { success: true, eventId: cloudEvent.id };
              }

              // Add event to local state if not already there
              const localEvent = get().events.find(e => e.id === cloudEvent.id);
              if (!localEvent) {
                console.log('📝 Adding event to local state');
                set({ events: [...get().events, cloudEvent] });
              } else {
                console.log('📝 Event already in local state, updating');
                set({ events: get().events.map(e => e.id === cloudEvent.id ? cloudEvent : e) });
              }

              // Add the user to the event (this will sync to cloud)
              console.log('➕ Adding golfer to event...');
              await get().addGolferToEvent(cloudEvent.id, currentProfile.id);
              
              // Verify the golfer was added
              const updatedEvent = get().events.find(e => e.id === cloudEvent.id);
              const wasAdded = updatedEvent?.golfers.some(g => g.profileId === currentProfile.id);
              console.log('✅ Golfer added to event:', wasAdded, 'Total golfers:', updatedEvent?.golfers.length);
              
              return { success: true, eventId: cloudEvent.id };
            }
          } catch (error) {
            console.error('❌ Failed to load event from cloud:', error);
          }
        }

        // Fallback to local-only search
        console.log('🔍 Searching for event locally...');
        const event = get().events.find(e => e.shareCode === shareCode && e.isPublic);
        if (!event) {
          console.log('❌ Event not found');
          return { success: false, error: 'Event not found or share code is invalid.' };
        }
        
        const alreadyJoined = event.golfers.some(g => g.profileId === currentProfile.id);
        if (alreadyJoined) {
          console.log('✅ Already joined (local)');
          return { success: true, eventId: event.id };
        }
        
        // Add the user to the event
        console.log('➕ Adding golfer to local event...');
        await get().addGolferToEvent(event.id, currentProfile.id);
        console.log('✅ Golfer added (local)');
        return { success: true, eventId: event.id };
      },

      // Chat feature
      addChatMessage: async (eventId: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const currentProfile = get().currentProfile;
        if (!currentProfile) return;
        
        console.log('💬 addChatMessage: Adding message to event:', eventId);
        
        const msg: ChatMessage = {
          id: nanoid(10),
          profileId: currentProfile.id,
          senderName: currentProfile.name, // Save display name for cross-device
          text: trimmed.slice(0, 2000), // guard length
          createdAt: new Date().toISOString()
        };
        
        // Add to local state immediately for instant feedback
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const existing = e.chat || [];
            // Keep only last 500 messages to limit growth
            const next = [...existing, msg].slice(-500);
            
            console.log('💬 addChatMessage: Message added locally. Total messages:', next.length);
            return { ...e, chat: next, lastModified: new Date().toISOString() };
          })
        });
        
        // Save individual message to cloud (NOT the entire event)
        console.log('☁️ addChatMessage: Saving individual message to cloud...');
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          try {
            const { saveChatMessageToCloud } = await import('../utils/eventSync');
            await saveChatMessageToCloud(eventId, msg);
            console.log('✅ addChatMessage: Message saved to cloud');
          } catch (error) {
            console.error('❌ addChatMessage: Failed to save message to cloud:', error);
          }
        }
      },
      clearChat: (eventId: string) => {
        set({
          events: get().events.map(e => e.id === eventId ? { ...e, chat: [], lastModified: new Date().toISOString() } : e)
        });
      },
      
      // Scorecard permissions
      canEditScore: (eventId: string, golferId: string) => {
        const event = get().events.find(e => e.id === eventId);
        const currentProfile = get().currentProfile;
        if (!event || !currentProfile) return false;
        
        // Event owner can edit all scores in admin mode
        if (event.ownerProfileId === currentProfile.id) return true;
        
        // Can always edit own score
        if (golferId === currentProfile.id) return true;
        
        // In team mode, can edit team members' scores
        if (event.scorecardView === 'team') {
          // Find all teams in Nassau games that include the current user
          const userTeams = event.games.nassau.flatMap(nassau =>
            nassau.teams?.filter(team => team.golferIds.includes(currentProfile.id)) || []
          );
          
          // Get all golfer IDs from the user's teams
          const teamGolferIds = userTeams.flatMap(team => team.golferIds);
          
          // Can edit if golferId is in one of current user's teams
          return teamGolferIds.includes(golferId);
        }
        
        // Otherwise, can only edit own score
        return false;
      },
      
      setScorecardView: (eventId: string, view: 'individual' | 'team' | 'admin') => {
        set({
          events: get().events.map(e => 
            e.id === eventId ? { ...e, scorecardView: view, lastModified: new Date().toISOString() } : e
          )
        });
      },
      
      // Toast notifications
      addToast: (message: string, type: 'achievement' | 'info' | 'success' | 'error' = 'info', duration: number = 4000) => {
        const toast: Toast = {
          id: nanoid(8),
          message,
          type,
          duration,
          createdAt: new Date().toISOString()
        };
        set({ toasts: [...get().toasts, toast] });
        
        // Auto-remove toast after duration (with cleanup to prevent memory leaks)
        setTimeout(() => {
          get().removeToast(toast.id);
        }, duration);
      },
      
      removeToast: (toastId: string) => {
        set({
          toasts: get().toasts.filter(t => t.id !== toastId)
        });
      },

      // Individual Handicap Rounds
      addIndividualRound: (roundData: Omit<IndividualRound, 'id' | 'createdAt'>): string => {
        const roundId = nanoid();
        const newRound: IndividualRound = {
          ...roundData,
          id: roundId,
          createdAt: new Date().toISOString()
        };

        // Find the profile to update
        const profileToUpdate = get().profiles.find(p => p.id === roundData.profileId);
        if (!profileToUpdate) return roundId;

        // Create updated profile with new round and stats
        const updatedProfile = {
          ...profileToUpdate,
          individualRounds: [...(profileToUpdate.individualRounds || []), newRound],
          stats: {
            ...profileToUpdate.stats,
            roundsPlayed: profileToUpdate.stats.roundsPlayed + 1,
            averageScore: profileToUpdate.stats.roundsPlayed > 0 
              ? ((profileToUpdate.stats.averageScore * profileToUpdate.stats.roundsPlayed) + roundData.grossScore) / (profileToUpdate.stats.roundsPlayed + 1)
              : roundData.grossScore,
            bestScore: profileToUpdate.stats.bestScore === 0 || roundData.grossScore < profileToUpdate.stats.bestScore
              ? roundData.grossScore
              : profileToUpdate.stats.bestScore
          }
        };

        set({
          profiles: get().profiles.map(profile =>
            profile.id === roundData.profileId ? updatedProfile : profile
          ),
          // Also update currentProfile if it's the same profile
          currentProfile: get().currentProfile?.id === roundData.profileId ? updatedProfile : get().currentProfile
        });

        // Auto-calculate handicap after adding round
        get().calculateAndUpdateHandicap(roundData.profileId);
        
        // Sync to cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          import('../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
            saveIndividualRoundToCloud(newRound).then(() => {
              console.log('✅ addIndividualRound: Round saved to cloud:', newRound.id);
            }).catch((err: unknown) => {
              console.error('❌ addIndividualRound: Failed to save round to cloud:', err);
            });
          });
        }
        
        return roundId;
      },

      getProfileRounds: (profileId: string): CombinedRound[] => {
        const profile = get().profiles.find(p => p.id === profileId);
        const rounds: CombinedRound[] = [];

        // Add individual rounds (includes converted event rounds)
        if (profile?.individualRounds) {
          profile.individualRounds.forEach(round => {
            const course = getCourseById(round.courseId);
            rounds.push({
              id: round.id,
              type: 'individual',
              date: round.date,
              courseName: course?.name || 'Unknown Course',
              teeName: round.teeName,
              grossScore: round.grossScore,
              netScore: round.netScore,
              scoreDifferential: round.scoreDifferential,
              scores: round.scores,
              completedRoundId: round.completedRoundId
            });
          });
        }

        // Sort by date (most recent first)
        return rounds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },

      calculateAndUpdateHandicap: (profileId: string): void => {
        const profile = get().profiles.find(p => p.id === profileId);
        if (!profile?.individualRounds) return;

        // Get all score differentials
        const differentials = profile.individualRounds
          .map(round => round.scoreDifferential)
          .filter(diff => diff !== undefined && !isNaN(diff));

        if (differentials.length === 0) return;

  // Calculate WHS handicap index - pass ids so we can know which rounds were used
  const roundEntries = profile.individualRounds.map(r => ({ id: r.id, differential: r.scoreDifferential }));
  const whsResult = calculateWHSHandicapIndex(roundEntries as any);

        // Create the updated profile object
        const updatedProfile = {
          ...profile,
          handicapIndex: whsResult.handicapIndex,
          handicapHistory: [
            ...(profile.handicapHistory || []),
            {
              date: whsResult.calculationDate,
              handicapIndex: whsResult.handicapIndex,
              rounds: profile.individualRounds || [],
              usedRoundIds: whsResult.usedRoundIds,
              source: 'calculation' as const
            }
          ]
        };

        // Update profile with new handicap and record which rounds were used
        set({
          profiles: get().profiles.map(p =>
            p.id === profileId ? updatedProfile : p
          ),
          // Also update currentProfile if it's the same profile
          currentProfile: get().currentProfile?.id === profileId ? updatedProfile : get().currentProfile
        });
      },

      recalculateAllDifferentials: (): void => {
        const state = get();
        
        // First, check if any completed rounds should be added to individual rounds for handicap
        state.profiles.forEach(profile => {
          // Create a set of existing individual round dates/courses to avoid duplicates
          const existingRounds = new Set(
            profile.individualRounds?.map(r => `${r.date}-${r.courseId}-${r.teeName}`) || []
          );
          const completedRoundsForProfile = state.completedRounds.filter(cr => 
            cr.golferId === profile.id && 
            cr.courseId && 
            !existingRounds.has(`${cr.datePlayed}-${cr.courseId}-${cr.teeName}`)
          );
          
          completedRoundsForProfile.forEach(completedRound => {
            if (!completedRound.courseId) return;
            
            // Convert completed event round to individual round
            const course = getCourseById(completedRound.courseId!);
            const tee = course?.tees.find((t: any) => t.name === completedRound.teeName);
            
            if (tee && completedRound.holesPlayed >= 14) {
              const currentHandicap = completedRound.handicapIndex || 0;
              const cr1 = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
              const sl1 = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
              const courseHandicap = Math.round(currentHandicap * (sl1 / 113) + (cr1 - tee.par));
              
              // Build scores array
              const strokeDist = distributeHandicapStrokes(courseHandicap, completedRound.courseId!, completedRound.teeName);
              const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map(holeScore => ({
                hole: holeScore.hole,
                par: holeScore.par,
                strokes: holeScore.strokes,
                handicapStrokes: strokeDist[holeScore.hole] || 0,
                netStrokes: holeScore.strokes - (strokeDist[holeScore.hole] || 0)
              }));
              
              // Apply ESC and calculate differential
              let adjustedGross = 0;
              roundScores.forEach(s => {
                const raw = s.strokes || 0;
                const maxScore = applyESCAdjustment(raw, s.par, s.handicapStrokes);
                adjustedGross += maxScore;
              });
              
              const scoreDifferential = calculateScoreDifferential(adjustedGross, cr1, sl1);
              
              const newIndividualRound: IndividualRound = {
                id: nanoid(8),
                profileId: profile.id,
                date: completedRound.datePlayed,
                courseId: completedRound.courseId,
                teeName: completedRound.teeName || tee.name,
                grossScore: completedRound.finalScore,
                netScore: completedRound.finalScore - courseHandicap,
                courseHandicap,
                scoreDifferential,
                courseRating: cr1,
                slopeRating: sl1,
                scores: roundScores,
                eventId: completedRound.eventId, // Link back to source event
                completedRoundId: completedRound.id, // Link to CompletedRound to prevent double-counting
                createdAt: new Date().toISOString()
              };
              
              // Add to profile's individual rounds
              set({
                profiles: get().profiles.map(p =>
                  p.id === profile.id ? {
                    ...p,
                    individualRounds: [...(p.individualRounds || []), newIndividualRound]
                  } : p
                )
              });
              
              // Sync IndividualRound to cloud
              if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
                import('../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
                  saveIndividualRoundToCloud(newIndividualRound).then(() => {
                    console.log('✅ recalculateAllDifferentials: IndividualRound saved to cloud:', newIndividualRound.id);
                  }).catch((err: unknown) => {
                    console.error('❌ recalculateAllDifferentials: Failed to save IndividualRound to cloud:', err);
                  });
                });
              }
            }
          });
        });
        
        // For each profile, recompute round differentials if possible
        const updatedProfiles = state.profiles.map(profile => {
          if (!profile.individualRounds || profile.individualRounds.length === 0) return profile;

          const recomputed = profile.individualRounds.map(r => {
            try {
              const course = getCourseById(r.courseId);
              if (!course) return r;
              const tee = course.tees.find(t => t.name === r.teeName);
              if (!tee) return r;

              // Distribute strokes and apply ESC
              const strokeDist = distributeHandicapStrokes(r.courseHandicap || 0, r.courseId, r.teeName);
              let adjustedGross = 0;
              r.scores.forEach(s => {
                const raw = s.strokes || 0;
                const par = s.par || 4;
                const handicapStrokes = strokeDist[s.hole] || 0;
                const adj = applyESCAdjustment(raw, par, handicapStrokes);
                adjustedGross += adj;
              });

              const cr2 = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
              const sl2 = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
              const diff = calculateScoreDifferential(adjustedGross, cr2, sl2);
              return { ...r, scoreDifferential: diff };
            } catch {
              return r;
            }
          });

          return { ...profile, individualRounds: recomputed };
        });

        // Find the updated current profile if it exists
        const currentProfileId = get().currentProfile?.id;
        const updatedCurrentProfile = currentProfileId 
          ? updatedProfiles.find(p => p.id === currentProfileId) 
          : null;

        set({ 
          profiles: updatedProfiles,
          // Also update currentProfile if it was updated
          currentProfile: updatedCurrentProfile || get().currentProfile
        });

        // Recalculate handicap for each profile that had rounds
        updatedProfiles.forEach(p => {
          if (p.individualRounds && p.individualRounds.length > 0) get().calculateAndUpdateHandicap(p.id);
        });
      },

      deleteIndividualRound: (roundId: string): void => {
        let affectedProfileId: string | null = null;
        let affectedProfile: GolferProfile | null = null;

        const updatedProfiles = get().profiles.map(profile => {
          const updatedRounds = profile.individualRounds?.filter(round => {
            if (round.id === roundId) {
              affectedProfileId = profile.id;
              return false;
            }
            return true;
          });

          if (updatedRounds?.length !== profile.individualRounds?.length) {
            const updated = {
              ...profile,
              individualRounds: updatedRounds,
              stats: {
                ...profile.stats,
                roundsPlayed: Math.max(0, profile.stats.roundsPlayed - 1)
              }
            };
            if (profile.id === affectedProfileId) {
              affectedProfile = updated;
            }
            return updated;
          }
          return profile;
        });

        set({
          profiles: updatedProfiles,
          // Also update currentProfile if it's the affected profile
          currentProfile: get().currentProfile?.id === affectedProfileId && affectedProfile 
            ? affectedProfile 
            : get().currentProfile
        });

        // Recalculate handicap if a round was removed
        if (affectedProfileId) {
          get().calculateAndUpdateHandicap(affectedProfileId);
        }
        
        // Delete from cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          import('../utils/roundSync').then(({ deleteIndividualRoundFromCloud }) => {
            deleteIndividualRoundFromCloud(roundId).then(() => {
              console.log('✅ deleteIndividualRound: Round deleted from cloud:', roundId);
            }).catch((err: unknown) => {
              console.error('❌ deleteIndividualRound: Failed to delete round from cloud:', err);
            });
          });
        }
      },
      
      completeEvent: (eventId: string): boolean => {
        const event: Event | undefined = get().events.find((e: Event) => e.id === eventId);
        if (!event) return false;
        
        // Prevent completing an already-completed event
        if (event.isCompleted) {
          console.warn('⚠️ completeEvent: Event already completed:', eventId);
          return false;
        }
        
        // Check if event is already in completedEvents
        const alreadyCompleted = get().completedEvents.some(e => e.id === eventId);
        if (alreadyCompleted) {
          console.warn('⚠️ completeEvent: Event already in completedEvents:', eventId);
          return false;
        }
        
        // Check if all scores are complete
        const allScoresComplete = event.scorecards.every(sc => 
          sc.scores.every(s => s.strokes != null)
        );
        if (!allScoresComplete) return false;
        
        console.log(`🎯 completeEvent: Starting completion for event "${event.name}" (${eventId})`);
        
        // Calculate payouts for analytics
        const payouts = calculateEventPayouts(event, get().profiles);
        
        // Create completed rounds for each golfer
        const newCompletedRounds: CompletedRound[] = [];
        
        event.golfers.forEach(eventGolfer => {
          const golferId = eventGolfer.profileId || eventGolfer.customName;
          if (!golferId) return;
          
          const profile = eventGolfer.profileId ? get().profiles.find(p => p.id === eventGolfer.profileId) : null;
          const golferName = profile ? profile.name : eventGolfer.customName || 'Unknown';
          
          const scorecard = event.scorecards.find(sc => sc.golferId === golferId);
          if (!scorecard) return;
          
          // Calculate final score and stats
          let totalScore = 0;
          let totalPar = 0;
          let holesPlayed = 0;
          const holeScores: { hole: number; strokes: number; par: number; toPar: number }[] = [];
          const stats = {
            birdies: 0,
            eagles: 0,
            pars: 0,
            bogeys: 0,
            doubleBogeys: 0,
            triplesOrWorse: 0
          };
          
          scorecard.scores.forEach(score => {
            if (score.strokes != null) {
              // Get par for this hole
              let holePar = 4; // default
              if (event.course.courseId) {
                const holeData = getHole(event.course.courseId, score.hole, event.course.teeName);
                if (holeData) holePar = holeData.par;
              }
              
              totalScore += score.strokes;
              totalPar += holePar;
              holesPlayed++;
              
              const toPar = score.strokes - holePar;
              holeScores.push({
                hole: score.hole,
                strokes: score.strokes,
                par: holePar,
                toPar
              });
              
              // Count stats
              if (toPar <= -2) stats.eagles++;
              else if (toPar === -1) stats.birdies++;
              else if (toPar === 0) stats.pars++;
              else if (toPar === 1) stats.bogeys++;
              else if (toPar === 2) stats.doubleBogeys++;
              else if (toPar >= 3) stats.triplesOrWorse++;
            }
          });
          
          // Get game results for this golfer
          const gameResults: CompletedRound['gameResults'] = {};
          
          // Nassau results
          const nassauWinnings = payouts.nassau.reduce((total: number, n: any) => {
            return total + (n.winningsByGolfer[golferId] || 0);
          }, 0);
          if (nassauWinnings !== 0) {
            gameResults.nassau = {
              winnings: nassauWinnings,
              position: 1 // Could be enhanced to calculate actual position
            };
          }
          
          // Skins results
          const skinsWinnings = payouts.skins.reduce((total: number, s: any) => {
            if (!s) return total;
            return total + (s.winningsByGolfer[golferId] || 0);
          }, 0);
          if (skinsWinnings !== 0) {
            gameResults.skins = {
              winnings: skinsWinnings,
              skinsWon: 0 // Could be enhanced to count actual skins won
            };
          }
          
          const completedRound: CompletedRound = {
            id: nanoid(8),
            eventId: event.id,
            eventName: event.name,
            datePlayed: event.date,
            courseId: event.course.courseId,
            courseName: event.course.courseId ? (getCourseById(event.course.courseId)?.name || 'Unknown Course') : 'Custom Course',
            teeName: eventGolfer.teeName,
            golferId,
            golferName,
            handicapIndex: eventGolfer.handicapOverride ?? profile?.handicapIndex,
            finalScore: totalScore,
            scoreToPar: totalScore - totalPar,
            holesPlayed,
            holeScores,
            gameResults,
            stats,
            createdAt: new Date().toISOString()
          };
          
          newCompletedRounds.push(completedRound);
          console.log(`✅ completeEvent: Created CompletedRound for ${golferName} - ID: ${completedRound.id}, Score: ${totalScore}`);
          
          // Update profile stats (IndividualRounds now created separately for ALL participants below)
          if (profile) {
            const roundsPlayed = profile.stats.roundsPlayed + 1;
            const averageScore = ((profile.stats.averageScore * profile.stats.roundsPlayed) + totalScore) / roundsPlayed;
            const bestScore = Math.min(profile.stats.bestScore || totalScore, totalScore);
            
            set({
              profiles: get().profiles.map(p => 
                p.id === profile.id ? {
                  ...p,
                  stats: {
                    ...p.stats,
                    roundsPlayed,
                    averageScore,
                    bestScore,
                    totalBirdies: p.stats.totalBirdies + stats.birdies,
                    totalEagles: p.stats.totalEagles + stats.eagles
                  },
                  lastActive: new Date().toISOString()
                } : p
              )
            });
          }
        });
        
        // Mark event as completed and move to completed events
        const completedAt = new Date().toISOString();
        const completedEvent = { ...event, isCompleted: true, completedAt, lastModified: completedAt };
        
        set({
          completedRounds: [...get().completedRounds, ...newCompletedRounds],
          events: get().events.filter(e => e.id !== eventId), // Remove from active events
          completedEvents: [...get().completedEvents, completedEvent] // Add to completed events
        });
        
        // Create IndividualRounds for ALL participants and save to cloud
        // (not just those with local profiles - others will load these from cloud)
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && event.course.courseId) {
          newCompletedRounds.forEach(completedRound => {
            // Only create for participants with profileIds (not custom names)
            const eventGolfer = event.golfers.find(g => g.profileId === completedRound.golferId);
            if (!eventGolfer || !eventGolfer.profileId) return;
            
            const course = getCourseById(event.course.courseId!);
            const tee = course?.tees.find(t => t.name === completedRound.teeName);
            
            if (tee && completedRound.holesPlayed >= 14) {
              const currentHandicap = completedRound.handicapIndex || 0;
              const cr = (tee.courseRating ?? (tee as any).rating ?? 72) as number;
              const sl = (tee.slopeRating ?? (tee as any).slope ?? 113) as number;
              const courseHandicap = Math.round(currentHandicap * (sl / 113) + (cr - tee.par));
              
              // Build scores array
              const strokeDist = distributeHandicapStrokes(courseHandicap, event.course.courseId!, tee.name);
              const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map(holeScore => ({
                hole: holeScore.hole,
                par: holeScore.par,
                strokes: holeScore.strokes,
                handicapStrokes: strokeDist[holeScore.hole] || 0,
                netStrokes: holeScore.strokes - (strokeDist[holeScore.hole] || 0)
              }));
              
              // Apply ESC and calculate differential
              let adjustedGross = 0;
              roundScores.forEach(s => {
                const raw = s.strokes || 0;
                const maxScore = applyESCAdjustment(raw, s.par, s.handicapStrokes);
                adjustedGross += maxScore;
              });
              
              const scoreDifferential = calculateScoreDifferential(adjustedGross, cr, sl);
              
              const individualRound: IndividualRound = {
                id: nanoid(8),
                profileId: eventGolfer.profileId,
                date: event.date,
                courseId: event.course.courseId!,
                teeName: completedRound.teeName || tee.name,
                grossScore: completedRound.finalScore,
                netScore: completedRound.finalScore - courseHandicap,
                courseHandicap,
                scoreDifferential,
                courseRating: cr,
                slopeRating: sl,
                scores: roundScores,
                eventId: event.id, // CRITICAL: Link to event to prevent double-counting
                completedRoundId: completedRound.id, // CRITICAL: Link to CompletedRound to prevent double-counting
                createdAt: new Date().toISOString()
              };
              
              console.log(`✅ completeEvent: Creating IndividualRound for cloud for ${completedRound.golferName} - EventId: ${event.id}`);
              
              // Save to cloud (will be loaded by participant's browser)
              import('../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
                saveIndividualRoundToCloud(individualRound).then(() => {
                  console.log(`✅ completeEvent: IndividualRound saved to cloud for ${completedRound.golferName}`);
                }).catch((err: unknown) => {
                  console.error(`❌ completeEvent: Failed to save IndividualRound to cloud for ${completedRound.golferName}:`, err);
                });
              });
            }
          });
        }
        
        // Sync completed rounds to cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && newCompletedRounds.length > 0) {
          import('../utils/completedRoundSync').then(({ batchSaveCompletedRoundsToCloud }) => {
            batchSaveCompletedRoundsToCloud(newCompletedRounds).then((savedCount) => {
              console.log(`✅ completeEvent: Saved ${savedCount}/${newCompletedRounds.length} CompletedRounds to cloud`);
            }).catch((err: unknown) => {
              console.error('❌ completeEvent: Failed to save CompletedRounds to cloud:', err);
            });
          });
        }
        
        // Sync completed event to cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          const currentProfile = get().currentProfile;
          if (currentProfile) {
            import('../utils/eventSync').then(({ saveEventToCloud }) => {
              saveEventToCloud(completedEvent, currentProfile.id).then(() => {
                console.log('✅ completeEvent: Completed event saved to cloud:', eventId);
              }).catch((err: unknown) => {
                console.error('❌ completeEvent: Failed to save completed event to cloud:', err);
              });
            });
          }
        }
        
        return true;
      },
      
      importData: (data: Event[]) => set({ events: data }),
      exportData: () => JSON.stringify(get().events, null, 2)
    }),
    {
      name: 'gimmies-store',
      version: 4, // Increment version for migration
      storage: createJSONStorage(() => idbStorage),
      migrate: (state: any, version: number) => {
        if (!state) return state;
        
        // Migrate from old Golfer to new EventGolfer structure
        if (state.events && Array.isArray(state.events)) {
          state.events = state.events.map((e: any) => {
            if (!e.games) e.games = { nassau: [], skins: [] };
            
            // Convert old golfers to new format
            if (e.golfers && e.golfers[0] && e.golfers[0].id) {
              // Create profiles for old golfers
              const profiles = state.profiles || [];
              e.golfers.forEach((oldGolfer: any) => {
                const existingProfile = profiles.find((p: any) => p.name === oldGolfer.name);
                if (!existingProfile) {
                  const newProfile: GolferProfile = {
                    id: oldGolfer.id,
                    userId: 'default-user', // Assign to default user for migration
                    name: oldGolfer.name,
                    handicapIndex: oldGolfer.index,
                    stats: {
                      roundsPlayed: 0,
                      averageScore: 0,
                      bestScore: 0,
                      totalBirdies: 0,
                      totalEagles: 0
                    },
                    preferences: {
                      theme: 'auto',
                      defaultNetScoring: false,
                      autoAdvanceScores: true,
                      showHandicapStrokes: true
                    },
                    createdAt: new Date().toISOString(),
                    lastActive: new Date().toISOString()
                  };
                  profiles.push(newProfile);
                }
              });
              
              // Convert to EventGolfer format
              e.golfers = e.golfers.map((oldGolfer: any) => ({
                profileId: oldGolfer.id,
                teeName: oldGolfer.teeName,
                handicapOverride: oldGolfer.index
              }));
              
              state.profiles = profiles;
            }
            
            // Ensure new required fields
            if (!e.ownerProfileId) e.ownerProfileId = e.golfers[0]?.profileId || 'unknown';
            if (!e.isPublic) e.isPublic = false;
            if (!e.scorecardView) e.scorecardView = 'individual'; // Default to individual view
            if (!e.createdAt) e.createdAt = new Date().toISOString();
            if (!e.lastModified) e.lastModified = new Date().toISOString();
            if (!e.chat) e.chat = [];
            
            // Previous shapes: skins null | object | array
            let skinsVal = e.games.skins;
            if (skinsVal == null) skinsVal = [];
            else if (Array.isArray(skinsVal)) skinsVal = skinsVal;
            else if (skinsVal && typeof skinsVal === 'object' && skinsVal.id) skinsVal = [skinsVal];
            else skinsVal = [];
            
            // Ensure skins configs have new field shape (no change needed if absent)
            skinsVal = skinsVal.map((sc: any) => ({ ...sc }));
            
            // Initialize pinky (new game type)
            let pinkyVal = (e.games as any).pinky;
            if (!Array.isArray(pinkyVal)) pinkyVal = [];
            
            // Initialize greenie (new game type)
            let greenieVal = (e.games as any).greenie;
            if (!Array.isArray(greenieVal)) greenieVal = [];
            
            return { ...e, games: { nassau: Array.isArray(e.games.nassau) ? e.games.nassau : [], skins: skinsVal, pinky: pinkyVal, greenie: greenieVal } };
          });
        }
        
        // Initialize new state properties
        if (!state.currentProfile && state.profiles && state.profiles.length > 0) {
          state.currentProfile = state.profiles[0];
        }
        
        // Initialize user system
        if (!state.users) {
          state.users = [];
        }
        if (!state.currentUser && state.users.length === 0) {
          // Create default user for existing data
          const defaultUser: User = {
            id: 'default-user',
            username: 'default',
            displayName: 'Default User',
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
          };
          state.users = [defaultUser];
          state.currentUser = defaultUser;
        }
        
        return state;
      }
    }
  )
);

export default useStore;
