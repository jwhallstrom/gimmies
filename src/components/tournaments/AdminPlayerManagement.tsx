/**
 * AdminPlayerManagement - Manage players, refunds, and payment log
 * 
 * Features:
 * - View all registered players with status
 * - Remove players (with confirmation)
 * - Process refunds
 * - Payment transaction log
 * - Export capabilities
 * 
 * Designed for non-tech-savvy admins
 */

import React, { useState, useMemo } from 'react';
import type { Tournament, TournamentRegistration } from '../../state/types';

interface Props {
  tournament: Tournament;
  onRemovePlayer: (registrationId: string, reason?: string) => void;
  onRefundPlayer: (registrationId: string, amountCents: number, reason: string) => Promise<RefundResult>;
  onUpdatePaymentStatus: (registrationId: string, status: 'paid' | 'pending' | 'refunded') => void;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

interface PaymentLogEntry {
  id: string;
  registrationId: string;
  golferName: string;
  type: 'payment' | 'refund' | 'adjustment';
  amountCents: number;
  status: 'completed' | 'pending' | 'failed';
  method: 'card' | 'cash' | 'manual';
  timestamp: string;
  note?: string;
}

type ViewTab = 'players' | 'payments' | 'refunds';

const AdminPlayerManagement: React.FC<Props> = ({
  tournament,
  onRemovePlayer,
  onRefundPlayer,
  onUpdatePaymentStatus,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<TournamentRegistration | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Filter players based on search
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return tournament.registrations;
    const query = searchQuery.toLowerCase();
    return tournament.registrations.filter(r =>
      (r.displayName || r.guestName || '').toLowerCase().includes(query)
    );
  }, [tournament.registrations, searchQuery]);
  
  // Mock payment log (in real app, would come from payment service)
  const paymentLog: PaymentLogEntry[] = useMemo(() => {
    return tournament.registrations.map(reg => ({
      id: `pay_${reg.id}`,
      registrationId: reg.id,
      golferName: reg.displayName || reg.guestName || 'Unknown',
      type: 'payment' as const,
      amountCents: tournament.entryFeeCents,
      status: reg.paymentStatus === 'paid' ? 'completed' as const : 'pending' as const,
      method: 'card' as const, // In real app, would track actual method
      timestamp: reg.createdAt,
    }));
  }, [tournament.registrations, tournament.entryFeeCents]);
  
  // Stats
  const stats = useMemo(() => {
    const paid = tournament.registrations.filter(r => r.paymentStatus === 'paid').length;
    const pending = tournament.registrations.filter(r => r.paymentStatus === 'pending').length;
    const refunded = tournament.registrations.filter(r => r.paymentStatus === 'refunded').length;
    const totalCollected = paid * tournament.entryFeeCents;
    const totalPending = pending * tournament.entryFeeCents;
    
    return { paid, pending, refunded, totalCollected, totalPending };
  }, [tournament.registrations, tournament.entryFeeCents]);
  
