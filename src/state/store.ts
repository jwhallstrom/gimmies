import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid/non-secure';
import { courseMap, courses } from '../data/courses';

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
  teeName?: string; // event-specific tee override
  handicapOverride?: number | null; // event-specific handicap override
}

export interface Group { id: string; golferIds: string[]; teeTime?: string; }
export interface NassauTeam { id: string; name: string; golferIds: string[]; }
export interface NassauConfig { id: string; groupId: string; fee: number; net: boolean; pressesOff?: boolean; teams?: NassauTeam[]; teamBestCount?: number; participantGolferIds?: string[]; }
export interface SkinsConfig { id: string; fee: number; net: boolean; participantGolferIds?: string[]; }
export interface ScoreEntry { hole: number; strokes: number | null; }
export interface PlayerScorecard { golferId: string; scores: ScoreEntry[]; }
export interface EventGameConfig { nassau: NassauConfig[]; skins: SkinsConfig[]; }
export interface EventCourseSelection { courseId?: string; teeName?: string; }

// Event scoped chat message
export interface ChatMessage {
  id: string;            // unique id
  profileId: string;     // sender profile id
  text: string;          // message body (plain text for now)
  createdAt: string;     // ISO timestamp
}

// Extended Event with sharing and ownership
export interface Event {
  id: string;
  name: string;
  date: string;
  course: EventCourseSelection;
  golfers: EventGolfer[]; // now references profiles
  groups: Group[];
  scorecards: PlayerScorecard[];
  games: EventGameConfig;
  ownerProfileId: string; // who created the event
  shareCode?: string; // for sharing with others
  isPublic: boolean; // allow anyone to join
  createdAt: string;
  lastModified: string;
  chat?: ChatMessage[]; // event-scoped chat history
}

interface State {
  // Current user session
  currentUser: User | null;
  users: User[];
  
  // Current user profile
  currentProfile: GolferProfile | null;
  profiles: GolferProfile[];
  
  events: Event[];
  createEvent: () => string | null;
  setEventCourse: (eventId: string, courseId: string) => void;
  setEventTee: (eventId: string, teeName: string) => void;
  updateEvent: (id: string, patch: Partial<Event>) => void;
  deleteEvent: (eventId: string) => void;
  importData: (data: Event[]) => void;
  exportData: () => string;
  
  // User management
  createUser: (username: string, displayName?: string) => void;
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
  addGolferToEvent: (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => void;
  updateEventGolfer: (eventId: string, golferId: string, patch: Partial<EventGolfer>) => void;
  removeGolferFromEvent: (eventId: string, golferId: string) => void;
  
  addGroup: (eventId: string) => void;
  assignGolferToGroup: (eventId: string, groupId: string, golferId: string) => void;
  updateScore: (eventId: string, golferId: string, hole: number, strokes: number | null) => void;
  moveGolferToGroup: (eventId: string, golferId: string, targetGroupId: string | null) => void;
  setGroupTeeTime: (eventId: string, groupId: string, teeTime: string) => void;
  removeGroup: (eventId: string, groupId: string) => void;
  removeNassau: (eventId: string, nassauId: string) => void;
  removeSkins: (eventId: string, skinsId: string) => void;
  
  // Event sharing
  generateShareCode: (eventId: string) => string;
  joinEventByCode: (shareCode: string) => { success: boolean; error?: string };
  // Chat
  addChatMessage: (eventId: string, text: string) => void;
  clearChat: (eventId: string) => void;
}

const defaultScoreArray = (courseId?: string) => {
  const def = courseId ? courseMap[courseId] : undefined;
  const holes = def ? def.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4 }));
  return holes.map(h => ({ hole: h.number, strokes: null }));
};

