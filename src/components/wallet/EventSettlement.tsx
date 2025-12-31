import React, { useState, useMemo } from 'react';
import useStore from '../../state/store';
import SettlementCard from './SettlementCard';
import type { Settlement } from '../../state/types';

interface EventSettlementProps {
  eventId: string;
  onClose?: () => void;
}

const EventSettlement: React.FC<EventSettlementProps> = ({ eventId, onClose }) => {
  const { 
    currentProfile, 
    profiles,
    events, 
    completedEvents, 
    getEventSettlements, 
    getEventTipFund,
    createSettlements,
    markSettlementPaid, 
    forgiveSettlement,
    addToast,
  } = useStore();

  const [showAll, setShowAll] = useState(false);

  // Find the event
  const event = useMemo(() => {
    return events.find(e => e.id === eventId) || completedEvents.find(e => e.id === eventId);
  }, [events, completedEvents, eventId]);

  // Get or create settlements
  const settlements = useMemo(() => {
    let existing = getEventSettlements(eventId);
    if (existing.length === 0 && event) {
      existing = createSettlements(eventId);
    }
    return existing;
  }, [eventId, event, getEventSettlements, createSettlements]);

  const tipFund = getEventTipFund(eventId);

  // Categorize settlements for current user
  const { mySettlements, otherSettlements } = useMemo(() => {
    if (!currentProfile) return { mySettlements: [], otherSettlements: [] };
    
    const mine: Settlement[] = [];
    const others: Settlement[] = [];
    
    settlements.forEach(s => {
      if (s.toProfileId === currentProfile.id || s.fromProfileId === currentProfile.id) {
        mine.push(s);
      } else {
        others.push(s);
      }
    });
    
    return { mySettlements: mine, otherSettlements: others };
  }, [settlements, currentProfile]);

  // Calculate totals
  const { totalToCollect, totalToPay, netAmount } = useMemo(() => {
    if (!currentProfile) return { totalToCollect: 0, totalToPay: 0, netAmount: 0 };
    
    let collect = 0;
    let pay = 0;
    
    mySettlements.forEach(s => {
      if (s.status !== 'pending') return;
      if (s.toProfileId === currentProfile.id) {
        collect += s.roundedAmount;
      } else {
        pay += s.roundedAmount;
      }
    });
    
    return { totalToCollect: collect, totalToPay: pay, netAmount: collect - pay };
  }, [mySettlements, currentProfile]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const handleMarkPaid = (settlementId: string, method: 'cash' | 'venmo' | 'zelle' | 'other') => {
    markSettlementPaid(settlementId, method);
    addToast(`Settlement marked as paid via ${method}`, 'success');
  };

  const handleForgive = (settlementId: string) => {
    forgiveSettlement(settlementId);
    addToast('Settlement forgiven', 'info');
  };

  if (!event) {
    return (
      <div className="p-6 text-center text-gray-500">
        Event not found
      </div>
    );
  }

  const pendingCount = settlements.filter(s => s.status === 'pending').length;

  return (
    <div className="bg-gray-50 min-h-full">
      {/* Header */}
      <div className="bg-primary-900 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Settlements</h2>
            <p className="text-sm text-white/70">{event.name}</p>
          </div>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Close settlements"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      {currentProfile && (totalToCollect > 0 || totalToPay > 0) && (
        <div className="p-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Your Summary</h3>
            <div className="flex justify-between items-center">
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 mb-1">To Collect</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(totalToCollect)}
                </p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 mb-1">To Pay</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrency(totalToPay)}
                </p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="text-center flex-1">
                <p className="text-xs text-gray-500 mb-1">Net</p>
                <p className={`text-lg font-bold ${
                  netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {netAmount >= 0 ? '+' : '-'}{formatCurrency(netAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tip Fund */}
      {tipFund && tipFund.balance > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🎩</span>
            <div className="flex-1">
              <p className="font-medium text-amber-900">Tip Fund</p>
              <p className="text-sm text-amber-700">Collected from rounding</p>
            </div>
            <p className="text-lg font-bold text-amber-900">
              {formatCurrency(tipFund.balance)}
            </p>
          </div>
        </div>
      )}

      {/* My Settlements */}
      {mySettlements.length > 0 && (
        <div className="p-4 pt-0">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Your Settlements</h3>
          <div className="space-y-3">
            {mySettlements.map(settlement => (
              <SettlementCard
                key={settlement.id}
                settlement={settlement}
                isOwedToMe={settlement.toProfileId === currentProfile?.id}
                onMarkPaid={(method) => handleMarkPaid(settlement.id, method)}
                onForgive={() => handleForgive(settlement.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Settlements (toggle) */}
      {otherSettlements.length > 0 && (
        <div className="p-4 pt-0">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Other Settlements ({otherSettlements.length})
          </button>
          
          {showAll && (
            <div className="space-y-3">
              {otherSettlements.map(settlement => {
                const from = profiles.find(p => p.id === settlement.fromProfileId);
                const to = profiles.find(p => p.id === settlement.toProfileId);
                return (
                  <div
                    key={settlement.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          {from?.name || settlement.fromName}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="font-medium text-gray-700">
                          {to?.name || settlement.toName}
                        </span>
                      </div>
                      <span className="font-bold text-gray-800">
                        {formatCurrency(settlement.roundedAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {settlement.status === 'paid' ? 'Settled' : settlement.status === 'forgiven' ? 'Forgiven' : 'Pending'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No settlements */}
      {settlements.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🤝</span>
          </div>
          <p className="text-gray-600 font-medium">No settlements needed</p>
          <p className="text-sm text-gray-500 mt-1">Everyone broke even!</p>
        </div>
      )}

      {/* All settled message */}
      {settlements.length > 0 && pendingCount === 0 && (
        <div className="p-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <span className="text-2xl mb-2 block">✅</span>
            <p className="font-medium text-green-800">All settled!</p>
            <p className="text-sm text-green-600">Everyone is square</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventSettlement;
