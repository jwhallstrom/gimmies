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

// ============================================================================
// Verified Status System - Gamification to Combat Sandbagging
// ============================================================================

/**
 * Status tier definitions for the verified status system.
 * Users progress through tiers by playing verified rounds with other users.
 */
export interface StatusTier {
  level: number;
  name: string;
  emoji: string;
  minRounds: number;
  maxRounds: number | null; // null = unlimited
  color: string; // Tailwind color class
  badgeColor: string; // Badge background color
  description: string;
  perks: string[];
  isManualOnly?: boolean; // Reserved tiers that cannot be earned via rounds
}

/**
 * Predefined status tiers - professional golf community progression
 */
export const STATUS_TIERS: StatusTier[] = [
  {
    level: 0,
    name: 'Provisional Member',
    emoji: '🏌️',
    minRounds: 0,
    maxRounds: 4,
    color: 'gray',
    badgeColor: 'bg-gray-500',
    description: 'Establishing your record. Play verified events with others to build your standing in the community.',
    perks: []
  },
  {
    level: 1,
    name: 'Club Member',
    emoji: '⭐',
    minRounds: 5,
    maxRounds: 19,
    color: 'green',
    badgeColor: 'bg-green-600',
    description: 'Trusted participant. Your handicap reflects consistent, peer-verified play.',
    perks: ['Basic handicap verification', 'Community standing']
  },
  {
    level: 2,
    name: 'Platinum Contender',
    emoji: '💎',
    minRounds: 20,
    maxRounds: 49,
    color: 'blue',
    badgeColor: 'bg-blue-600',
    description: 'Respected and verified. Integrity backed by real events—trusted in competitive play and wagers.',
    perks: ['Verified handicap badge', 'Trusted for wagers']
  },
  {
    level: 3,
    name: 'Elite Member',
    emoji: '🦅',
    minRounds: 50,
    maxRounds: 99,
    color: 'purple',
    badgeColor: 'bg-purple-600',
    description: 'Proven excellence. High-caliber verification and standing in the Gimmies network.',
    perks: ['Elite badge', 'Network recognition']
  },
  {
    level: 4,
    name: 'Gold Jacket',
    emoji: '🧥',
    minRounds: 100,
    maxRounds: null,
    color: 'amber',
    badgeColor: 'bg-amber-600',
    description: 'Hall of Fame status. Your handicap is ironclad—emblematic of lifelong commitment, excellence, and community respect.',
    perks: ['Gold Jacket badge', 'HOF status', 'Handicap fully verified', 'Lifetime recognition']
  },
  {
    level: 5,
    name: 'Founder',
    emoji: '\u{1F451}',
    minRounds: 0,
    maxRounds: null,
    color: 'slate',
    badgeColor: 'bg-slate-900',
    description: 'Permanent platform architect status. Signed and authenticated by the creators of Gimmies. Reserved and unattainable through play.',
    perks: ['Founder Seal', 'Signed Verification', 'Lifetime Platform Authority'],
    isManualOnly: true
  }
];

/**
 * Verified status data stored on user profile
 */
export interface VerifiedStatus {
  verifiedRounds: number;      // Count of qualified verified events
  statusLevel: number;         // 0-5 matching STATUS_TIERS
  badges: string[];            // Earned badges e.g., ['par_player', 'first_event', 'streak_5']
  lastVerifiedEventId?: string;
  lastVerifiedEventDate?: string;
  weeklyStreak?: number;       // Consecutive weeks with verified play
  totalEventsWithBets?: number; // Events that had wallet activity
}

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
    homeDefaultTab?: 'events' | 'groups';
    homeCourseId?: string;   // canonical id for default behaviors
    homeCourseName?: string; // display name snapshot
    homeCourse?: string;     // legacy free-text (fallback display only)
    favoriteCourseIds?: string[]; // pinned courses for fast selection (local + cloud prefs)
    showVerifiedStatus?: boolean; // Opt-in public status display
  };
  // Verified Status - Gamification system to combat sandbagging
  verifiedStatus?: VerifiedStatus;
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
   * - 'nassau': participates in Nassau only (no Skins/Pinky/Greenie)
   * - 'skins': participates in skins only
   * - 'none': participates in no games (leaderboard/score only)
   */
  gamePreference?: 'all' | 'nassau' | 'skins' | 'none';
  /** Fine-grained per-game opt-in (overrides gamePreference when present) */
  gameOptIn?: Record<string, boolean>; // gameConfigId -> opted in
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
  /** 
   * Scoring type for 2-team Nassau games:
   * - 'stroke': Total strokes (default) - lower total wins
   * - 'match': Match play - count holes won (hole-by-hole competition)
   * Only applicable when teams.length === 2
   */
  scoringType?: 'stroke' | 'match';
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

