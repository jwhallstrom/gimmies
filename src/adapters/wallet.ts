import { useMemo } from 'react';
import useStore from '../state/store';
import type { GolferProfile, ProfileWallet, Settlement, WalletTransaction } from '../state/types';

export function useWalletAdapter() {
  const currentProfile = useStore((s) => s.currentProfile) as GolferProfile | null;
  const profiles = useStore((s) => s.profiles) as GolferProfile[];

  const getProfileWallet = useStore((s) => s.getProfileWallet) as (profileId: string) => ProfileWallet;
  const getPendingSettlements = useStore(
    (s) => s.getPendingSettlements
  ) as (profileId: string) => { toCollect: Settlement[]; toPay: Settlement[] };

  const transactions = useStore((s) => s.transactions) as WalletTransaction[];
  const markSettlementPaid = useStore((s) => s.markSettlementPaid) as (
    settlementId: string,
    method: 'cash' | 'venmo' | 'zelle' | 'other'
  ) => void;
  const forgiveSettlement = useStore((s) => s.forgiveSettlement) as (settlementId: string) => void;
  const addToast = useStore((s) => s.addToast) as (message: string, type: any, duration?: number) => void;

  const wallet = useMemo(() => {
    if (!currentProfile) return null;
    return getProfileWallet(currentProfile.id);
  }, [currentProfile, getProfileWallet]);

  const pendingSettlements = useMemo(() => {
    if (!currentProfile) return { toCollect: [], toPay: [] };
    return getPendingSettlements(currentProfile.id);
  }, [currentProfile, getPendingSettlements]);

  const myTransactions = useMemo(() => {
    if (!currentProfile) return [];
    return transactions
      .filter((t) => t.profileId === currentProfile.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentProfile]);

  return {
    currentProfile,
    profiles,
    wallet,
    pendingSettlements,
    myTransactions,
    markSettlementPaid,
    forgiveSettlement,
    addToast,
  };
}

