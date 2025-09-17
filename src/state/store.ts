import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid/non-secure';
import { courseMap, courses, courseTeesMap } from '../data/courses';
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
  
  createEvent: () => string | null;
  completeEvent: (eventId: string) => boolean; // Complete event and record rounds
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
      completedEvents: [],
      completedRounds: [],
      toasts: [],
      
      createUser: (username: string, displayName?: string) => {
        const user: User = {
          id: nanoid(8),
          username,
          displayName: displayName || username,
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        
        console.log('createUser: Creating user', user);
        set({ users: [...get().users, user] });
        
        if (!get().currentUser) {
          console.log('createUser: Setting as current user');
          set({ currentUser: user });
          
          // Immediately create a profile for the new user
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
          scorecardView: 'individual', // Default to individual view for owner
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
              groups = groups.map(g => ({ ...g, golferIds: Array.from(new Set([...g.golferIds, golferId])) }));
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
        const state = get();
        const event = state.events.find(e => e.id === eventId);
        if (!event) return;

        // Get player name for chat messages
        const eventGolfer = event.golfers.find(g => g.profileId === golferId || g.customName === golferId);
        const profile = eventGolfer?.profileId ? state.profiles.find(p => p.id === eventGolfer.profileId) : null;
        const playerName = profile ? profile.name : eventGolfer?.customName || 'Unknown Player';

        // Get course info for par calculations
        let holePar = 4; // default
        if (event.course.courseId && courseMap[event.course.courseId]) {
          const holeData = courseMap[event.course.courseId].holes.find(h => h.number === hole);
          if (holeData) holePar = holeData.par;
        }

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
              if (event.course.courseId && courseMap[event.course.courseId]) {
                const scoreHoleData = courseMap[event.course.courseId].holes.find(h => h.number === score.hole);
                if (scoreHoleData) scorePar = scoreHoleData.par;
              }
              
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
            text: chatMessage.trim(),
            createdAt: new Date().toISOString()
          };

          set({
            events: get().events.map(e => {
              if (e.id !== eventId) return e;
              const existing = e.chat || [];
              const next = [...existing, msg].slice(-500);
              return { ...e, chat: next, lastModified: new Date().toISOString() };
            })
          });

          // Also show toast notification for the achievement
          get().addToast(chatMessage.trim(), 'achievement', 5000);
        }
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
      
      // Scorecard permissions
      canEditScore: (eventId: string, golferId: string) => {
        const event = get().events.find(e => e.id === eventId);
        const currentProfile = get().currentProfile;
        if (!event || !currentProfile) return false;
        
        // Event owner can edit all scores
        if (event.ownerProfileId === currentProfile.id) return true;
        
        // Others can only edit their own scores
        return golferId === currentProfile.id;
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
        
        return roundId;
      },

      getProfileRounds: (profileId: string): CombinedRound[] => {
        const profile = get().profiles.find(p => p.id === profileId);
        const rounds: CombinedRound[] = [];

        // Add individual rounds (includes converted event rounds)
        if (profile?.individualRounds) {
          profile.individualRounds.forEach(round => {
            const courseTees = courseTeesMap[round.courseId];
            rounds.push({
              id: round.id,
              type: 'individual',
              date: round.date,
              courseName: courseTees?.courseName || 'Unknown Course',
              teeName: round.teeName,
              grossScore: round.grossScore,
              netScore: round.netScore,
              scoreDifferential: round.scoreDifferential,
              scores: round.scores
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
            const courseTees = courseTeesMap[completedRound.courseId];
            const tee = courseTees?.tees.find(t => t.name === completedRound.teeName);
            
            if (courseTees && tee && completedRound.holesPlayed >= 14) {
              const currentHandicap = completedRound.handicapIndex || 0;
              const courseHandicap = Math.round(currentHandicap * (tee.slopeRating / 113) + (tee.courseRating - tee.par));
              
              // Build scores array
              const strokeDist = distributeHandicapStrokes(courseHandicap, completedRound.courseId);
              const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map(holeScore => ({
                hole: holeScore.hole,
                par: holeScore.par,
                strokes: holeScore.strokes,
                handicapStrokes: strokeDist[holeScore.hole - 1] || 0,
                netStrokes: holeScore.strokes - (strokeDist[holeScore.hole - 1] || 0)
              }));
              
              // Apply ESC and calculate differential
              let adjustedGross = 0;
              roundScores.forEach(s => {
                const raw = s.strokes || 0;
                const maxScore = applyESCAdjustment(raw, s.par, s.handicapStrokes);
                adjustedGross += maxScore;
              });
              
              const scoreDifferential = calculateScoreDifferential(adjustedGross, tee.courseRating, tee.slopeRating);
              
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
                courseRating: tee.courseRating,
                slopeRating: tee.slopeRating,
                scores: roundScores,
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
            }
          });
        });
        
        // For each profile, recompute round differentials if possible
        const updatedProfiles = state.profiles.map(profile => {
          if (!profile.individualRounds || profile.individualRounds.length === 0) return profile;

          const recomputed = profile.individualRounds.map(r => {
            try {
              const courseTees = courseTeesMap[r.courseId];
              if (!courseTees) return r;
              const tee = courseTees.tees.find(t => t.name === r.teeName);
              if (!tee) return r;

              // Distribute strokes and apply ESC
              const strokeDist = distributeHandicapStrokes(r.courseHandicap || 0, r.courseId);
              let adjustedGross = 0;
              r.scores.forEach(s => {
                const raw = s.strokes || 0;
                const par = s.par || 4;
                const handicapStrokes = strokeDist[s.hole] || 0;
                const adj = applyESCAdjustment(raw, par, handicapStrokes);
                adjustedGross += adj;
              });

              const diff = calculateScoreDifferential(adjustedGross, tee.courseRating, tee.slopeRating);
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
      },
      
      completeEvent: (eventId: string): boolean => {
        const event: Event | undefined = get().events.find((e: Event) => e.id === eventId);
        if (!event) return false;
        
        // Check if all scores are complete
        const allScoresComplete = event.scorecards.every(sc => 
          sc.scores.every(s => s.strokes != null)
        );
        if (!allScoresComplete) return false;
        
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
                if (event.course.courseId && courseMap[event.course.courseId]) {
                  const course = courseMap[event.course.courseId];
                  const holeData = course.holes.find((h: any) => h.number === score.hole);
                  if (holeData) holePar = holeData.par;
                }
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
            courseName: event.course.courseId ? (courseMap[event.course.courseId]?.name || 'Unknown Course') : 'Custom Course',
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
          
          // Update profile stats and add round for handicap calculation
          if (profile && event.course.courseId) {
            const roundsPlayed = profile.stats.roundsPlayed + 1;
            const averageScore = ((profile.stats.averageScore * profile.stats.roundsPlayed) + totalScore) / roundsPlayed;
            const bestScore = Math.min(profile.stats.bestScore || totalScore, totalScore);
            
            // Convert event round to individual round for handicap calculation
            const courseTees = courseTeesMap[event.course.courseId];
            const tee = courseTees?.tees.find(t => t.name === eventGolfer.teeName);
            
            // Only add to handicap if we have valid course data
            let newIndividualRound: IndividualRound | null = null;
            if (courseTees && tee && holesPlayed >= 14) { // Need at least 14 holes for handicap
              // Calculate course handicap and score differential
              const currentHandicap = eventGolfer.handicapOverride ?? profile.handicapIndex ?? 0;
              const courseHandicap = Math.round(currentHandicap * (tee.slopeRating / 113) + (tee.courseRating - tee.par));
              
              // Build scores array for differential calculation with proper handicap strokes
              const strokeDist = distributeHandicapStrokes(courseHandicap, event.course.courseId);
              const roundScores: HandicapScoreEntry[] = scorecard.scores.map(score => {
                const courseHole = courseMap[event.course.courseId!]?.holes.find(h => h.number === score.hole);
                const par = courseHole?.par || 4;
                const handicapStrokes = strokeDist[score.hole - 1] || 0;
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
              roundScores.forEach(s => {
                const raw = s.strokes || 0;
                const par = s.par;
                const strokesReceived = s.handicapStrokes;
                const maxScore = applyESCAdjustment(raw, par, strokesReceived);
                adjustedGross += maxScore;
              });
              
              const scoreDifferential = calculateScoreDifferential(adjustedGross, tee.courseRating, tee.slopeRating);
              
              newIndividualRound = {
                id: nanoid(8),
                profileId: profile.id,
                date: event.date,
                courseId: event.course.courseId,
                teeName: eventGolfer.teeName || tee.name,
                grossScore: totalScore,
                netScore: totalScore - courseHandicap,
                courseHandicap,
                scoreDifferential,
                courseRating: tee.courseRating,
                slopeRating: tee.slopeRating,
                scores: roundScores,
                createdAt: new Date().toISOString()
              };
            }
            
            set({
              profiles: get().profiles.map(p => 
                p.id === profile.id ? {
                  ...p,
                  individualRounds: newIndividualRound 
                    ? [...(p.individualRounds || []), newIndividualRound]
                    : p.individualRounds,
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
            
            // Calculate handicap if we added a new round
            if (newIndividualRound) {
              // Use setTimeout to ensure the store update above completes first
              setTimeout(() => {
                get().calculateAndUpdateHandicap(profile.id);
              }, 0);
            }
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
        
        return true;
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
