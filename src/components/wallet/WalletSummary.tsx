import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../../state/store';
import SettlementCard from './SettlementCard';

const WalletSummary: React.FC = () => {
  const { 
    currentProfile, 
    profiles,
    getProfileWallet, 
    getPendingSettlements, 
    transactions,
    markSettlementPaid,
    forgiveSettlement,
    addToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

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
      .filter(t => t.profileId === currentProfile.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentProfile]);

  const formatCurrency = (amount: number, showSign = false) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
    
    if (showSign && amount !== 0) {
      return amount >= 0 ? `+${formatted}` : `-${formatted}`;
    }
    return formatted;
  };

  const handleMarkPaid = (settlementId: string, method: 'cash' | 'venmo' | 'zelle' | 'other') => {
    markSettlementPaid(settlementId, method);
    addToast(`Settlement marked as paid via ${method}`, 'success');
  };

  const handleForgive = (settlementId: string) => {
    forgiveSettlement(settlementId);
    addToast('Settlement forgiven', 'info');
  };

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please create a profile to view your wallet.</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading wallet...</p>
      </div>
    );
  }

  const totalPending = pendingSettlements.toCollect.length + pendingSettlements.toPay.length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-800 to-primary-900 p-6 text-white">
          <h1 className="text-xl font-bold mb-1">💰 My Wallet</h1>
          <p className="text-white/70 text-sm">{currentProfile.name}</p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          <div className="bg-white p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Season Net</p>
            <p className={`text-2xl font-bold ${
              wallet.seasonNet >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(wallet.seasonNet, true)}
            </p>
          </div>
          <div className="bg-white p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lifetime Net</p>
            <p className={`text-2xl font-bold ${
              wallet.lifetimeNet >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(wallet.lifetimeNet, true)}
            </p>
          </div>
          <div className="bg-white p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">To Collect</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(wallet.pendingToCollect)}
            </p>
          </div>
          <div className="bg-white p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">To Pay</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(wallet.pendingToPay)}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 bg-gray-50 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{wallet.totalEvents}</p>
            <p className="text-xs text-gray-500">Events</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {wallet.biggestWin > 0 ? formatCurrency(wallet.biggestWin) : '-'}
            </p>
            <p className="text-xs text-gray-500">Best Day</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {wallet.biggestLoss < 0 ? formatCurrency(wallet.biggestLoss) : '-'}
            </p>
            <p className="text-xs text-gray-500">Worst Day</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'pending'
                ? 'text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending
            {totalPending > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {totalPending}
              </span>
            )}
            {activeTab === 'pending' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            History
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'pending' && (
            <div className="space-y-6">
              {/* To Collect */}
              {pendingSettlements.toCollect.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    To Collect ({pendingSettlements.toCollect.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingSettlements.toCollect.map(settlement => (
                      <SettlementCard
                        key={settlement.id}
                        settlement={settlement}
                        isOwedToMe={true}
                        onMarkPaid={(method) => handleMarkPaid(settlement.id, method)}
                        onForgive={() => handleForgive(settlement.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* To Pay */}
              {pendingSettlements.toPay.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    To Pay ({pendingSettlements.toPay.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingSettlements.toPay.map(settlement => (
                      <SettlementCard
                        key={settlement.id}
                        settlement={settlement}
                        isOwedToMe={false}
                        onMarkPaid={(method) => handleMarkPaid(settlement.id, method)}
                        onForgive={() => handleForgive(settlement.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No pending */}
              {totalPending === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <p className="text-gray-600 font-medium">All squared up!</p>
                  <p className="text-sm text-gray-500 mt-1">No pending settlements</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {myTransactions.length > 0 ? (
                myTransactions.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{tx.eventName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        tx.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(tx.netAmount, true)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Entry: {formatCurrency(tx.entry)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📊</span>
                  </div>
                  <p className="text-gray-600 font-medium">No transaction history</p>
                  <p className="text-sm text-gray-500 mt-1">Complete an event to see results here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletSummary;
