// Individual Round Types for Handicap Tracking
export interface IndividualRound {
  id: string;
  profileId: string;
  courseId: string;
  teeName: string;
  date: string; // ISO string
  scores: ScoreEntry[];
  grossScore: number;
  netScore: number;
  scoreDifferential: number;
  courseRating: number;
  slopeRating: number;
  courseHandicap: number;
  /**
   * Optional convenience field for UI/debug. Can be derived from scores via ESC/net-double-bogey.
   * Not required for handicap scoring and may not exist on older rounds.
   */
  adjustedGrossScore?: number;
  eventId?: string; // Optional - if this round came from a completed event
  completedRoundId?: string; // Optional - links to CompletedRound if created from event
  createdAt: string;
}

export interface ScoreEntry {
  hole: number;
  par: number;
  strokes: number | null;
  handicapStrokes: number; // strokes received on this hole
  netStrokes?: number; // calculated net score
  /**
   * WHS adjusted strokes for the hole (net double bogey cap).
   * If missing, it can be computed from strokes/par/handicapStrokes.
   */
  adjustedStrokes?: number;
}

export interface HandicapHistory {
  date: string;
  handicapIndex: number;
  rounds: IndividualRound[];
  usedRoundIds?: string[]; // ids of rounds used in this WHS calculation
  source: 'calculation' | 'manual'; // WHS calculation or manual entry
}

// World Handicap System calculation result
export interface WHSCalculation {
  handicapIndex: number;
  differentials: number[];
  roundsUsed: number;
  usedRoundIds?: string[];
  calculationDate: string;
}

// Combined round for display (events + individual)
export interface CombinedRound {
  id: string;
  type: 'event' | 'individual';
  date: string;
  courseName: string;
  teeName: string;
  grossScore: number;
  netScore: number;
  scoreDifferential?: number;
  eventName?: string; // for event rounds
  eventId?: string; // for event rounds - link to source event
  scores: ScoreEntry[];
  completedRoundId?: string; // Optional - links to CompletedRound if created from event
}