  const handleRemovePlayer = async () => {
    if (!selectedPlayer) return;
    setIsProcessing(true);
    
    try {
      onRemovePlayer(selectedPlayer.id, removeReason);
      setActionSuccess(`${selectedPlayer.displayName} has been removed from the tournament.`);
      setShowRemoveConfirm(false);
      setSelectedPlayer(null);
      setRemoveReason('');
    } catch (error) {
      console.error('Failed to remove player:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRefund = async () => {
    if (!selectedPlayer) return;
    const amountCents = Math.round(parseFloat(refundAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    
    setIsProcessing(true);
    
    try {
      const result = await onRefundPlayer(selectedPlayer.id, amountCents, refundReason);
      
      if (result.success) {
        setActionSuccess(`$${(amountCents / 100).toFixed(2)} refunded to ${selectedPlayer.displayName}.`);
        setShowRefundModal(false);
        setSelectedPlayer(null);
        setRefundAmount('');
        setRefundReason('');
      }
    } catch (error) {
      console.error('Failed to process refund:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  // Clear success message after 3s
  React.useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);
  
  return (
    <div className="space-y-4">
      {/* Success Toast */}
      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-slide-up">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-800 font-medium">{actionSuccess}</p>
        </div>
      )}
      
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Collected</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalCollected)}</div>
          <div className="text-xs text-gray-400">{stats.paid} paid registrations</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Pending Payments</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalPending)}</div>
          <div className="text-xs text-gray-400">{stats.pending} awaiting payment</div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'players' as ViewTab, label: 'Players', count: tournament.registrations.length },
          { id: 'payments' as ViewTab, label: 'Payments', count: stats.paid },
          { id: 'refunds' as ViewTab, label: 'Refunds', count: stats.refunded },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          
          {/* Player List */}
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {filteredPlayers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {searchQuery ? 'No players found matching your search.' : 'No players registered yet.'}
              </div>
            ) : (
              filteredPlayers.map(player => (
                <div key={player.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 truncate">{player.displayName}</div>
                        {player.waitingListPosition && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                            Waitlist #{player.waitingListPosition}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        {player.handicapSnapshot != null && (
                          <span>HCP: {player.handicapSnapshot.toFixed(1)}</span>
                        )}
                        {tournament.divisions.length > 0 && player.divisionId && (
                          <span>
                            {tournament.divisions.find(d => d.id === player.divisionId)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Payment Status */}
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        player.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                        player.paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {player.paymentStatus === 'paid' ? 'Paid' :
                         player.paymentStatus === 'refunded' ? 'Refunded' : 'Pending'}
                      </span>
                      
                      {/* Actions Menu */}
                      <div className="relative group">
                        <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-10 hidden group-hover:block">
                          {player.paymentStatus === 'pending' && (
                            <button
                              onClick={() => onUpdatePaymentStatus(player.id, 'paid')}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Mark as Paid
                            </button>
                          )}
                          
                          {player.paymentStatus === 'paid' && tournament.entryFeeCents > 0 && (
                            <button
                              onClick={() => {
                                setSelectedPlayer(player);
                                setRefundAmount((tournament.entryFeeCents / 100).toFixed(2));
                                setShowRefundModal(true);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Process Refund
                            </button>
                          )}
                          
                          <button
                            onClick={() => {
                              setSelectedPlayer(player);
                              setShowRemoveConfirm(true);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove Player
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900">Payment History</h4>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {paymentLog.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No payments recorded yet.</div>
            ) : (
              paymentLog.map(entry => (
                <div key={entry.id} className="p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{entry.golferName}</div>
                    <div className="text-sm text-gray-500">{formatDate(entry.timestamp)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${
                      entry.type === 'refund' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {entry.type === 'refund' ? '-' : '+'}{formatCurrency(entry.amountCents)}
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                      entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                      entry.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {entry.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Export Button */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <button className="w-full py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>
          </div>
        </div>
      )}
      
      {/* Refunds Tab */}
      {activeTab === 'refunds' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-900">Refund History</h4>
          </div>
          
          <div className="p-8 text-center text-gray-500">
            {stats.refunded === 0 ? (
              <>
                <div className="text-4xl mb-2">💰</div>
                <p>No refunds processed yet.</p>
                <p className="text-sm mt-1">Refunds will appear here when processed.</p>
              </>
            ) : (
              <p>{stats.refunded} refund(s) processed</p>
            )}
          </div>
        </div>
      )}
      
      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Remove Player?</h3>
              <p className="text-gray-600 mt-1">
                This will remove <span className="font-semibold">{selectedPlayer.displayName}</span> from the tournament.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                placeholder="e.g., Requested withdrawal"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            {selectedPlayer.paymentStatus === 'paid' && tournament.entryFeeCents > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-yellow-800">
                    <strong>Note:</strong> This player has paid. You may want to process a refund separately.
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setSelectedPlayer(null);
                  setRemoveReason('');
                }}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemovePlayer}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Removing...
                  </>
                ) : (
                  'Remove Player'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Refund Modal */}
      {showRefundModal && selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Process Refund</h3>
              <p className="text-gray-600 mt-1">
                Refund for <span className="font-semibold">{selectedPlayer.displayName}</span>
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Full entry fee: {formatCurrency(tournament.entryFeeCents)}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select reason...</option>
                  <option value="player_request">Player requested withdrawal</option>
                  <option value="tournament_cancelled">Tournament cancelled</option>
                  <option value="duplicate_payment">Duplicate payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedPlayer(null);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={isProcessing || !refundAmount || !refundReason}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Refund ${refundAmount ? formatCurrency(parseFloat(refundAmount) * 100) : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlayerManagement;
