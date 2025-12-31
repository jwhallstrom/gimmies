/**
 * Wallet Slice
 * Handles settlement tracking, transactions, and tip fund management
 */

import { nanoid } from 'nanoid/non-secure';
import type { 
  Settlement, 
  WalletTransaction, 
  TipFund, 
  ProfileWallet,
  EventWalletSettings,
  Event,
  GolferProfile
} from '../types';

// ============================================================================
// State Interface
// ============================================================================

export interface WalletSliceState {
  settlements: Settlement[];
  transactions: WalletTransaction[];
  tipFunds: TipFund[];
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface WalletSliceActions {
  // Settlement management
  createSettlements: (eventId: string) => Settlement[];
  markSettlementPaid: (settlementId: string, method?: 'cash' | 'venmo' | 'zelle' | 'other') => void;
  forgiveSettlement: (settlementId: string) => void;
  
  // Wallet queries
  getProfileWallet: (profileId: string) => ProfileWallet;
  getEventSettlements: (eventId: string) => Settlement[];
  getPendingSettlements: (profileId: string) => { toCollect: Settlement[]; toPay: Settlement[] };
  
  // Tip fund
  getEventTipFund: (eventId: string) => TipFund | undefined;
}

export type WalletSlice = WalletSliceState & WalletSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialWalletState: WalletSliceState = {
  settlements: [],
  transactions: [],
  tipFunds: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Round amount based on settings
 * - 'whole': Round down to nearest dollar
 * - 'half': Round down to nearest 50 cents
 */
function roundAmount(amount: number, mode: 'whole' | 'half'): number {
  if (mode === 'whole') {
    return Math.floor(amount);
  } else {
    return Math.floor(amount * 2) / 2; // Round down to nearest 0.50
  }
}

/**
 * Calculate optimized settlements between players
 * Takes net positions and returns minimum number of transfers
 */
function calculateOptimizedSettlements(
  netPositions: Map<string, number>,
  profiles: GolferProfile[],
  eventId: string,
  eventName: string,
  settings: EventWalletSettings
): { settlements: Settlement[]; tipFundTotal: number } {
  const settlements: Settlement[] = [];
  let tipFundTotal = 0;
  
  // Separate into winners (positive) and losers (negative)
  const winners: { id: string; amount: number }[] = [];
  const losers: { id: string; amount: number }[] = [];
  
  netPositions.forEach((amount, id) => {
    if (amount > 0) {
      winners.push({ id, amount });
    } else if (amount < 0) {
      losers.push({ id, amount: Math.abs(amount) });
    }
  });
  
  // Sort both arrays by amount descending for optimal matching
  winners.sort((a, b) => b.amount - a.amount);
  losers.sort((a, b) => b.amount - a.amount);
  
  // Match losers to winners
  let winnerIdx = 0;
  let loserIdx = 0;
  let winnerRemaining = winners[0]?.amount || 0;
  let loserRemaining = losers[0]?.amount || 0;
  
  while (winnerIdx < winners.length && loserIdx < losers.length) {
    const winner = winners[winnerIdx];
    const loser = losers[loserIdx];
    
    const transferAmount = Math.min(winnerRemaining, loserRemaining);
    
    if (transferAmount >= settings.minimumSettlement) {
      const roundedAmount = settings.tipFundEnabled 
        ? roundAmount(transferAmount, settings.roundingMode)
        : transferAmount;
      
      const tipAmount = settings.tipFundEnabled 
        ? Number((transferAmount - roundedAmount).toFixed(2))
        : 0;
      
      tipFundTotal += tipAmount;
      
      const winnerProfile = profiles.find(p => p.id === winner.id);
      const loserProfile = profiles.find(p => p.id === loser.id);
      
      settlements.push({
        id: nanoid(8),
        eventId,
        eventName,
        date: new Date().toISOString().split('T')[0],
        fromProfileId: loser.id,
        fromName: loserProfile?.name || loser.id,
        toProfileId: winner.id,
        toName: winnerProfile?.name || winner.id,
        calculatedAmount: Number(transferAmount.toFixed(2)),
        roundedAmount: Number(roundedAmount.toFixed(2)),
        tipFundAmount: tipAmount,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    } else if (settings.tipFundEnabled && transferAmount > 0) {
      // Amount below minimum goes to tip fund
      tipFundTotal += transferAmount;
    }
    
    winnerRemaining -= transferAmount;
    loserRemaining -= transferAmount;
    
    if (winnerRemaining <= 0.001) {
      winnerIdx++;
      winnerRemaining = winners[winnerIdx]?.amount || 0;
    }
    if (loserRemaining <= 0.001) {
      loserIdx++;
      loserRemaining = losers[loserIdx]?.amount || 0;
    }
  }
  
  return { settlements, tipFundTotal: Number(tipFundTotal.toFixed(2)) };
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createWalletSlice = (
  set: (fn: (state: any) => any) => void,
  get: () => any
): WalletSliceActions => ({
  
  createSettlements: (eventId: string): Settlement[] => {
    const event: Event = get().completedEvents.find((e: Event) => e.id === eventId) 
      || get().events.find((e: Event) => e.id === eventId);
    
    if (!event) return [];
    
    const settings: EventWalletSettings = event.walletSettings || {
      enabled: true,
      tipFundEnabled: false,
      roundingMode: 'whole',
      minimumSettlement: 1.00,
    };
    
    if (!settings.enabled) return [];
    
    // Get payouts from the payout calculator
    const profiles: GolferProfile[] = get().profiles;
    
    // Import dynamically to avoid circular dependencies
    const { calculateEventPayouts } = require('../../games/payouts');
    const payouts = calculateEventPayouts(event, profiles);
    
    // Build net positions map
    const netPositions = new Map<string, number>();
    
    Object.entries(payouts.totalByGolfer as Record<string, number>).forEach(([golferId, amount]) => {
      netPositions.set(golferId, amount);
    });
    
    // Calculate optimized settlements
    const { settlements, tipFundTotal } = calculateOptimizedSettlements(
      netPositions,
      profiles,
      eventId,
      event.name,
      settings
    );
    
    // Create transactions for each participant
    const transactions: WalletTransaction[] = [];
    event.golfers.forEach(golfer => {
      const golferId = golfer.profileId || golfer.customName || '';
      const netAmount = payouts.totalByGolfer[golferId] || 0;
      
      // Calculate total entry for this golfer
      let totalEntry = 0;
      event.games.nassau.forEach(n => {
        if (n.participantGolferIds?.includes(golferId)) {
          totalEntry += n.fee;
        }
      });
      event.games.skins.forEach(s => {
        if (s.participantGolferIds?.includes(golferId)) {
          totalEntry += s.fee;
        }
      });
      event.games.pinky.forEach(p => {
        if (p.participantGolferIds?.includes(golferId)) {
          totalEntry += p.fee;
        }
      });
      event.games.greenie.forEach(g => {
        if (g.participantGolferIds?.includes(golferId)) {
          totalEntry += g.fee;
        }
      });
      
      transactions.push({
        id: nanoid(8),
        eventId,
        eventName: event.name,
        date: event.date,
        profileId: golferId,
        gameType: 'total',
        description: `${event.name} - Total`,
        entry: totalEntry,
        grossWinnings: totalEntry + netAmount,
        netAmount,
        createdAt: new Date().toISOString(),
      });
    });
    
    // Update state
    set((state: any) => {
      // Remove any existing settlements for this event
      const existingSettlements = state.settlements.filter((s: Settlement) => s.eventId !== eventId);
      const existingTransactions = state.transactions.filter((t: WalletTransaction) => t.eventId !== eventId);
      const existingTipFunds = state.tipFunds.filter((t: TipFund) => t.eventId !== eventId);
      
      const newTipFunds = [...existingTipFunds];
      if (settings.tipFundEnabled && tipFundTotal > 0) {
        newTipFunds.push({
          eventId,
          balance: tipFundTotal,
          contributions: settlements.map(s => ({
            fromSettlementId: s.id,
            amount: s.tipFundAmount,
            date: s.createdAt,
          })).filter(c => c.amount > 0),
        });
      }
      
      return {
        settlements: [...existingSettlements, ...settlements],
        transactions: [...existingTransactions, ...transactions],
        tipFunds: newTipFunds,
      };
    });
    
    return settlements;
  },
  
  markSettlementPaid: (settlementId: string, method?: 'cash' | 'venmo' | 'zelle' | 'other') => {
    set((state: any) => ({
      settlements: state.settlements.map((s: Settlement) => 
        s.id === settlementId 
          ? { ...s, status: 'paid', paidAt: new Date().toISOString(), paidMethod: method }
          : s
      ),
    }));
  },
  
  forgiveSettlement: (settlementId: string) => {
    set((state: any) => ({
      settlements: state.settlements.map((s: Settlement) => 
        s.id === settlementId 
          ? { ...s, status: 'forgiven', paidAt: new Date().toISOString() }
          : s
      ),
    }));
  },
  
  getProfileWallet: (profileId: string): ProfileWallet => {
    const settlements: Settlement[] = get().settlements;
    const transactions: WalletTransaction[] = get().transactions;
    
    // Calculate totals from transactions
    const profileTransactions = transactions.filter(t => t.profileId === profileId);
    const lifetimeNet = profileTransactions.reduce((sum, t) => sum + t.netAmount, 0);
    
    // Current year
    const currentYear = new Date().getFullYear();
    const seasonTransactions = profileTransactions.filter(t => 
      new Date(t.date).getFullYear() === currentYear
    );
    const seasonNet = seasonTransactions.reduce((sum, t) => sum + t.netAmount, 0);
    
    // Pending settlements
    const toCollect = settlements.filter(s => 
      s.toProfileId === profileId && s.status === 'pending'
    );
    const toPay = settlements.filter(s => 
      s.fromProfileId === profileId && s.status === 'pending'
    );
    
    const pendingToCollect = toCollect.reduce((sum, s) => sum + s.roundedAmount, 0);
    const pendingToPay = toPay.reduce((sum, s) => sum + s.roundedAmount, 0);
    
    // Stats
    const amounts = profileTransactions.map(t => t.netAmount);
    const biggestWin = amounts.length > 0 ? Math.max(...amounts, 0) : 0;
    const biggestLoss = amounts.length > 0 ? Math.min(...amounts, 0) : 0;
    
    // Count unique events
    const uniqueEvents = new Set(profileTransactions.map(t => t.eventId));
    
    return {
      profileId,
      lifetimeNet: Number(lifetimeNet.toFixed(2)),
      seasonNet: Number(seasonNet.toFixed(2)),
      pendingToCollect: Number(pendingToCollect.toFixed(2)),
      pendingToPay: Number(pendingToPay.toFixed(2)),
      totalEvents: uniqueEvents.size,
      biggestWin: Number(biggestWin.toFixed(2)),
      biggestLoss: Number(biggestLoss.toFixed(2)),
      lastUpdated: new Date().toISOString(),
    };
  },
  
  getEventSettlements: (eventId: string): Settlement[] => {
    return get().settlements.filter((s: Settlement) => s.eventId === eventId);
  },
  
  getPendingSettlements: (profileId: string) => {
    const settlements: Settlement[] = get().settlements;
    
    return {
      toCollect: settlements.filter(s => 
        s.toProfileId === profileId && s.status === 'pending'
      ),
      toPay: settlements.filter(s => 
        s.fromProfileId === profileId && s.status === 'pending'
      ),
    };
  },
  
  getEventTipFund: (eventId: string): TipFund | undefined => {
    return get().tipFunds.find((t: TipFund) => t.eventId === eventId);
  },
});
