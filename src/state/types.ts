/**
 * Domain types for Gimmies Golf
 * Extracted from store.ts for better organization and reusability
 */

import { IndividualRound, HandicapHistory, CombinedRound, ScoreEntry as HandicapScoreEntry } from '../types/handicap';

// Re-export handicap types for convenience
export type { IndividualRound, HandicapHistory, CombinedRound, HandicapScoreEntry };

// ============================================================================
// Domain Models
// ============================================================================

export interface HoleDef { 
  number: number; 
  par: number; 
  strokeIndex?: number; 
}

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
    // Stored inside preferencesJson in cloud (no schema change required)
    homeCourseId?: string;   // canonical id for default behaviors
    homeCourseName?: string; // display name snapshot
    homeCourse?: string;     // legacy free-text (fallback display only)
    favoriteCourseIds?: string[]; // pinned courses for fast selection (local + cloud prefs)
  };
  createdAt: string;
  lastActive: string;
}

// Golfer in event context (references profile or custom name)
export interface EventGolfer {
  profileId?: string; // references GolferProfile.id (optional for custom names)
  customName?: string; // custom name for casual players without profiles
  displayName?: string; // Snapshot of name at join time (for cross-device visibility)
  handicapSnapshot?: number | null; // Snapshot of handicap at join time
  teeName?: string; // event-specific tee override
  handicapOverride?: number | null; // event-specific handicap override
  /**
   * Participation preference for bets/games.
   * - 'all': participates in all configured games
   * - 'skins': participates in skins only
   * - 'none': participates in no games (leaderboard/score only)
   */
  gamePreference?: 'all' | 'skins' | 'none';
}

// ============================================================================
// Event & Group Types
// ============================================================================

export interface Group { 
  id: string; 
  golferIds: string[]; 
  teeTime?: string; 
}

export interface EventCourseSelection { 
  courseId?: string; 
  teeName?: string; 
}

export interface ScoreEntry { 
  hole: number; 
  strokes: number | null; 
}

export interface PlayerScorecard { 
  golferId: string; 
  scores: ScoreEntry[]; 
}

// ============================================================================
// Game Configuration Types
// ============================================================================

export interface NassauTeam { 
  id: string; 
  name: string; 
  golferIds: string[]; 
}

export interface NassauConfig { 
  id: string; 
  groupId: string; 
  /**
   * Legacy single-fee field (historically ambiguous).
   * If `fees` is not provided, UI + payout logic treat this as a per-segment fee
   * for Front/Back/Total (i.e., 5 means 5/5/5).
   */
  fee: number;
  /**
   * Per-segment fees (per player): Out (front 9), In (back 9), Total (18).
   * Example: { out: 5, in: 5, total: 10 }.
   */
  fees?: { out: number; in: number; total: number };
  net: boolean; 
  pressesOff?: boolean; 
  teams?: NassauTeam[]; 
  teamBestCount?: number; 
  participantGolferIds?: string[];
  /** If true, golfers can join a team themselves (UI enforcement TBD). */
  allowGolferTeamSelect?: boolean;
}

export interface SkinsConfig { 
  id: string; 
  fee: number; 
  net: boolean; 
  carryovers?: boolean;
  participantGolferIds?: string[]; 
}

export interface PinkyConfig { 
  id: string; 
  fee: number; 
  participantGolferIds?: string[]; 
}

export interface PinkyResult { 
  golferId: string; 
  count: number; 
}

export interface GreenieConfig { 
  id: string; 
  fee: number; 
  participantGolferIds?: string[]; 
}

export interface GreenieResult { 
  golferId: string; 
  count: number; 
}

export interface EventGameConfig { 
  nassau: NassauConfig[]; 
  skins: SkinsConfig[]; 
  pinky: PinkyConfig[]; 
  greenie: GreenieConfig[]; 
}

// ============================================================================
// Chat & Notifications
// ============================================================================

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

// ============================================================================
// Event Interface
// ============================================================================

export interface Event {
  id: string;
  /**
   * Distinguish long-lived chat crews ("groups") from actual rounds ("events").
   * - 'event': a playable round with scoring/games
   * - 'group': a chat crew hub that can spawn events later
   */
  hubType?: 'event' | 'group';
  /** When an event is created from a group, link it here (future). */
  parentGroupId?: string;
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
  
  // Wallet settings for this event
  walletSettings?: EventWalletSettings;
}

// ============================================================================
// Completed Round (Analytics & History)
// ============================================================================

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

// ============================================================================
// Wallet & Settlement Types
// ============================================================================