// ============================================================================
// Stableford - Points-based scoring (auto-calculated from scores)
// ============================================================================

export interface StablefordConfig {
  id: string;
  fee: number;            // Per-player entry fee
  net: boolean;           // Use net scores (handicap-adjusted)
  participantGolferIds?: string[];
  /**
   * Point system:
   * 'standard': Double bogey+=0, Bogey=1, Par=2, Birdie=3, Eagle=4, Albatross=5
   * 'modified': Double bogey+=-3, Bogey=-1, Par=0, Birdie=+2, Eagle=+5, Albatross=+8
   */
  system?: 'standard' | 'modified';
}

// ============================================================================
// 9-Point (Nines / 5-3-1) - Three-player game
// ============================================================================

export interface NinePointConfig {
  id: string;
  fee: number;            // $ per point (e.g., $1/point → max $9/hole)
  net: boolean;           // Use net scores
  participantGolferIds?: string[]; // Must be exactly 3 golfer IDs
  /** If true, winning by 2+ strokes on a hole = all 9 points */
  sweepEnabled?: boolean;
}

// ============================================================================
// Bingo Bango Bongo - 3 points per hole (manual entry)
// ============================================================================

export interface BingoBangoBongoConfig {
  id: string;
  fee: number;            // $ per point
  participantGolferIds?: string[];
}

/** Per-hole results for BBB (manually entered by admin/owner) */
export interface BingoBangoBongoHoleResult {
  hole: number;
  bingo?: string;   // golferId who was first on green
  bango?: string;   // golferId closest to pin when all on green
  bongo?: string;   // golferId first to hole out
}

// ============================================================================
// Wolf - 4-player rotating wolf game
// ============================================================================

export interface WolfConfig {
  id: string;
  fee: number;            // Base point value
  participantGolferIds?: string[]; // Must be exactly 4 golfer IDs
  /** Order of wolf rotation (golfer IDs in tee order) */
  wolfOrder?: string[];
  /** Allow "Blind Wolf" declaration (before anyone tees off) */
  blindWolfEnabled?: boolean;
}

/** Per-hole Wolf result */
export interface WolfHoleResult {
  hole: number;
  wolfId: string;           // Who was wolf this hole
  partnerId?: string;       // Partner chosen (null = Lone Wolf)
  isLoneWolf: boolean;
  isBlindWolf?: boolean;    // Declared before seeing drives
  /** Hole winner: 'wolf' or 'field'. Wolf side = wolf + partner. Field = others. */
  winner: 'wolf' | 'field';
  /** Points won/lost by the wolf side this hole */
  points: number;
}

// ============================================================================
// Dots / Garbage / Junk - Collection of small side bets
// ============================================================================

/** The available dot categories */
export type DotCategory =
  | 'birdie'         // Made a birdie
  | 'eagle'          // Made an eagle
  | 'sandie'         // Up-and-down from bunker
  | 'greenie'        // GIR (green in regulation)
  | 'chipin'         // Chip-in from off the green
  | 'longestdrive'   // Longest drive on designated holes
  | 'closestpin'     // Closest to pin on par 3s
  | 'threejack'      // 3-putt (penalty: negative dot)
  | 'waterball'      // Hit into water (penalty)
  | 'poley'          // 1-putt (holed a long putt)
  | 'natural_birdie' // Birdie without handicap strokes
  | 'par3_birdie';   // Birdie on a par 3

export interface DotsConfig {
  id: string;
  fee: number;            // $ per dot
  participantGolferIds?: string[];
  /** Which dot categories are active for this event */
  activeDots: DotCategory[];
}

/** Per-player accumulated dot totals */
export interface DotsPlayerResult {
  golferId: string;
  dots: Partial<Record<DotCategory, number>>; // Category → count
  totalDots: number; // Net total (positive birdies etc. minus penalty dots)
}

// ============================================================================
// Extended Game Config - All game types
// ============================================================================

export interface EventGameConfig { 
  nassau: NassauConfig[]; 
  skins: SkinsConfig[]; 
  pinky: PinkyConfig[]; 
  greenie: GreenieConfig[];
  // New game types
  stableford?: StablefordConfig[];
  ninePoint?: NinePointConfig[];
  bingoBangoBongo?: BingoBangoBongoConfig[];
  wolf?: WolfConfig[];
  dots?: DotsConfig[];
}

// ============================================================================
// Chat & Notifications
// ============================================================================

