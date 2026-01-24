/**
 * Tournament Slice - Zustand store slice for Tournaments feature
 * Follows existing patterns from eventSlice.ts
 */

import { nanoid } from 'nanoid/non-secure';
import type { 
  Tournament, 
  TournamentRegistration, 
  TournamentDivision,
  TournamentTeeTime,
  TournamentRound,
  TournamentScorecard,
  TournamentStanding,
  TournamentFormat,
  TournamentVisibility,
  TournamentStatus,
  ScoreEntry,
} from '../types';

// ============================================================================
// State Interface
// ============================================================================

export interface TournamentSliceState {
  tournaments: Tournament[];
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface TournamentSliceActions {
  // CRUD
  createTournament: (initialData?: Partial<Tournament>) => string | null;
  updateTournament: (id: string, patch: Partial<Tournament>) => void;
  deleteTournament: (id: string) => void;
  
  // Status management
  publishTournament: (id: string) => boolean;
  startTournament: (id: string) => boolean;
  completeTournament: (id: string) => boolean;
  cancelTournament: (id: string) => boolean;
  
  // Registrations
  registerForTournament: (tournamentId: string, registration: Omit<TournamentRegistration, 'id' | 'tournamentId' | 'createdAt'>) => string | null;
  updateRegistration: (tournamentId: string, registrationId: string, patch: Partial<TournamentRegistration>) => void;
  removeRegistration: (tournamentId: string, registrationId: string) => void;
  removeFromTournament: (tournamentId: string, registrationId: string) => void; // Alias for removeRegistration
  updateRegistrationPaymentStatus: (tournamentId: string, registrationId: string, status: 'paid' | 'pending' | 'refunded') => void;
  
  // Divisions
  addDivision: (tournamentId: string, division: Omit<TournamentDivision, 'id'>) => string | null;
  updateDivision: (tournamentId: string, divisionId: string, patch: Partial<TournamentDivision>) => void;
  removeDivision: (tournamentId: string, divisionId: string) => void;
  
  // Tee Times / Pairings
  addTeeTime: (tournamentId: string, teeTime: Omit<TournamentTeeTime, 'id'>) => string | null;
  updateTeeTime: (tournamentId: string, teeTimeId: string, patch: Partial<TournamentTeeTime>) => void;
  removeTeeTime: (tournamentId: string, teeTimeId: string) => void;
  generatePairings: (tournamentId: string, options?: { groupSize?: number; startTime?: string; interval?: number }) => boolean;
  
  // Scoring
  updateTournamentScore: (tournamentId: string, roundNumber: number, registrationId: string, hole: number, strokes: number | null) => void;
  completeRound: (tournamentId: string, roundNumber: number) => boolean;
  
  // Standings
  recalculateStandings: (tournamentId: string) => void;
  
  // Getters
  getTournament: (id: string) => Tournament | undefined;
  getMyTournaments: (profileId: string) => Tournament[];
  getPublicTournaments: () => Tournament[];
}

// ============================================================================
// Initial State
// ============================================================================

export const initialTournamentState: TournamentSliceState = {
  tournaments: [],
};

// ============================================================================
// Slice Creator
// ============================================================================

type SetState = (partial: Partial<TournamentSliceState> | ((state: any) => Partial<any>)) => void;
type GetState = () => any;

export const createTournamentSlice = (set: SetState, get: GetState): TournamentSliceActions => ({
  // ============================================================================
  // CRUD Operations
  // ============================================================================
  
  createTournament: (initialData?: Partial<Tournament>): string | null => {
    const currentProfile = get().currentProfile;
    if (!currentProfile) return null;
    
    const id = nanoid(8);
    const now = new Date().toISOString();
    
    const newTournament: Tournament = {
      id,
      name: initialData?.name || 'New Tournament',
      organizerId: currentProfile.id,
      courseId: initialData?.courseId,
      courseName: initialData?.courseName,
      dates: initialData?.dates || [new Date().toISOString().split('T')[0]],
      rounds: initialData?.rounds || 1,
      format: initialData?.format || 'stroke',
      visibility: initialData?.visibility || 'public',
      passcode: initialData?.passcode,
      entryFeeCents: initialData?.entryFeeCents || 0,
      maxPlayers: initialData?.maxPlayers || 72,
      status: 'draft',
      divisions: initialData?.divisions || [],
      teeTimes: [],
      registrations: [],
      roundsData: [],
      standings: [],
      hasBettingOverlay: initialData?.hasBettingOverlay || false,
      description: initialData?.description,
      rules: initialData?.rules,
      createdAt: now,
      updatedAt: now,
    };
    
    // Initialize rounds data based on rounds count
    for (let i = 1; i <= newTournament.rounds; i++) {
      newTournament.roundsData.push({
        id: nanoid(8),
        roundNumber: i,
        date: newTournament.dates[i - 1] || newTournament.dates[0],
        courseId: newTournament.courseId,
        courseName: newTournament.courseName,
        scorecards: [],
        isComplete: false,
      });
    }
    
    set({ tournaments: [...get().tournaments, newTournament] });
    return id;
  },
  
  updateTournament: (id: string, patch: Partial<Tournament>): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
      ),
    });
  },
  
  deleteTournament: (id: string): void => {
    set({ tournaments: get().tournaments.filter((t: Tournament) => t.id !== id) });
  },
  
  // ============================================================================
  // Status Management
  // ============================================================================
  
  publishTournament: (id: string): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === id);
    if (!tournament || tournament.status !== 'draft') return false;
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === id ? { ...t, status: 'registration_open' as TournamentStatus, updatedAt: new Date().toISOString() } : t
      ),
    });
    return true;
  },
  
  startTournament: (id: string): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === id);
    if (!tournament || tournament.status !== 'registration_open') return false;
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === id ? { ...t, status: 'in_progress' as TournamentStatus, updatedAt: new Date().toISOString() } : t
      ),
    });
    return true;
  },
  
  completeTournament: (id: string): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === id);
    if (!tournament || tournament.status !== 'in_progress') return false;
    
    // Check all rounds are complete
    const allRoundsComplete = tournament.roundsData.every((r: TournamentRound) => r.isComplete);
    if (!allRoundsComplete) return false;
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === id ? { ...t, status: 'completed' as TournamentStatus, updatedAt: new Date().toISOString() } : t
      ),
    });
    return true;
  },
  
  cancelTournament: (id: string): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === id);
    if (!tournament) return false;
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === id ? { ...t, status: 'cancelled' as TournamentStatus, updatedAt: new Date().toISOString() } : t
      ),
    });
    return true;
  },
  
  // ============================================================================
  // Registrations
  // ============================================================================
  
  registerForTournament: (
    tournamentId: string, 
    registration: Omit<TournamentRegistration, 'id' | 'tournamentId' | 'createdAt'>
  ): string | null => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return null;
    
    // Check max players
    const activeRegistrations = tournament.registrations.filter(
      (r: TournamentRegistration) => r.paymentStatus !== 'refunded'
    );
    if (activeRegistrations.length >= tournament.maxPlayers) {
      // Add to waiting list
      const waitingListPosition = tournament.registrations.filter(
        (r: TournamentRegistration) => r.waitingListPosition != null
      ).length + 1;
      
      const newRegistration: TournamentRegistration = {
        ...registration,
        id: nanoid(8),
        tournamentId,
        waitingListPosition,
        createdAt: new Date().toISOString(),
      };
      
      set({
        tournaments: get().tournaments.map((t: Tournament) =>
          t.id === tournamentId
            ? { ...t, registrations: [...t.registrations, newRegistration], updatedAt: new Date().toISOString() }
            : t
        ),
      });
      return newRegistration.id;
    }
    
    const newRegistration: TournamentRegistration = {
      ...registration,
      id: nanoid(8),
      tournamentId,
      createdAt: new Date().toISOString(),
    };
    
    // Also create scorecards for each round
    const updatedRoundsData = tournament.roundsData.map((round: TournamentRound) => ({
      ...round,
      scorecards: [...round.scorecards, { registrationId: newRegistration.id, scores: [] }],
    }));
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? { 
              ...t, 
              registrations: [...t.registrations, newRegistration],
              roundsData: updatedRoundsData,
              updatedAt: new Date().toISOString() 
            }
          : t
      ),
    });
    return newRegistration.id;
  },
  
  updateRegistration: (tournamentId: string, registrationId: string, patch: Partial<TournamentRegistration>): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              registrations: t.registrations.map((r: TournamentRegistration) =>
                r.id === registrationId ? { ...r, ...patch } : r
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  removeRegistration: (tournamentId: string, registrationId: string): void => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return;
    
    // Remove from registrations and scorecards
    const updatedRoundsData = tournament.roundsData.map((round: TournamentRound) => ({
      ...round,
      scorecards: round.scorecards.filter((sc: TournamentScorecard) => sc.registrationId !== registrationId),
    }));
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              registrations: t.registrations.filter((r: TournamentRegistration) => r.id !== registrationId),
              roundsData: updatedRoundsData,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  // Alias for removeRegistration (used by admin panel)
  removeFromTournament: (tournamentId: string, registrationId: string): void => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return;
    
    const updatedRoundsData = tournament.roundsData.map((round: TournamentRound) => ({
      ...round,
      scorecards: round.scorecards.filter((sc: TournamentScorecard) => sc.registrationId !== registrationId),
    }));
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              registrations: t.registrations.filter((r: TournamentRegistration) => r.id !== registrationId),
              roundsData: updatedRoundsData,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  // Update payment status for a registration
  updateRegistrationPaymentStatus: (
    tournamentId: string, 
    registrationId: string, 
    status: 'paid' | 'pending' | 'refunded'
  ): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              registrations: t.registrations.map((r: TournamentRegistration) =>
                r.id === registrationId ? { ...r, paymentStatus: status } : r
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  // ============================================================================
  // Divisions
  // ============================================================================
  
  addDivision: (tournamentId: string, division: Omit<TournamentDivision, 'id'>): string | null => {
    const id = nanoid(8);
    const newDivision: TournamentDivision = { ...division, id };
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? { ...t, divisions: [...t.divisions, newDivision], updatedAt: new Date().toISOString() }
          : t
      ),
    });
    return id;
  },
  
  updateDivision: (tournamentId: string, divisionId: string, patch: Partial<TournamentDivision>): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              divisions: t.divisions.map((d: TournamentDivision) =>
                d.id === divisionId ? { ...d, ...patch } : d
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  removeDivision: (tournamentId: string, divisionId: string): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              divisions: t.divisions.filter((d: TournamentDivision) => d.id !== divisionId),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  // ============================================================================
  // Tee Times / Pairings
  // ============================================================================
  
  addTeeTime: (tournamentId: string, teeTime: Omit<TournamentTeeTime, 'id'>): string | null => {
    const id = nanoid(8);
    const newTeeTime: TournamentTeeTime = { ...teeTime, id };
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? { ...t, teeTimes: [...t.teeTimes, newTeeTime], updatedAt: new Date().toISOString() }
          : t
      ),
    });
    return id;
  },
  
  updateTeeTime: (tournamentId: string, teeTimeId: string, patch: Partial<TournamentTeeTime>): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              teeTimes: t.teeTimes.map((tt: TournamentTeeTime) =>
                tt.id === teeTimeId ? { ...tt, ...patch } : tt
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  removeTeeTime: (tournamentId: string, teeTimeId: string): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              teeTimes: t.teeTimes.filter((tt: TournamentTeeTime) => tt.id !== teeTimeId),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
  },
  
  generatePairings: (
    tournamentId: string, 
    options?: { groupSize?: number; startTime?: string; interval?: number }
  ): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return false;
    
    const groupSize = options?.groupSize || 4;
    const startTime = options?.startTime || '08:00';
    const interval = options?.interval || 10; // minutes
    
    // Get active registrations (not on waiting list, not refunded)
    const activeRegistrations = tournament.registrations.filter(
      (r: TournamentRegistration) => r.waitingListPosition == null && r.paymentStatus !== 'refunded'
    );
    
    if (activeRegistrations.length === 0) return false;
    
    // Generate tee times for round 1
    const newTeeTimes: TournamentTeeTime[] = [];
    let groupNumber = 1;
    let currentTime = startTime;
    
    for (let i = 0; i < activeRegistrations.length; i += groupSize) {
      const group = activeRegistrations.slice(i, i + groupSize);
      
      newTeeTimes.push({
        id: nanoid(8),
        time: currentTime,
        groupNumber,
        golferIds: group.map((r: TournamentRegistration) => r.id),
        roundNumber: 1,
      });
      
      // Increment time
      const [hours, minutes] = currentTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + interval;
      const newHours = Math.floor(totalMinutes / 60);
      const newMinutes = totalMinutes % 60;
      currentTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
      
      groupNumber++;
    }
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? { ...t, teeTimes: newTeeTimes, updatedAt: new Date().toISOString() }
          : t
      ),
    });
    
    return true;
  },
  
  // ============================================================================
  // Scoring
  // ============================================================================
  
  updateTournamentScore: (
    tournamentId: string, 
    roundNumber: number, 
    registrationId: string, 
    hole: number, 
    strokes: number | null
  ): void => {
    set({
      tournaments: get().tournaments.map((t: Tournament) => {
        if (t.id !== tournamentId) return t;
        
        const updatedRoundsData = t.roundsData.map((round: TournamentRound) => {
          if (round.roundNumber !== roundNumber) return round;
          
          const updatedScorecards = round.scorecards.map((sc: TournamentScorecard) => {
            if (sc.registrationId !== registrationId) return sc;
            
            const existingScoreIndex = sc.scores.findIndex((s: ScoreEntry) => s.hole === hole);
            const newScore: ScoreEntry = { hole, strokes };
            
            let newScores: ScoreEntry[];
            if (existingScoreIndex >= 0) {
              newScores = [...sc.scores];
              newScores[existingScoreIndex] = newScore;
            } else {
              newScores = [...sc.scores, newScore].sort((a, b) => a.hole - b.hole);
            }
            
            return { ...sc, scores: newScores };
          });
          
          return { ...round, scorecards: updatedScorecards };
        });
        
        return { ...t, roundsData: updatedRoundsData, updatedAt: new Date().toISOString() };
      }),
    });
    
    // Recalculate standings after score update
    get().recalculateStandings(tournamentId);
  },
  
  completeRound: (tournamentId: string, roundNumber: number): boolean => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return false;
    
    const round = tournament.roundsData.find((r: TournamentRound) => r.roundNumber === roundNumber);
    if (!round) return false;
    
    // Check all scorecards have 18 scores
    const allComplete = round.scorecards.every((sc: TournamentScorecard) => 
      sc.scores.filter((s: ScoreEntry) => s.strokes != null).length >= 18
    );
    if (!allComplete) return false;
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? {
              ...t,
              roundsData: t.roundsData.map((r: TournamentRound) =>
                r.roundNumber === roundNumber ? { ...r, isComplete: true } : r
              ),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    });
    
    return true;
  },
  
  // ============================================================================
  // Standings
  // ============================================================================
  
  recalculateStandings: (tournamentId: string): void => {
    const tournament = get().tournaments.find((t: Tournament) => t.id === tournamentId);
    if (!tournament) return;
    
    const standings: TournamentStanding[] = [];
    
    // Calculate totals for each registration
    tournament.registrations
      .filter((r: TournamentRegistration) => r.waitingListPosition == null && r.paymentStatus !== 'refunded')
      .forEach((registration: TournamentRegistration) => {
        let grossTotal = 0;
        let netTotal = 0;
        const roundTotals: { roundNumber: number; gross: number; net: number }[] = [];
        let thru = 0;
        
        tournament.roundsData.forEach((round: TournamentRound) => {
          const scorecard = round.scorecards.find(
            (sc: TournamentScorecard) => sc.registrationId === registration.id
          );
          
          if (scorecard) {
            const roundGross = scorecard.scores.reduce(
              (sum: number, s: ScoreEntry) => sum + (s.strokes || 0), 
              0
            );
            // For net, we'd need course handicap calculation - simplified for prototype
            const roundNet = roundGross - (registration.handicapSnapshot || 0);
            
            grossTotal += roundGross;
            netTotal += roundNet;
            
            roundTotals.push({ roundNumber: round.roundNumber, gross: roundGross, net: roundNet });
            
            // Track thru for current/latest incomplete round
            if (!round.isComplete) {
              thru = scorecard.scores.filter((s: ScoreEntry) => s.strokes != null).length;
            }
          }
        });
        
        standings.push({
          registrationId: registration.id,
          position: 0, // Will be calculated below
          isTied: false,
          grossTotal,
          netTotal,
          roundTotals,
          thru,
        });
      });
    
    // Sort by gross total (lower is better for stroke play)
    standings.sort((a, b) => a.grossTotal - b.grossTotal);
    
    // Assign positions with tie handling
    let currentPosition = 1;
    standings.forEach((standing, index) => {
      if (index > 0 && standing.grossTotal === standings[index - 1].grossTotal) {
        standing.position = standings[index - 1].position;
        standing.isTied = true;
        standings[index - 1].isTied = true;
      } else {
        standing.position = currentPosition;
      }
      currentPosition++;
    });
    
    set({
      tournaments: get().tournaments.map((t: Tournament) =>
        t.id === tournamentId
          ? { ...t, standings, updatedAt: new Date().toISOString() }
          : t
      ),
    });
  },
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  getTournament: (id: string): Tournament | undefined => {
    return get().tournaments.find((t: Tournament) => t.id === id);
  },
  
  getMyTournaments: (profileId: string): Tournament[] => {
    return get().tournaments.filter((t: Tournament) => 
      t.organizerId === profileId || 
      t.registrations.some((r: TournamentRegistration) => r.profileId === profileId)
    );
  },
  
  getPublicTournaments: (): Tournament[] => {
    return get().tournaments.filter(
      (t: Tournament) => t.visibility === 'public' && t.status === 'registration_open'
    );
  },
});
