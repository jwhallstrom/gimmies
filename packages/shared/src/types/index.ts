/**
 * Shared Type Definitions
 * Types used across all Gimmies apps
 */

// ============================================================================
// Core Profile Types
// ============================================================================

export interface GolferProfile {
  id: string;
  userId?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  handicapIndex?: number;
  preferredTee?: string;
  preferences?: ProfilePreferences;
  stats?: ProfileStats;
  verifiedStatus?: VerifiedStatus;
  individualRounds?: IndividualRound[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfilePreferences {
  theme?: 'light' | 'dark' | 'auto';
  notifications?: boolean;
  defaultScorecardView?: 'individual' | 'team' | 'admin';
}

export interface ProfileStats {
  roundsPlayed: number;
  averageScore?: number;
  bestScore?: number;
  averageDifferential?: number;
}

export interface VerifiedStatus {
  level: number;
  verifiedRounds: number;
  lastVerifiedAt?: string;
}

// ============================================================================
// Individual Round (Handicap Tracking)
// ============================================================================

export interface IndividualRound {
  id: string;
  profileId: string;
  date: string;
  courseId: string;
  courseName?: string;
  teeName: string;
  grossScore: number;
  netScore?: number;
  courseHandicap?: number;
  scoreDifferential?: number;
  courseRating?: number;
  slopeRating?: number;
  holesPlayed?: number;
  eventId?: string;
  completedRoundId?: string;
  scores?: { hole: number; strokes: number | null }[];
  createdAt: string;
}

// ============================================================================
// Tournament Types
// ============================================================================

export type TournamentFormat = 'stroke' | 'match' | 'stableford' | 'bestball' | 'scramble';
export type TournamentVisibility = 'public' | 'private' | 'unlisted';
export type TournamentStatus = 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  name: string;
  organizerId: string;
  
  // Club Integration
  clubId?: string;
  clubName?: string;
  isClubHosted: boolean;
  
  courseId?: string;
  courseName?: string;
  dates: string[];
  rounds: number;
  format: TournamentFormat;
  visibility: TournamentVisibility;
  passcode?: string;
  
  // Entry Fee & Payments
  entryFeeCents: number;
  entryFeeEnabled: boolean;
  earlyBirdFeeCents?: number;
  earlyBirdDeadline?: string;
  
  // Prize Pool
  prizePool: {
    totalCents: number;
    distribution: {
      position: number;
      percentOrFixed: 'percent' | 'fixed';
      value: number;
      divisionId?: string;
    }[];
    sidePots: {
      name: string;
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
  hasBettingOverlay: boolean;
  bettingGames?: any; // EventGameConfig
  description?: string;
  rules?: string;
  
  contactEmail?: string;
  contactPhone?: string;
  bannerImage?: string;
  sponsorLogos?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface TournamentDivision {
  id: string;
  name: string;
  description?: string;
  handicapMin?: number;
  handicapMax?: number;
  ageMin?: number;
  ageMax?: number;
  gender?: 'male' | 'female' | 'any';
}

export interface TournamentTeeTime {
  id: string;
  time: string;
  groupNumber: number;
  golferIds: string[];
  roundNumber: number;
}

export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  profileId: string;
  profileName: string;
  handicapSnapshot?: number;
  divisionId?: string;
  teePreference?: string;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentAmount?: number;
  paymentMethod?: string;
  waitingListPosition?: number;
  createdAt: string;
}

export interface TournamentRound {
  id: string;
  roundNumber: number;
  date: string;
  courseId?: string;
  courseName?: string;
  scorecards: TournamentScorecard[];
  isComplete: boolean;
}

export interface TournamentScorecard {
  registrationId: string;
  scores: { hole: number; strokes: number | null }[];
}

export interface TournamentStanding {
  registrationId: string;
  position: number;
  isTied: boolean;
  grossTotal: number;
  netTotal: number;
  roundTotals: { roundNumber: number; gross: number; net: number }[];
  thru: number;
}

// ============================================================================
// Club/Organization Types
// ============================================================================

export interface Club {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  defaultCourseId?: string;
  ownerId: string;
  memberCount: number;
  isPublic: boolean;
  joinPolicy: 'open' | 'approval' | 'invite_only';
  createdAt: string;
  updatedAt: string;
}

export interface ClubMember {
  id: string;
  clubId: string;
  profileId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  handicapAtJoin?: number;
}

// ============================================================================
// Settlement Types
// ============================================================================

export interface Settlement {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  fromProfileId: string;
  fromName: string;
  toProfileId: string;
  toName: string;
  calculatedAmount: number;
  roundedAmount: number;
  tipFundAmount: number;
  status: 'pending' | 'paid' | 'forgiven';
  paidAt?: string;
  paidMethod?: 'cash' | 'venmo' | 'zelle' | 'other';
  notes?: string;
  createdAt: string;
}