// Chat message types
export type ChatMessageType = 'text' | 'image' | 'system' | 'poll' | 'scorecard' | 'invite';

// Golf-themed reaction emojis
export const CHAT_REACTIONS = ['👍', '🔥', '😂', '⛳', '🏌️', '🎯'] as const;
export type ChatReaction = typeof CHAT_REACTIONS[number];

// Poll option for in-chat polls
export interface ChatPollOption {
  id: string;
  text: string;
  votes: string[]; // profileId[]
}

// Event scoped chat message (all new fields optional for backwards compat)
export interface ChatMessage {
  id: string;            // unique id
  profileId: string;     // sender profile id
  senderName?: string;   // sender display name snapshot (for cross-device)
  text: string;          // message body
  createdAt: string;     // ISO timestamp
  
  // Rich message support
  type?: ChatMessageType;           // defaults to 'text'
  replyTo?: string;                 // message id for threaded replies
  reactions?: Record<string, string[]>; // emoji -> profileId[]
  attachments?: ChatAttachment[];   // images, files, etc.
  metadata?: Record<string, any>;   // poll data, invite code, scorecard summary
  editedAt?: string;                // last edit timestamp
  isDeleted?: boolean;              // soft delete
  
  // Poll data (when type === 'poll')
  pollQuestion?: string;
  pollOptions?: ChatPollOption[];
  pollClosed?: boolean;
}

export interface ChatAttachment {
  url: string;
  type: 'image' | 'video' | 'file';
  name?: string;
  thumbnail?: string;
  size?: number;
}

// Chat mute preferences (stored locally)
export interface ChatMuteSettings {
  mutedUntil?: string;   // ISO timestamp, undefined = not muted
  muteType?: 'forever' | '1h' | '8h' | '24h';
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

// ============================================================================
// Group Settings Types
// ============================================================================

export interface GroupSettings {
  /**
   * Who can see this group:
   * - 'public': Anyone can find and see the group
   * - 'private': Only members can see it (default)
   */
  visibility: 'public' | 'private';
  
  /**
   * How people join the group:
   * - 'open': Anyone with link/code can join immediately
   * - 'request': Must request to join, admin approves
   * - 'invite_only': Only admin can add members
   */
  joinPolicy: 'open' | 'request' | 'invite_only';
  
  /**
   * Can regular members share the invite link?
   * - true: All members can share (default for 'open')
   * - false: Only admin can share
   */
  membersCanInvite: boolean;
  
  /**
   * Optional description for public groups
   */
  description?: string;
  
  /**
   * Optional location/region for discovery
   */
  location?: string;
}

export interface JoinRequest {
  id: string;
  profileId: string;
  profileName: string;
  profileAvatar?: string;
  message?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt?: string;
  respondedBy?: string;
}

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
  // New game results
  bbbResults?: Record<string, BingoBangoBongoHoleResult[]>; // bbbConfigId -> per-hole results
  wolfResults?: Record<string, WolfHoleResult[]>;            // wolfConfigId -> per-hole results
  dotsResults?: Record<string, DotsPlayerResult[]>;          // dotsConfigId -> per-player totals
  ownerProfileId: string;
  scorecardView: 'individual' | 'team' | 'admin';
  isPublic: boolean;
  createdAt: string;
  lastModified: string;
  chat: ChatMessage[];
  shareCode?: string;
  isCompleted?: boolean; // Mark event as completed (read-only)
  completedAt?: string; // When the event was completed
  
  /**
   * Event lifecycle status:
   * - 'setup': Admin configuring games, picking teams (users can still enter scores)
   * - 'started': Games locked, event officially in progress
   * - 'completed': Final, all payouts approved (legacy: isCompleted = true)
   */
  status?: 'setup' | 'started' | 'completed';
  
  // Wallet settings for this event
  walletSettings?: EventWalletSettings;
  
  // Group-specific settings (only for hubType === 'group')
  groupSettings?: GroupSettings;
  
  // Join requests for groups with joinPolicy === 'request'
  joinRequests?: JoinRequest[];
  
  // Event settings (notifications, auto-recap, etc.)
  settings?: {
    /** If true, don't auto-post recap to chat when event completes */
    disableAutoRecap?: boolean;
  };
  