// Event-level wallet settings
export interface EventWalletSettings {
  enabled: boolean;
  tipFundEnabled: boolean;
  roundingMode: 'whole' | 'half'; // Round to $1.00 or $0.50
  minimumSettlement: number; // $0.50 or $1.00 - below this, roll into tip fund
}

// Individual transaction in the ledger
export interface WalletTransaction {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  profileId: string;
  
  // What happened
  gameType: 'nassau' | 'skins' | 'pinky' | 'greenie' | 'total';
  description: string;
  
  // Money flow
  entry: number;           // What was paid to play (positive)
  grossWinnings: number;   // What was won from pot (positive)
  netAmount: number;       // grossWinnings - entry (can be negative)
  
  createdAt: string;
}

// Settlement between two players
export interface Settlement {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  
  // Who owes whom
  fromProfileId: string;
  fromName: string;
  toProfileId: string;
  toName: string;
  
  // Amounts
  calculatedAmount: number;  // Exact calculated amount
  roundedAmount: number;     // After rounding rules applied
  tipFundAmount: number;     // What went to tip fund (calculatedAmount - roundedAmount)
  
  // Status
  status: 'pending' | 'paid' | 'forgiven';
  paidAt?: string;
  paidMethod?: 'cash' | 'venmo' | 'zelle' | 'other';
  notes?: string;
  
  createdAt: string;
}

// Tip fund for an event
export interface TipFund {
  eventId: string;
  balance: number;
  contributions: {
    fromSettlementId: string;
    amount: number;
    date: string;
  }[];
}

// Profile wallet summary
export interface ProfileWallet {
  profileId: string;
  
  // Running totals
  lifetimeNet: number;       // All-time net winnings/losses
  seasonNet: number;         // Current year net
  
  // Pending settlements
  pendingToCollect: number;  // Others owe you
  pendingToPay: number;      // You owe others
  
  // Stats
  totalEvents: number;
  biggestWin: number;
  biggestLoss: number;
  
  lastUpdated: string;
}

// ============================================================================
// Tournament Types (Prototype Feature)
// ============================================================================

export type TournamentFormat = 'stroke' | 'stableford' | 'scramble' | 'best_ball' | 'match_play' | 'skins';
export type TournamentVisibility = 'public' | 'private' | 'invite_only';
export type TournamentStatus = 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';

export interface TournamentDivision {
  id: string;
  name: string;
  handicapMin?: number;
  handicapMax?: number;
  gender?: 'men' | 'women' | 'mixed';
}

export interface TournamentTeeTime {
  id: string;
  time: string; // HH:MM format
  groupNumber: number;
  golferIds: string[]; // TournamentRegistration ids
  roundNumber: number;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  profileId?: string;           // null for guest
  guestName?: string;           // For non-registered players
  displayName?: string;         // Snapshot of name at join time
  handicapSnapshot?: number | null;
  divisionId?: string;
  teamId?: string;
  gamePreference?: 'all' | 'skins' | 'none';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  waitingListPosition?: number;
  createdAt: string;
}

export interface TournamentRound {
  id: string;
  roundNumber: number;
  date: string;
  courseId?: string;
  courseName?: string;
  teeName?: string;
  scorecards: TournamentScorecard[];
  isComplete: boolean;
}

export interface TournamentScorecard {
  registrationId: string; // Links to TournamentRegistration
  scores: ScoreEntry[];
  grossTotal?: number;
  netTotal?: number;
}

export interface TournamentStanding {
  registrationId: string;
  position: number;
  isTied: boolean;
  grossTotal: number;
  netTotal: number;
  roundTotals: { roundNumber: number; gross: number; net: number }[];
  thru: number; // holes completed in current round
}

export interface Tournament {
  id: string;
  name: string;
  organizerId: string;          // ownerProfileId
  courseId?: string;
  courseName?: string;
  dates: string[];              // ISO date strings for multi-day events
  rounds: number;               // Number of rounds (e.g., 1 or 2)
  format: TournamentFormat;
  visibility: TournamentVisibility;
  passcode?: string;            // For invite_only
  entryFeeCents: number;        // Entry fee in cents
  maxPlayers: number;
  status: TournamentStatus;
  divisions: TournamentDivision[];
  teeTimes: TournamentTeeTime[];
  registrations: TournamentRegistration[];
  roundsData: TournamentRound[];
  standings: TournamentStanding[];
  hasBettingOverlay: boolean;   // Optional Gimmies games
  bettingGames?: EventGameConfig; // Reuse existing game config
  description?: string;
  rules?: string;
  createdAt: string;
  updatedAt: string;
}