export const useStore = create<State>()(
  persist(
    (set: any, get: () => State) => ({
      currentUser: null,
      users: [],
      currentProfile: null,
      profiles: [],
      events: [],
      
      createUser: (username: string, displayName?: string) => {
        const user: User = {
          id: nanoid(8),
          username,
          displayName: displayName || username,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        set({ users: [...get().users, user] });
        if (!get().currentUser) {
          set({ currentUser: user });
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
          set({ 
            currentUser: user,
            currentProfile: null // Reset profile when switching users
          });
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
      
      createEvent: () => {
        const currentProfile = get().currentProfile;
        if (!currentProfile) return null;
        
        const id = nanoid(8);
        const eventGolfer: EventGolfer = { 
          profileId: currentProfile.id,
          teeName: undefined,
          handicapOverride: null 
        };
        const scorecard: PlayerScorecard = { 
          golferId: currentProfile.id, 
          scores: defaultScoreArray() 
        };
        const group = { id: nanoid(5), golferIds: [currentProfile.id] };
        
        const newEvent: Event = {
          id,
          name: '',
          date: new Date().toISOString().slice(0, 10),
          course: {},
          golfers: [eventGolfer],
          groups: [group],
          scorecards: [scorecard],
          games: { nassau: [], skins: [] },
          ownerProfileId: currentProfile.id,
          isPublic: false,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          chat: []
        };
        set({ events: [...get().events, newEvent] });
        console.log('Event created with current user as golfer:', newEvent);
        return id;
      },
      
      setEventCourse: (eventId: string, courseId: string) => {
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
      },
      
      setEventTee: (eventId: string, teeName: string) => {
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
      },
      
      updateEvent: (id: string, patch: Partial<Event>) => {
        set({
          events: get().events.map((e: Event) => 
            e.id === id ? { ...e, ...patch, lastModified: new Date().toISOString() } : e
          )
        });
      },
      
      deleteEvent: (eventId: string) => {
        set({
          events: get().events.filter(e => e.id !== eventId)
        });
      },
      
      addGolferToEvent: (eventId: string, golferId: string, teeName?: string, handicapOverride?: number | null) => {
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            
            // Check if golferId is a profile ID or custom name
            const isProfileId = get().profiles.some(p => p.id === golferId);
            const eventGolfer: EventGolfer = isProfileId 
              ? { 
                  profileId: golferId, 
                  teeName: teeName || undefined, 
                  handicapOverride: handicapOverride ?? null 
                }
              : { 
                  customName: golferId, 
                  teeName: teeName || undefined, 
                  handicapOverride: handicapOverride ?? null 
                };
            
            const def = e.course.courseId ? courseMap[e.course.courseId] : undefined;
            const holes = def ? def.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1 }));
            const scorecard: PlayerScorecard = { 
              golferId, 
              scores: holes.map(h => ({ hole: h.number, strokes: null })) 
            };
            let groups = e.groups;
            if (groups.length === 0) {
              groups = [{ id: nanoid(5), golferIds: [golferId] }];
            } else {
              groups = groups.map(g => ({ ...g, golferIds: [...new Set([...g.golferIds, golferId])] }));
            }
            return { 
              ...e, 
              golfers: [...e.golfers, eventGolfer], 
              scorecards: [...e.scorecards, scorecard], 
              groups,
              lastModified: new Date().toISOString()
            };
          })
        });
      },
      
      updateEventGolfer: (eventId: string, golferId: string, patch: Partial<EventGolfer>) => {
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
      },
      
      removeGolferFromEvent: (eventId: string, golferId: string) => {
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
      
      updateScore: (eventId: string, golferId: string, hole: number, strokes: number | null) => {
        set({
          events: get().events.map(e => {
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
          })
        });
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
      
      removeNassau: (eventId: string, nassauId: string) => {
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
      },
      
      removeSkins: (eventId: string, skinsId: string) => {
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
      },
      
      generateShareCode: (eventId: string) => {
        const shareCode = nanoid(6).toUpperCase();
        set({
          events: get().events.map(e => 
            e.id === eventId ? { ...e, shareCode, isPublic: true, lastModified: new Date().toISOString() } : e
          )
        });
        return shareCode;
      },
      
      joinEventByCode: (shareCode: string) => {
        const event = get().events.find(e => e.shareCode === shareCode && e.isPublic);
        if (!event) {
          return { success: false, error: 'Event not found or share code is invalid.' };
        }
        
        // Add current user to the event if not already joined
        const currentProfile = get().currentProfile;
        if (!currentProfile) {
          return { success: false, error: 'Please create a profile first to join events.' };
        }
        
        const alreadyJoined = event.golfers.some(g => g.profileId === currentProfile.id);
        if (alreadyJoined) {
          return { success: true };
        }
        
        // Add the user to the event
        get().addGolferToEvent(event.id, currentProfile.id);
        return { success: true };
      },

      // Chat feature
      addChatMessage: (eventId: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const currentProfile = get().currentProfile;
        if (!currentProfile) return;
        set({
          events: get().events.map(e => {
            if (e.id !== eventId) return e;
            const msg: ChatMessage = {
              id: nanoid(10),
              profileId: currentProfile.id,
              text: trimmed.slice(0, 2000), // guard length
              createdAt: new Date().toISOString()
            };
            const existing = e.chat || [];
            // Keep only last 500 messages to limit growth
            const next = [...existing, msg].slice(-500);
            return { ...e, chat: next, lastModified: new Date().toISOString() };
          })
        });
      },
      clearChat: (eventId: string) => {
        set({
          events: get().events.map(e => e.id === eventId ? { ...e, chat: [], lastModified: new Date().toISOString() } : e)
        });
      },
      
      importData: (data: Event[]) => set({ events: data }),
      exportData: () => JSON.stringify(get().events, null, 2)
    }),
    {
      name: 'gimmies-store',
      version: 4, // Increment version for migration
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
            return { ...e, games: { nassau: Array.isArray(e.games.nassau) ? e.games.nassau : [], skins: skinsVal } };
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
