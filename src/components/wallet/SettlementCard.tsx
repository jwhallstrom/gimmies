import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Settlement } from '../../state/types';

interface SettlementCardProps {
  settlement: Settlement;
  isOwedToMe: boolean;
  onMarkPaid: (method: 'cash' | 'venmo' | 'zelle' | 'other') => void;
  onForgive: () => void;
}

const SettlementCard: React.FC<SettlementCardProps> = ({
  settlement,
  isOwedToMe,
  onMarkPaid,
  onForgive,
}) => {
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = () => {
    switch (settlement.status) {
      case 'paid':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            Paid {settlement.paidMethod && `(${settlement.paidMethod})`}
          </span>
        );
      case 'forgiven':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
            Forgiven
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            Pending
          </span>
        );
    }
  };

  const paymentMethods = [
    { id: 'venmo', label: 'Venmo', icon: '💸' },
    { id: 'zelle', label: 'Zelle', icon: '🏦' },
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'other', label: 'Other', icon: '✓' },
  ] as const;

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
      settlement.status === 'pending' 
        ? 'border-amber-200' 
        : 'border-gray-100 opacity-75'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
              isOwedToMe ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isOwedToMe ? '📥' : '📤'}
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {isOwedToMe ? settlement.fromName : settlement.toName}
              </p>
              <Link 
                to={`/event/${settlement.eventId}`}
                className="text-xs text-gray-500 hover:text-primary-600 hover:underline"
              >
                {settlement.eventName} →
              </Link>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Amount */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-2xl font-bold ${
            isOwedToMe ? 'text-green-600' : 'text-red-600'
          }`}>
            {isOwedToMe ? '+' : '-'}{formatCurrency(settlement.roundedAmount)}
          </span>
          {settlement.tipFundAmount > 0 && (
            <span className="text-xs text-gray-500">
              (+{formatCurrency(settlement.tipFundAmount)} to tip fund)
            </span>
          )}
        </div>

        {/* Actions */}
        {settlement.status === 'pending' && (
          <div className="space-y-2">
            {showPaymentOptions ? (
              <div className="grid grid-cols-4 gap-2">
                {paymentMethods.map(method => (
                  <button
                    key={method.id}
                    onClick={() => {
                      onMarkPaid(method.id);
                      setShowPaymentOptions(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  >
                    <span className="text-lg">{method.icon}</span>
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPaymentOptions(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                    isOwedToMe
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isOwedToMe ? 'Mark Received' : 'Mark Paid'}
                </button>
                <button
                  onClick={onForgive}
                  className="py-2 px-4 rounded-lg font-medium text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Forgive
                </button>
              </div>
            )}
          </div>
        )}

        {/* Paid info */}
        {settlement.status === 'paid' && settlement.paidAt && (
          <p className="text-xs text-gray-500 text-center">
            Settled on {new Date(settlement.paidAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default SettlementCard;
