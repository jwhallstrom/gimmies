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
  fee: number; 
  net: boolean; 
  pressesOff?: boolean; 
  teams?: NassauTeam[]; 
  teamBestCount?: number; 
  participantGolferIds?: string[]; 
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