  // Verified Status System
  /**
   * Whether this event counts as a "verified round" for status progression.
   * Auto-set to true if: ≥2 players, app-scored (not manual add), all players verified.
   */
  isVerifiedRound?: boolean;
  /**
   * Reason why the event wasn't verified (for user transparency)
   */
  verificationNote?: string;
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
  gameType: 'nassau' | 'skins' | 'pinky' | 'greenie' | 'stableford' | 'ninePoint' | 'bingoBangoBongo' | 'wolf' | 'dots' | 'total';
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
// Organization/Club Types (Business Accounts)
// ============================================================================

export type ClubType = 'golf_course' | 'country_club' | 'municipal' | 'resort' | 'driving_range' | 'golf_league' | 'other';
export type ClubMemberRole = 'owner' | 'admin' | 'manager' | 'staff' | 'pro';
export type ClubVerificationStatus = 'pending' | 'verified' | 'rejected';
export type StripeConnectStatus = 'not_started' | 'pending' | 'active' | 'restricted' | 'disabled';

/**
 * Organization/Club - Business account for golf courses, clubs, leagues
 * Enables: tournament hosting, entry fee collection, prize payouts
 */
export interface Club {
  id: string;
  
  // Basic Info
  name: string;
  type: ClubType;
  description?: string;
  logo?: string; // base64 or URL
  coverImage?: string;
  
  // Contact & Location
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  phone?: string;
  email: string;
  website?: string;
  
  // Linked Course (if applicable)
  linkedCourseId?: string;
  linkedCourseName?: string;
  
  // Verification
  verificationStatus: ClubVerificationStatus;
  verifiedAt?: string;
  verificationNotes?: string;
  
  // Stripe Connect Integration
  stripe: {
    connectStatus: StripeConnectStatus;
    accountId?: string; // Stripe Connect account ID
    onboardingComplete: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    defaultCurrency: string; // 'usd'
    // Platform fee settings
    platformFeePercent: number; // e.g., 2.5 for 2.5%
  };
  
  // Settings
  settings: {
    allowPublicTournaments: boolean;
    defaultEntryFeeEnabled: boolean;
    defaultTipFundEnabled: boolean;
    autoApproveRegistrations: boolean;
    requireHandicapVerification: boolean;
    maxPlayersPerTournament: number;
    // Branding
    primaryColor?: string;
    secondaryColor?: string;
  };
  
  // Stats
  stats: {
    totalTournaments: number;
    totalPlayers: number;
    totalRevenue: number; // in cents
    activeTournaments: number;
  };
  
  // Ownership
  ownerProfileId: string; // Primary owner's profile
  
  // Email List (auto-built from registrations)
  emailList?: ClubEmailContact[];
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Club Email Contact - Auto-built from tournament registrations
 */
export interface ClubEmailContact {
  email: string;
  name: string;
  phone?: string;
  source: string;          // e.g. "Spring Open 2026"
  tags: string[];          // e.g. ["member", "charity-event", "blue-tee"]
  marketingConsent: boolean;
  addedAt: string;
  lastEventDate?: string;
}

/**
 * Tournament Sponsor - for branded event pages
 */
export interface TournamentSponsor {
  id: string;
  name: string;
  logoUrl: string;         // base64 or URL
  websiteUrl?: string;
  holeNumber?: number;     // Hole sponsorship assignment
  tier?: 'title' | 'gold' | 'silver' | 'hole';
}

/**
 * Club Member - Staff/admin within an organization
 */
export interface ClubMember {
  id: string;
  clubId: string;
  profileId: string;
  profileName: string;
  profileAvatar?: string;
  role: ClubMemberRole;
  permissions: ClubPermissions;
  invitedBy?: string;
  invitedAt: string;
  acceptedAt?: string;
  status: 'invited' | 'active' | 'suspended' | 'removed';
}

/**
 * Granular permissions for club staff
 */
export interface ClubPermissions {
  canCreateTournaments: boolean;
  canEditTournaments: boolean;
  canDeleteTournaments: boolean;
  canManageRegistrations: boolean;
  canProcessPayments: boolean;
  canViewFinancials: boolean;
  canManageStaff: boolean;
  canEditClubSettings: boolean;
  canSendAnnouncements: boolean;
}

/**
 * Club Invite - For inviting staff to join a club
 */
export interface ClubInvite {
  id: string;
  clubId: string;
  clubName: string;
  email: string;
  role: ClubMemberRole;
  permissions: ClubPermissions;
  invitedBy: string;
  inviteCode: string;
  expiresAt: string;
  acceptedAt?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
}

/**
 * Tournament Entry Payment - Track payments for tournament registrations
 */
export interface TournamentPayment {
  id: string;
  tournamentId: string;
  registrationId: string;
  profileId?: string;
  
  // Payment details
  amountCents: number;
  platformFeeCents: number;
  clubReceivesCents: number;
  currency: string;
  
  // Stripe
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  
  // Status
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
  failureReason?: string;
  
