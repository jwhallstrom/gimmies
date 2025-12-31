/**
 * Wallet Tests
 * Tests for settlement calculation, wallet tracking, and tip fund management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../src/state/store';

describe('Wallet Slice', () => {
  beforeEach(() => {
    useStore.setState({
      currentUser: null,
      users: [],
      currentProfile: null,
      profiles: [],
      events: [],
      completedEvents: [],
      completedRounds: [],
      isLoadingEventsFromCloud: false,
      toasts: [],
      settlements: [],
      transactions: [],
      tipFunds: [],
    });
  });

  describe('Profile Wallet', () => {
    it('should return empty wallet for new profile', () => {
      const state = useStore.getState();
      const wallet = state.getProfileWallet('test-profile');
      
      expect(wallet.profileId).toBe('test-profile');
      expect(wallet.lifetimeNet).toBe(0);
      expect(wallet.seasonNet).toBe(0);
      expect(wallet.pendingToCollect).toBe(0);
      expect(wallet.pendingToPay).toBe(0);
      expect(wallet.totalEvents).toBe(0);
    });

    it('should accumulate transactions for wallet stats', () => {
      // Manually add transactions for testing
      useStore.setState({
        transactions: [
          {
            id: 'tx1',
            eventId: 'event1',
            eventName: 'Golf Day 1',
            date: new Date().toISOString().split('T')[0],
            profileId: 'player1',
            gameType: 'total',
            description: 'Golf Day 1 - Total',
            entry: 20,
            grossWinnings: 35,
            netAmount: 15,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'tx2',
            eventId: 'event2',
            eventName: 'Golf Day 2',
            date: new Date().toISOString().split('T')[0],
            profileId: 'player1',
            gameType: 'total',
            description: 'Golf Day 2 - Total',
            entry: 20,
            grossWinnings: 10,
            netAmount: -10,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      const wallet = state.getProfileWallet('player1');
      
      expect(wallet.lifetimeNet).toBe(5); // 15 - 10
      expect(wallet.seasonNet).toBe(5);
      expect(wallet.totalEvents).toBe(2);
      expect(wallet.biggestWin).toBe(15);
      expect(wallet.biggestLoss).toBe(-10);
    });
  });

  describe('Settlements', () => {
    it('should track pending settlements to pay', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'loser1',
            fromName: 'Loser 1',
            toProfileId: 'winner1',
            toName: 'Winner 1',
            calculatedAmount: 10,
            roundedAmount: 10,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      const pending = state.getPendingSettlements('loser1');
      
      expect(pending.toPay).toHaveLength(1);
      expect(pending.toCollect).toHaveLength(0);
      expect(pending.toPay[0].roundedAmount).toBe(10);
    });

    it('should track pending settlements to collect', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'loser1',
            fromName: 'Loser 1',
            toProfileId: 'winner1',
            toName: 'Winner 1',
            calculatedAmount: 10,
            roundedAmount: 10,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      const pending = state.getPendingSettlements('winner1');
      
      expect(pending.toCollect).toHaveLength(1);
      expect(pending.toPay).toHaveLength(0);
      expect(pending.toCollect[0].roundedAmount).toBe(10);
    });

    it('should mark settlement as paid', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'loser1',
            fromName: 'Loser 1',
            toProfileId: 'winner1',
            toName: 'Winner 1',
            calculatedAmount: 10,
            roundedAmount: 10,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      useStore.getState().markSettlementPaid('settle1', 'venmo');
      
      const settlements = useStore.getState().settlements;
      expect(settlements[0].status).toBe('paid');
      expect(settlements[0].paidMethod).toBe('venmo');
      expect(settlements[0].paidAt).toBeDefined();
    });

    it('should forgive settlement', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'loser1',
            fromName: 'Loser 1',
            toProfileId: 'winner1',
            toName: 'Winner 1',
            calculatedAmount: 10,
            roundedAmount: 10,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      useStore.getState().forgiveSettlement('settle1');
      
      const settlements = useStore.getState().settlements;
      expect(settlements[0].status).toBe('forgiven');
    });

    it('should get event settlements', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day 1',
            date: '2025-01-01',
            fromProfileId: 'loser1',
            fromName: 'Loser 1',
            toProfileId: 'winner1',
            toName: 'Winner 1',
            calculatedAmount: 10,
            roundedAmount: 10,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'settle2',
            eventId: 'event2',
            eventName: 'Golf Day 2',
            date: '2025-01-02',
            fromProfileId: 'loser2',
            fromName: 'Loser 2',
            toProfileId: 'winner2',
            toName: 'Winner 2',
            calculatedAmount: 15,
            roundedAmount: 15,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      const eventSettlements = state.getEventSettlements('event1');
      
      expect(eventSettlements).toHaveLength(1);
      expect(eventSettlements[0].id).toBe('settle1');
    });
  });

  describe('Tip Fund', () => {
    it('should get event tip fund', () => {
      useStore.setState({
        tipFunds: [
          {
            eventId: 'event1',
            balance: 3.50,
            contributions: [
              { fromSettlementId: 'settle1', amount: 0.50, date: new Date().toISOString() },
              { fromSettlementId: 'settle2', amount: 3.00, date: new Date().toISOString() },
            ],
          },
        ],
      });

      const state = useStore.getState();
      const tipFund = state.getEventTipFund('event1');
      
      expect(tipFund).toBeDefined();
      expect(tipFund!.balance).toBe(3.50);
      expect(tipFund!.contributions).toHaveLength(2);
    });

    it('should return undefined for non-existent tip fund', () => {
      const state = useStore.getState();
      const tipFund = state.getEventTipFund('non-existent');
      
      expect(tipFund).toBeUndefined();
    });
  });

  describe('Wallet Calculations', () => {
    it('should update pending amounts in wallet', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'player1',
            fromName: 'Player 1',
            toProfileId: 'player2',
            toName: 'Player 2',
            calculatedAmount: 20,
            roundedAmount: 20,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'settle2',
            eventId: 'event2',
            eventName: 'Golf Day 2',
            date: '2025-01-02',
            fromProfileId: 'player1',
            fromName: 'Player 1',
            toProfileId: 'player3',
            toName: 'Player 3',
            calculatedAmount: 15,
            roundedAmount: 15,
            tipFundAmount: 0,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      
      // Player1 owes money to player2 and player3
      const player1Wallet = state.getProfileWallet('player1');
      expect(player1Wallet.pendingToPay).toBe(35); // 20 + 15
      expect(player1Wallet.pendingToCollect).toBe(0);
      
      // Player2 is owed money by player1
      const player2Wallet = state.getProfileWallet('player2');
      expect(player2Wallet.pendingToCollect).toBe(20);
      expect(player2Wallet.pendingToPay).toBe(0);
    });

    it('should not count paid settlements in pending amounts', () => {
      useStore.setState({
        settlements: [
          {
            id: 'settle1',
            eventId: 'event1',
            eventName: 'Golf Day',
            date: '2025-01-01',
            fromProfileId: 'player1',
            fromName: 'Player 1',
            toProfileId: 'player2',
            toName: 'Player 2',
            calculatedAmount: 20,
            roundedAmount: 20,
            tipFundAmount: 0,
            status: 'paid',
            paidAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const state = useStore.getState();
      const player1Wallet = state.getProfileWallet('player1');
      
      expect(player1Wallet.pendingToPay).toBe(0);
    });
  });
});
