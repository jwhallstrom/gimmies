/**
 * Gimmies Golf Store
 * Composed from domain slices for better organization
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import { nanoid } from 'nanoid/non-secure';
import { getCourseById, getHole } from '../data/cloudCourses';
import { distributeHandicapStrokes, applyESCAdjustment, calculateScoreDifferential } from '../utils/handicap';
import { calculateEventPayouts } from '../games/payouts';
import { ScoreEntry as HandicapScoreEntry } from '../types/handicap';

// Import types from centralized types file
import type {
  HoleDef, User, GolferProfile, EventGolfer, Group,
  NassauTeam, NassauConfig, SkinsConfig, PinkyConfig, PinkyResult,
  GreenieConfig, GreenieResult, ScoreEntry, PlayerScorecard,
  EventGameConfig, EventCourseSelection, ChatMessage, Toast,
  Event, CompletedRound, IndividualRound, HandicapHistory, CombinedRound,
  EventWalletSettings, WalletTransaction, Settlement, TipFund, ProfileWallet,
  Tournament, TournamentRegistration, TournamentDivision, TournamentTeeTime,
  TournamentRound, TournamentScorecard, TournamentStanding,
} from './types';

// Re-export all types for backward compatibility
export type {
  HoleDef, User, GolferProfile, EventGolfer, Group,
  NassauTeam, NassauConfig, SkinsConfig, PinkyConfig, PinkyResult,
  GreenieConfig, GreenieResult, ScoreEntry, PlayerScorecard,
  EventGameConfig, EventCourseSelection, ChatMessage, Toast,
  Event, CompletedRound, IndividualRound, HandicapHistory, CombinedRound,
  EventWalletSettings, WalletTransaction, Settlement, TipFund, ProfileWallet,
  Tournament, TournamentRegistration, TournamentDivision, TournamentTeeTime,
  TournamentRound, TournamentScorecard, TournamentStanding,
};

// Import slice creators
import { createUserSlice, initialUserState, type UserSliceActions } from './slices/userSlice';
import { createEventSlice, initialEventState, type EventSliceActions } from './slices/eventSlice';
import { createGameSlice, type GameSliceActions } from './slices/gameSlice';
import { createHandicapSlice, type HandicapSliceActions } from './slices/handicapSlice';
import { createUISlice, initialUIState, type UISliceActions } from './slices/uiSlice';
import { createWalletSlice, initialWalletState, type WalletSliceActions } from './slices/walletSlice';
import { createTournamentSlice, initialTournamentState, type TournamentSliceActions } from './slices/tournamentSlice';

// ============================================================================
// Combined State Interface
// ============================================================================

interface State {
  // User slice state
  currentUser: User | null;
  users: User[];
  currentProfile: GolferProfile | null;
  profiles: GolferProfile[];
  
  // Event slice state
  events: Event[];
  completedEvents: Event[];
  completedRounds: CompletedRound[];
  isLoadingEventsFromCloud: boolean;
  
  // UI slice state
  toasts: Toast[];
  
  // Wallet slice state
  settlements: Settlement[];
  transactions: WalletTransaction[];
  tipFunds: TipFund[];
  
  // Tournament slice state (prototype)
  tournaments: Tournament[];
  
  // All actions from slices
  // User actions
  createUser: UserSliceActions['createUser'];
  switchUser: UserSliceActions['switchUser'];
  logout: UserSliceActions['logout'];
  deleteUser: UserSliceActions['deleteUser'];
  createProfile: UserSliceActions['createProfile'];
  updateProfile: UserSliceActions['updateProfile'];
  setCurrentProfile: UserSliceActions['setCurrentProfile'];
  deleteProfile: UserSliceActions['deleteProfile'];
  cleanupDuplicateProfiles: UserSliceActions['cleanupDuplicateProfiles'];
  exportProfile: UserSliceActions['exportProfile'];
  importProfile: UserSliceActions['importProfile'];
  
  // Event actions
  createEvent: EventSliceActions['createEvent'];
  setEventCourse: EventSliceActions['setEventCourse'];
  setEventTee: EventSliceActions['setEventTee'];
  updateEvent: EventSliceActions['updateEvent'];
  deleteEvent: EventSliceActions['deleteEvent'];
  refreshEventFromCloud: EventSliceActions['refreshEventFromCloud'];
  importData: EventSliceActions['importData'];
  exportData: EventSliceActions['exportData'];
  addGolferToEvent: EventSliceActions['addGolferToEvent'];
  updateEventGolfer: EventSliceActions['updateEventGolfer'];
  removeGolferFromEvent: EventSliceActions['removeGolferFromEvent'];
  addGroup: EventSliceActions['addGroup'];
  assignGolferToGroup: EventSliceActions['assignGolferToGroup'];
  moveGolferToGroup: EventSliceActions['moveGolferToGroup'];
  setGroupTeeTime: EventSliceActions['setGroupTeeTime'];
  removeGroup: EventSliceActions['removeGroup'];
  updateScore: EventSliceActions['updateScore'];
  canEditScore: EventSliceActions['canEditScore'];
  setScorecardView: EventSliceActions['setScorecardView'];
  generateShareCode: EventSliceActions['generateShareCode'];
  joinEventByCode: EventSliceActions['joinEventByCode'];
  addChatMessage: EventSliceActions['addChatMessage'];
  clearChat: EventSliceActions['clearChat'];
  
  // Complex event actions (kept in store)
  loadEventsFromCloud: () => Promise<void>;
  completeEvent: (eventId: string) => boolean;
  
  // Game actions
  removeNassau: GameSliceActions['removeNassau'];
  removeSkins: GameSliceActions['removeSkins'];
  removePinky: GameSliceActions['removePinky'];
  setPinkyResults: GameSliceActions['setPinkyResults'];
  removeGreenie: GameSliceActions['removeGreenie'];
  setGreenieResults: GameSliceActions['setGreenieResults'];
  
  // Handicap actions
  addIndividualRound: HandicapSliceActions['addIndividualRound'];
  getProfileRounds: HandicapSliceActions['getProfileRounds'];
  calculateAndUpdateHandicap: HandicapSliceActions['calculateAndUpdateHandicap'];
  recalculateAllDifferentials: HandicapSliceActions['recalculateAllDifferentials'];
  deleteIndividualRound: HandicapSliceActions['deleteIndividualRound'];
  
  // UI actions
  addToast: UISliceActions['addToast'];
  removeToast: UISliceActions['removeToast'];
  
  // Wallet actions
  createSettlements: WalletSliceActions['createSettlements'];
  markSettlementPaid: WalletSliceActions['markSettlementPaid'];
  forgiveSettlement: WalletSliceActions['forgiveSettlement'];
  getProfileWallet: WalletSliceActions['getProfileWallet'];
  getEventSettlements: WalletSliceActions['getEventSettlements'];
  getPendingSettlements: WalletSliceActions['getPendingSettlements'];
  getEventTipFund: WalletSliceActions['getEventTipFund'];
  
  // Tournament actions (prototype)
  createTournament: TournamentSliceActions['createTournament'];
  updateTournament: TournamentSliceActions['updateTournament'];
  deleteTournament: TournamentSliceActions['deleteTournament'];
  publishTournament: TournamentSliceActions['publishTournament'];
  startTournament: TournamentSliceActions['startTournament'];
  completeTournament: TournamentSliceActions['completeTournament'];
  cancelTournament: TournamentSliceActions['cancelTournament'];
  registerForTournament: TournamentSliceActions['registerForTournament'];
  updateRegistration: TournamentSliceActions['updateRegistration'];
  removeRegistration: TournamentSliceActions['removeRegistration'];
  removeFromTournament: TournamentSliceActions['removeFromTournament'];
  updateRegistrationPaymentStatus: TournamentSliceActions['updateRegistrationPaymentStatus'];
  addDivision: TournamentSliceActions['addDivision'];
  updateDivision: TournamentSliceActions['updateDivision'];
  removeDivision: TournamentSliceActions['removeDivision'];
  addTeeTime: TournamentSliceActions['addTeeTime'];
  updateTeeTime: TournamentSliceActions['updateTeeTime'];
  removeTeeTime: TournamentSliceActions['removeTeeTime'];
  generatePairings: TournamentSliceActions['generatePairings'];
  updateTournamentScore: TournamentSliceActions['updateTournamentScore'];
  completeRound: TournamentSliceActions['completeRound'];
  recalculateStandings: TournamentSliceActions['recalculateStandings'];
  getTournament: TournamentSliceActions['getTournament'];
  getMyTournaments: TournamentSliceActions['getMyTournaments'];
  getPublicTournaments: TournamentSliceActions['getPublicTournaments'];
}

// ============================================================================
// Store Creation
// ============================================================================

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialUserState,
      ...initialEventState,
      ...initialUIState,
      ...initialWalletState,
      ...initialTournamentState,
      
      // Compose slice actions
      ...createUserSlice(set, get),
      ...createEventSlice(set, get),
      ...createGameSlice(set, get),
      ...createHandicapSlice(set, get),
      ...createUISlice(set, get),
      ...createWalletSlice(set, get),
      ...createTournamentSlice(set, get),
      
      // Override complex functions that need full store access
      loadEventsFromCloud: async () => {
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') return;
        if (get().isLoadingEventsFromCloud) return;
        
        const currentProfile = get().currentProfile;
        if (!currentProfile) return;
        
        try {
          set({ isLoadingEventsFromCloud: true });
          const { loadUserEventsFromCloud, loadChatMessagesFromCloud } = await import('../utils/eventSync');
          
          const cloudEvents = await loadUserEventsFromCloud();
          const myEvents = cloudEvents.filter(event => 
            event.golfers.some(g => g.profileId === currentProfile.id)
          );
          
          for (const event of myEvents) {
            event.chat = await loadChatMessagesFromCloud(event.id);
          }
          
          const activeEvents = myEvents.filter(e => !e.isCompleted);
          const completedEvents = myEvents.filter(e => e.isCompleted);
          
          const newCompletedRoundsFromCloud: CompletedRound[] = [];
          const newIndividualRoundsFromCloud: IndividualRound[] = [];
          
          // Process completed events
          completedEvents.forEach(event => {
            const eventGolfer = event.golfers.find(g => g.profileId === currentProfile.id);
            const scorecard = event.scorecards.find(sc => sc.golferId === currentProfile.id);
            if (!eventGolfer || !scorecard) return;
            
            const existingCompletedRound = get().completedRounds.find(
              r => r.eventId === event.id && r.golferId === currentProfile.id
            );
            const effectiveTeeName = eventGolfer.teeName || event.course.teeName || currentProfile.preferredTee;
            const existingIndividualRound = currentProfile.individualRounds?.find(
              r => r.date === event.date && r.courseId === event.course.courseId && r.teeName === effectiveTeeName
            );
            
            let totalScore = 0, totalPar = 0, holesPlayed = 0;
            const holeScores: any[] = [];
            const stats = { birdies: 0, eagles: 0, pars: 0, bogeys: 0, doubleBogeys: 0, triplesOrWorse: 0 };
            
            scorecard.scores.forEach((score: any) => {
              if (score.strokes != null) {
                const holeData = getHole(event.course.courseId, score.hole, event.course.teeName);
                const holePar = holeData?.par || 4;
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
            
            let completedRoundForLinking: CompletedRound | undefined;
            if (!existingCompletedRound) {
              const completedRound: CompletedRound = {
                id: nanoid(8), eventId: event.id, eventName: event.name, datePlayed: event.date,
                courseId: event.course.courseId,
                courseName: event.course.courseId ? (getCourseById(event.course.courseId)?.name || 'Unknown Course') : 'Custom Course',
                teeName: eventGolfer.teeName, golferId: currentProfile.id, golferName: currentProfile.name,
                handicapIndex: eventGolfer.handicapOverride ?? currentProfile.handicapIndex,
                finalScore: totalScore, scoreToPar: totalScore - totalPar, holesPlayed, holeScores,
                gameResults: {}, stats, createdAt: new Date().toISOString()
              };
              completedRoundForLinking = completedRound;
              newCompletedRoundsFromCloud.push(completedRound);
            } else {
              completedRoundForLinking = existingCompletedRound;
            }
            
            if (!existingIndividualRound && event.course.courseId && holesPlayed >= 14) {
              const course = getCourseById(event.course.courseId);
              let tee = course?.tees.find((t: any) => t.name === eventGolfer.teeName) 
                     || course?.tees.find((t: any) => t.name === event.course.teeName)
                     || course?.tees.find((t: any) => t.name === currentProfile.preferredTee)
                     || course?.tees[Math.floor((course?.tees.length || 0) / 2)];
              
              if (course && tee) {
                const currentHandicap = eventGolfer.handicapOverride ?? currentProfile.handicapIndex ?? 0;
                const cr = (tee.courseRating ?? 72) as number;
                const sl = (tee.slopeRating ?? 113) as number;
                const courseHandicap = Math.round(currentHandicap * (sl / 113) + (cr - tee.par));
                const strokeDist = distributeHandicapStrokes(courseHandicap, event.course.courseId, tee.name);
                
                const roundScores = scorecard.scores.map((score: any) => {
                  const courseHole = getHole(event.course.courseId!, score.hole, tee?.name);
                  const par = courseHole?.par || 4;
                  const handicapStrokes = strokeDist[score.hole] || 0;
                  const strokes = score.strokes || 0;
                  return {
                    hole: score.hole,
                    par,
                    strokes,
                    handicapStrokes,
                    netStrokes: strokes - handicapStrokes,
                    adjustedStrokes: applyESCAdjustment(strokes, par, handicapStrokes),
                  };
                });
                
                let adjustedGross = 0;
                roundScores.forEach((s: any) => { adjustedGross += applyESCAdjustment(s.strokes, s.par, s.handicapStrokes); });
                const scoreDifferential = calculateScoreDifferential(adjustedGross, cr, sl);
                
                const individualRound: IndividualRound = {
                  id: nanoid(8), profileId: currentProfile.id, date: event.date, courseId: event.course.courseId,
                  teeName: tee.name, grossScore: totalScore, netScore: totalScore - courseHandicap, courseHandicap,
                  scoreDifferential, courseRating: cr, slopeRating: sl, scores: roundScores,
                  adjustedGrossScore: adjustedGross,
                  eventId: event.id, completedRoundId: completedRoundForLinking?.id, createdAt: new Date().toISOString()
                };
                newIndividualRoundsFromCloud.push(individualRound);
              }
            }
          });
          
          const localEventIds = new Set(get().events.map(e => e.id));
          const localCompletedEventIds = new Set(get().completedEvents.map(e => e.id));
          const newActiveEvents = activeEvents.filter(e => !localEventIds.has(e.id));
          const newCompletedEventsToAdd = completedEvents.filter(e => !localCompletedEventIds.has(e.id));
          const completedEventIds = new Set(completedEvents.map(e => e.id));
          const cleanedActiveEvents = get().events.filter(e => !completedEventIds.has(e.id));
          
          if (newActiveEvents.length > 0 || newCompletedEventsToAdd.length > 0 || cleanedActiveEvents.length !== get().events.length || newCompletedRoundsFromCloud.length > 0 || newIndividualRoundsFromCloud.length > 0) {
            set({
              events: [...cleanedActiveEvents, ...newActiveEvents],
              completedEvents: [...get().completedEvents, ...newCompletedEventsToAdd],
              completedRounds: [...get().completedRounds, ...newCompletedRoundsFromCloud],
              profiles: get().profiles.map(p => {
                if (p.id === currentProfile.id) {
                  const existingRounds = p.individualRounds || [];
                  const roundsToAdd = newIndividualRoundsFromCloud.filter(newRound => 
                    !existingRounds.some(existing => existing.id === newRound.id || 
                      (existing.date === newRound.date && existing.courseId === newRound.courseId && 
                       existing.teeName === newRound.teeName && existing.grossScore === newRound.grossScore))
                  );
                  return { ...p, individualRounds: [...existingRounds, ...roundsToAdd] };
                }
                return p;
              })
            });
            
            if (newIndividualRoundsFromCloud.length > 0) {
              const existingRounds = currentProfile.individualRounds || [];
              const roundsToAdd = newIndividualRoundsFromCloud.filter(newRound => 
                !existingRounds.some(existing => existing.id === newRound.id || 
                  (existing.date === newRound.date && existing.courseId === newRound.courseId && 
                   existing.teeName === newRound.teeName && existing.grossScore === newRound.grossScore))
              );
              if (roundsToAdd.length > 0) {
                import('../utils/roundSync').then(({ batchSaveIndividualRoundsToCloud }) => {
                  batchSaveIndividualRoundsToCloud(roundsToAdd).catch(console.error);
                });
              }
              setTimeout(() => get().calculateAndUpdateHandicap(currentProfile.id), 0);
            }
          }
          
          // Load CompletedRounds from cloud
          try {
            const { loadCompletedRoundsFromCloud } = await import('../utils/completedRoundSync');
            const cloudCompletedRounds = await loadCompletedRoundsFromCloud(currentProfile.id);
            const existingCompletedRounds = get().completedRounds;
            const roundsToAdd = cloudCompletedRounds.filter(newRound => 
              !existingCompletedRounds.some(existing => existing.eventId === newRound.eventId && existing.golferId === newRound.golferId)
            );
            if (roundsToAdd.length > 0) {
              set({ completedRounds: [...existingCompletedRounds, ...roundsToAdd] });
            }
          } catch (error) {
            console.error('Failed to load CompletedRounds from cloud:', error);
          }
        } catch (error) {
          console.error('loadEventsFromCloud error:', error);
        } finally {
          set({ isLoadingEventsFromCloud: false });
        }
      },
      
      completeEvent: (eventId: string): boolean => {
        const event = get().events.find(e => e.id === eventId);
        if (!event || event.isCompleted) return false;
        if (get().completedEvents.some(e => e.id === eventId)) return false;
        if (!event.scorecards.every(sc => sc.scores.every(s => s.strokes != null))) return false;
        
        const payouts = calculateEventPayouts(event, get().profiles);
        const newCompletedRounds: CompletedRound[] = [];
        
        event.golfers.forEach(eventGolfer => {
          const golferId = eventGolfer.profileId || eventGolfer.customName;
          if (!golferId) return;
          
          const profile = eventGolfer.profileId ? get().profiles.find(p => p.id === eventGolfer.profileId) : null;
          const golferName = profile ? profile.name : eventGolfer.customName || 'Unknown';
          const scorecard = event.scorecards.find(sc => sc.golferId === golferId);
          if (!scorecard) return;
          
          let totalScore = 0, totalPar = 0, holesPlayed = 0;
          const holeScores: { hole: number; strokes: number; par: number; toPar: number }[] = [];
          const stats = { birdies: 0, eagles: 0, pars: 0, bogeys: 0, doubleBogeys: 0, triplesOrWorse: 0 };
          
          scorecard.scores.forEach(score => {
            if (score.strokes != null) {
              const holeData = getHole(event.course.courseId, score.hole, event.course.teeName);
              const holePar = holeData?.par || 4;
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
          
          const gameResults: CompletedRound['gameResults'] = {};
          const nassauWinnings = payouts.nassau.reduce((t: number, n: any) => t + (n.winningsByGolfer[golferId] || 0), 0);
          if (nassauWinnings !== 0) gameResults.nassau = { winnings: nassauWinnings, position: 1 };
          const skinsWinnings = payouts.skins.reduce((t: number, s: any) => t + (s?.winningsByGolfer[golferId] || 0), 0);
          if (skinsWinnings !== 0) gameResults.skins = { winnings: skinsWinnings, skinsWon: 0 };
          
          const completedRound: CompletedRound = {
            id: nanoid(8), eventId: event.id, eventName: event.name, datePlayed: event.date,
            courseId: event.course.courseId,
            courseName: event.course.courseId ? (getCourseById(event.course.courseId)?.name || 'Unknown Course') : 'Custom Course',
            teeName: eventGolfer.teeName, golferId, golferName,
            handicapIndex: eventGolfer.handicapOverride ?? profile?.handicapIndex,
            finalScore: totalScore, scoreToPar: totalScore - totalPar, holesPlayed, holeScores,
            gameResults, stats, createdAt: new Date().toISOString()
          };
          newCompletedRounds.push(completedRound);
          
          if (profile) {
            const roundsPlayed = profile.stats.roundsPlayed + 1;
            set({
              profiles: get().profiles.map(p => p.id === profile.id ? {
                ...p, stats: { ...p.stats, roundsPlayed,
                  averageScore: ((p.stats.averageScore * p.stats.roundsPlayed) + totalScore) / roundsPlayed,
                  bestScore: Math.min(p.stats.bestScore || totalScore, totalScore),
                  totalBirdies: p.stats.totalBirdies + stats.birdies,
                  totalEagles: p.stats.totalEagles + stats.eagles
                }, lastActive: new Date().toISOString()
              } : p)
            });
          }
        });
        
        const completedAt = new Date().toISOString();
        const completedEvent = { ...event, isCompleted: true, completedAt, lastModified: completedAt };
        
        set({
          completedRounds: [...get().completedRounds, ...newCompletedRounds],
          events: get().events.filter(e => e.id !== eventId),
          completedEvents: [...get().completedEvents, completedEvent]
        });
        
        // Create IndividualRounds for handicap + cloud
        const newIndividualRounds: IndividualRound[] = [];
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && event.course.courseId) {
          newCompletedRounds.forEach(completedRound => {
            const eventGolfer = event.golfers.find(g => g.profileId === completedRound.golferId);
            if (!eventGolfer?.profileId) return;
            
            const course = getCourseById(event.course.courseId!);
            const tee = course?.tees.find(t => t.name === completedRound.teeName);
            
            if (tee && completedRound.holesPlayed >= 14) {
              const currentHandicap = completedRound.handicapIndex || 0;
              const cr = (tee.courseRating ?? 72) as number;
              const sl = (tee.slopeRating ?? 113) as number;
              const courseHandicap = Math.round(currentHandicap * (sl / 113) + (cr - tee.par));
              const strokeDist = distributeHandicapStrokes(courseHandicap, event.course.courseId!, tee.name);
              
              const roundScores: HandicapScoreEntry[] = completedRound.holeScores.map(h => {
                const handicapStrokes = strokeDist[h.hole] || 0;
                const strokes = h.strokes;
                return {
                  hole: h.hole,
                  par: h.par,
                  strokes,
                  handicapStrokes,
                  netStrokes: strokes - handicapStrokes,
                  adjustedStrokes: applyESCAdjustment(strokes ?? 0, h.par, handicapStrokes),
                };
              });
              
              let adjustedGross = 0;
              roundScores.forEach(s => { adjustedGross += applyESCAdjustment(s.strokes ?? 0, s.par, s.handicapStrokes || 0); });
              
              const individualRound: IndividualRound = {
                id: nanoid(8), profileId: eventGolfer.profileId, date: event.date,
                courseId: event.course.courseId!, teeName: completedRound.teeName || tee.name,
                grossScore: completedRound.finalScore, netScore: completedRound.finalScore - courseHandicap,
                courseHandicap, scoreDifferential: calculateScoreDifferential(adjustedGross, cr, sl),
                courseRating: cr, slopeRating: sl, scores: roundScores,
                adjustedGrossScore: adjustedGross,
                eventId: event.id, completedRoundId: completedRound.id, createdAt: new Date().toISOString()
              };

              newIndividualRounds.push(individualRound);
              
              import('../utils/roundSync').then(({ saveIndividualRoundToCloud }) => {
                saveIndividualRoundToCloud(individualRound).catch(console.error);
              });
            }
          });
        }

        // Add event-derived IndividualRounds locally so Handicap updates immediately.
        // Use conservative de-dupe so cloud re-load doesn't create duplicates.
        if (newIndividualRounds.length > 0) {
          const roundsByProfileId = new Map<string, IndividualRound[]>();
          newIndividualRounds.forEach(r => {
            const list = roundsByProfileId.get(r.profileId) || [];
            list.push(r);
            roundsByProfileId.set(r.profileId, list);
          });

          set((state: any) => {
            const updatedProfiles = state.profiles.map((p: any) => {
              const toAdd = roundsByProfileId.get(p.id);
              if (!toAdd || toAdd.length === 0) return p;

              const existing = p.individualRounds || [];
              const filteredToAdd = toAdd.filter((nr: IndividualRound) =>
                !existing.some((er: IndividualRound) =>
                  er.id === nr.id ||
                  (er.completedRoundId && nr.completedRoundId && er.completedRoundId === nr.completedRoundId) ||
                  (er.date === nr.date && er.courseId === nr.courseId && er.teeName === nr.teeName && er.grossScore === nr.grossScore)
                )
              );

              if (filteredToAdd.length === 0) return p;
              return { ...p, individualRounds: [...existing, ...filteredToAdd] };
            });

            const updatedCurrentProfile = state.currentProfile
              ? updatedProfiles.find((p: any) => p.id === state.currentProfile.id) || state.currentProfile
              : state.currentProfile;

            return { profiles: updatedProfiles, currentProfile: updatedCurrentProfile };
          });

          // Recompute handicap for affected profiles.
          setTimeout(() => {
            roundsByProfileId.forEach((_rounds, profileId) => {
              try {
                get().calculateAndUpdateHandicap(profileId);
              } catch (e) {
                console.error('Failed to recalculate handicap after completeEvent:', e);
              }
            });
          }, 0);
        }
        
        // Sync to cloud
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && newCompletedRounds.length > 0) {
          import('../utils/completedRoundSync').then(({ batchSaveCompletedRoundsToCloud }) => {
            batchSaveCompletedRoundsToCloud(newCompletedRounds).catch(console.error);
          });
        }
        
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
          const currentProfile = get().currentProfile;
          if (currentProfile) {
            import('../utils/eventSync').then(({ saveEventToCloud }) => {
              saveEventToCloud(completedEvent, currentProfile.id).catch(console.error);
            });
          }
        }
        
        return true;
      },
    }),
    {
      name: 'gimmies-store',
      version: 4,
      storage: createJSONStorage(() => idbStorage),
      migrate: (state: any, _version: number) => {
        if (!state) return state;
        
        // Migrate old event formats
        if (state.events && Array.isArray(state.events)) {
          state.events = state.events.map((e: any) => {
            if (!e.games) e.games = { nassau: [], skins: [], pinky: [], greenie: [] };
            if (!e.ownerProfileId) e.ownerProfileId = e.golfers[0]?.profileId || 'unknown';
            if (!e.isPublic) e.isPublic = false;
            if (!e.scorecardView) e.scorecardView = 'individual';
            if (!e.createdAt) e.createdAt = new Date().toISOString();
            if (!e.lastModified) e.lastModified = new Date().toISOString();
            if (!e.chat) e.chat = [];
            
            let skinsVal = e.games.skins;
            if (skinsVal == null) skinsVal = [];
            else if (!Array.isArray(skinsVal)) skinsVal = skinsVal.id ? [skinsVal] : [];
            
            let pinkyVal = e.games.pinky;
            if (!Array.isArray(pinkyVal)) pinkyVal = [];
            
            let greenieVal = e.games.greenie;
            if (!Array.isArray(greenieVal)) greenieVal = [];
            
            return { ...e, games: { nassau: Array.isArray(e.games.nassau) ? e.games.nassau : [], skins: skinsVal, pinky: pinkyVal, greenie: greenieVal } };
          });
        }
        
        if (!state.currentProfile && state.profiles?.length > 0) {
          state.currentProfile = state.profiles[0];
        }
        
        if (!state.users) state.users = [];
        if (!state.currentUser && state.users.length === 0) {
          const defaultUser: User = {
            id: 'default-user', username: 'default', displayName: 'Default User',
            createdAt: new Date().toISOString(), lastActive: new Date().toISOString()
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