  // Refund info
  refundedAmountCents?: number;
  refundedAt?: string;
  refundReason?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Tournament Payout - Prize money distribution
 */
export interface TournamentPayout {
  id: string;
  tournamentId: string;
  clubId: string;
  
  // Recipient
  registrationId: string;
  profileId?: string;
  recipientName: string;
  
  // Amount
  grossAmountCents: number; // Before any fees
  netAmountCents: number;   // After platform fee
  
  // Category
  payoutType: 'prize' | 'skins' | 'greenie' | 'closest_to_pin' | 'other';
  position?: number; // 1st, 2nd, 3rd, etc.
  divisionId?: string;
  description: string;
  
  // Distribution method
  method: 'stripe_transfer' | 'check' | 'cash' | 'credit_to_account';
  stripeTransferId?: string;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: string;
  failureReason?: string;
  
  createdAt: string;
}

/**
 * Default permissions by role
 */
export const DEFAULT_CLUB_PERMISSIONS: Record<ClubMemberRole, ClubPermissions> = {
  owner: {
    canCreateTournaments: true,
    canEditTournaments: true,
    canDeleteTournaments: true,
    canManageRegistrations: true,
    canProcessPayments: true,
    canViewFinancials: true,
    canManageStaff: true,
    canEditClubSettings: true,
    canSendAnnouncements: true,
  },
  admin: {
    canCreateTournaments: true,
    canEditTournaments: true,
    canDeleteTournaments: true,
    canManageRegistrations: true,
    canProcessPayments: true,
    canViewFinancials: true,
    canManageStaff: true,
    canEditClubSettings: true,
    canSendAnnouncements: true,
  },
  manager: {
    canCreateTournaments: true,
    canEditTournaments: true,
    canDeleteTournaments: false,
    canManageRegistrations: true,
    canProcessPayments: false,
    canViewFinancials: true,
    canManageStaff: false,
    canEditClubSettings: false,
    canSendAnnouncements: true,
  },
  staff: {
    canCreateTournaments: false,
    canEditTournaments: true,
    canDeleteTournaments: false,
    canManageRegistrations: true,
    canProcessPayments: false,
    canViewFinancials: false,
    canManageStaff: false,
    canEditClubSettings: false,
    canSendAnnouncements: false,
  },
  pro: {
    canCreateTournaments: true,
    canEditTournaments: true,
    canDeleteTournaments: false,
    canManageRegistrations: true,
    canProcessPayments: false,
    canViewFinancials: false,
    canManageStaff: false,
    canEditClubSettings: false,
    canSendAnnouncements: true,
  },
};

// ============================================================================
// Tournament Types (Extended for Club Integration)
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
  email?: string;               // Captured at registration
  phone?: string;               // Captured at registration
  handicapSnapshot?: number | null;
  divisionId?: string;
  teamId?: string;
  gamePreference?: 'all' | 'nassau' | 'skins' | 'none';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  waitingListPosition?: number;
  marketingConsent?: boolean;    // Opted in to club email list
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
  organizerId: string;          // ownerProfileId (individual) or clubId (business)
  
  // Club Integration (for business-hosted tournaments)
  clubId?: string;              // If hosted by a club
  clubName?: string;            // Snapshot of club name
  isClubHosted: boolean;        // true if managed by a club account
  
  courseId?: string;
  courseName?: string;
  dates: string[];              // ISO date strings for multi-day events
  rounds: number;               // Number of rounds (e.g., 1 or 2)
  format: TournamentFormat;
  visibility: TournamentVisibility;
  passcode?: string;            // For invite_only
  
  // Entry Fee & Payments
  entryFeeCents: number;        // Entry fee in cents
  entryFeeEnabled: boolean;     // Whether payment is required
  earlyBirdFeeCents?: number;   // Discounted early registration
  earlyBirdDeadline?: string;   // ISO date for early bird cutoff
  
  // Prize Pool
  prizePool: {
    totalCents: number;         // Total prize pool
    distribution: {
      position: number;
      percentOrFixed: 'percent' | 'fixed';
      value: number;            // Percentage (0-100) or cents
      divisionId?: string;      // Division-specific prize
    }[];
    sidePots: {
      name: string;             // e.g., "Skins", "Closest to Pin"
      amountCents: number;
    }[];
  };
  
  // Registration
  maxPlayers: number;
  waitlistEnabled: boolean;
  registrationDeadline?: string;
  
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
  
  // Contact info for participants
  contactEmail?: string;
  contactPhone?: string;
  
  // Branding
  bannerImage?: string;
  sponsorLogos?: string[];
  sponsors?: TournamentSponsor[];
  
  createdAt: string;
  updatedAt: string;
}
