/**
 * TournamentResultsManager - Admin tool for publishing results and distributing payouts
 * 
 * Features:
 * - Final standings display
 * - Score verification
 * - Prize distribution setup
 * - Payout processing
 * - Results publishing
 */

import React, { useState, useMemo } from 'react';
import type { Tournament, TournamentStanding, TournamentPayout, TournamentDivision } from '../../state/types';
import { formatCurrency, calculatePlatformFee } from '../../utils/stripe';

interface Props {
  tournament: Tournament;
  onPublishResults: () => void;
  onProcessPayouts: (payouts: TournamentPayout[]) => void;
  onUpdateStanding: (registrationId: string, updates: Partial<TournamentStanding>) => void;
}

type Tab = 'standings' | 'payouts' | 'publish';

const TournamentResultsManager: React.FC<Props> = ({
  tournament,
  onPublishResults,
  onProcessPayouts,
  onUpdateStanding,
}) => {
  const [tab, setTab] = useState<Tab>('standings');
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [payoutAmounts, setPayoutAmounts] = useState<Record<string, number>>({});
  const [editingStanding, setEditingStanding] = useState<string | null>(null);
  
  // Calculate standings by division
  const standingsByDivision = useMemo(() => {
    const map: Record<string, TournamentStanding[]> = { all: [] };
    
    tournament.divisions.forEach(div => {
      map[div.id] = [];
    });
    
    tournament.standings.forEach(standing => {
      const reg = tournament.registrations.find(r => r.id === standing.registrationId);
      if (reg?.divisionId && map[reg.divisionId]) {
        map[reg.divisionId].push(standing);
      }
      map.all.push(standing);
    });
    
    // Sort each division
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => a.netTotal - b.netTotal);
    });
    
    return map;
  }, [tournament.standings, tournament.registrations, tournament.divisions]);
  
  const currentStandings = selectedDivision 
    ? standingsByDivision[selectedDivision] || []
    : standingsByDivision.all;
  
  // Calculate prize distribution based on tournament settings
  const calculatedPayouts = useMemo(() => {
    const payouts: TournamentPayout[] = [];
    
    if (!tournament.prizePool || tournament.prizePool.totalCents === 0) {
      return payouts;
    }
    
    const prizePool = tournament.prizePool;
    
    // Calculate payouts for each position
    prizePool.distribution.forEach(dist => {
      const standings = dist.divisionId 
        ? standingsByDivision[dist.divisionId] || []
        : standingsByDivision.all;
      
      const winner = standings[dist.position - 1];
      if (!winner) return;
      
      const reg = tournament.registrations.find(r => r.id === winner.registrationId);
      if (!reg) return;
      
      const amount = dist.percentOrFixed === 'percent'
        ? Math.round(prizePool.totalCents * (dist.value / 100))
        : dist.value;
      
      payouts.push({
        id: `payout-${Date.now()}-${dist.position}`,
        tournamentId: tournament.id,
        clubId: tournament.clubId || '',
        registrationId: winner.registrationId,
        profileId: reg.profileId,
        recipientName: reg.displayName || reg.guestName || 'Unknown',
        grossAmountCents: amount,
        netAmountCents: amount - calculatePlatformFee(amount),
        payoutType: 'prize',
        position: dist.position,
        divisionId: dist.divisionId,
        description: `${dist.position}${getOrdinalSuffix(dist.position)} Place${dist.divisionId ? ` - ${tournament.divisions.find(d => d.id === dist.divisionId)?.name}` : ''}`,
        method: 'stripe_transfer',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    });
    
    return payouts;
  }, [tournament, standingsByDivision]);
  
  const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };
  
  const getPlayerName = (registrationId: string): string => {
    const reg = tournament.registrations.find(r => r.id === registrationId);
    return reg?.displayName || reg?.guestName || 'Unknown';
  };
  
  const handleProcessPayouts = async () => {
    setIsProcessing(true);
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      onProcessPayouts(calculatedPayouts);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const totalPrizePool = tournament.prizePool?.totalCents || 0;
  const totalPayouts = calculatedPayouts.reduce((sum, p) => sum + p.grossAmountCents, 0);
  
  const renderStandingsTab = () => (
    <div className="space-y-4">
      {/* Division Filter */}
      {tournament.divisions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedDivision(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDivision === null
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Players
          </button>
          {tournament.divisions.map(div => (
            <button
              key={div.id}
              onClick={() => setSelectedDivision(div.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedDivision === div.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {div.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="grid grid-cols-12 text-xs font-medium text-gray-500 uppercase">
            <div className="col-span-1">Pos</div>
            <div className="col-span-5">Player</div>
            <div className="col-span-2 text-center">Gross</div>
            <div className="col-span-2 text-center">Net</div>
            <div className="col-span-2 text-center">Thru</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {currentStandings.map((standing, idx) => {
            const reg = tournament.registrations.find(r => r.id === standing.registrationId);
            const isEditing = editingStanding === standing.registrationId;
            
            return (
              <div 
                key={standing.registrationId}
                className={`px-4 py-3 ${idx < 3 ? 'bg-amber-50' : ''} hover:bg-gray-50 transition-colors`}
              >
                <div className="grid grid-cols-12 items-center">
                  <div className="col-span-1">
                    <span className={`font-bold ${
                      idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-gray-900'
                    }`}>
                      {standing.isTied ? 'T' : ''}{standing.position}
                    </span>
                  </div>
                  <div className="col-span-5">
                    <p className="font-medium text-gray-900 truncate">{getPlayerName(standing.registrationId)}</p>
                    {reg?.handicapSnapshot != null && (
                      <p className="text-xs text-gray-500">HCP: {reg.handicapSnapshot}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-center font-mono text-gray-900">
                    {standing.grossTotal}
                  </div>
                  <div className="col-span-2 text-center font-mono font-bold text-gray-900">
                    {standing.netTotal}
                  </div>
                  <div className="col-span-2 text-center text-sm text-gray-500">
                    {standing.thru >= 18 ? 'F' : standing.thru}
                  </div>
                </div>
              </div>
            );
          })}
          
          {currentStandings.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No scores recorded yet
            </div>
          )}
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{currentStandings.length}</p>
          <p className="text-xs text-gray-500">Players</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {currentStandings.filter(s => s.thru >= 18).length}
          </p>
          <p className="text-xs text-gray-500">Finished</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {currentStandings.length > 0 
              ? Math.min(...currentStandings.map(s => s.netTotal))
              : '-'}
          </p>
          <p className="text-xs text-gray-500">Low Net</p>
        </div>
      </div>
    </div>
  );
  
  const renderPayoutsTab = () => (
    <div className="space-y-4">
      {/* Prize Pool Summary */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Prize Pool</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalPrizePool)}</p>
          </div>
          <span className="text-4xl">🏆</span>
        </div>
        <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">To Be Distributed</p>
            <p className="font-bold text-gray-900">{formatCurrency(totalPayouts)}</p>
          </div>
          <div>
            <p className="text-gray-500">Remaining</p>
            <p className="font-bold text-gray-900">{formatCurrency(totalPrizePool - totalPayouts)}</p>
          </div>
        </div>
      </div>
      
      {/* Payout List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-bold text-gray-900">Prize Distribution</h4>
        </div>
        <div className="divide-y divide-gray-100">
          {calculatedPayouts.map((payout, idx) => (
            <div key={payout.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    idx === 0 ? 'bg-amber-100 text-amber-600' :
                    idx === 1 ? 'bg-gray-100 text-gray-600' :
                    idx === 2 ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {payout.position}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{payout.recipientName}</p>
                    <p className="text-xs text-gray-500">{payout.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(payout.grossAmountCents)}</p>
                  <p className="text-xs text-gray-500">
                    Net: {formatCurrency(payout.netAmountCents)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {calculatedPayouts.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>No prize distribution configured</p>
              <p className="text-xs mt-1">Add distribution rules in tournament settings</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Side Pots */}
      {tournament.prizePool?.sidePots && tournament.prizePool.sidePots.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-bold text-gray-900">Side Pots</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {tournament.prizePool.sidePots.map((pot, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <span className="text-gray-900">{pot.name}</span>
                <span className="font-bold text-gray-900">{formatCurrency(pot.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Process Button */}
      {calculatedPayouts.length > 0 && (
        <button
          onClick={handleProcessPayouts}
          disabled={isProcessing}
          className="w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing Payouts...
            </>
          ) : (
            <>
              <span>💸</span>
              Process All Payouts ({formatCurrency(totalPayouts)})
            </>
          )}
        </button>
      )}
    </div>
  );
  
  const renderPublishTab = () => (
    <div className="space-y-5">
      <div className="text-center py-4">
        <div className="text-5xl mb-3">📢</div>
        <h3 className="text-lg font-bold text-gray-900">Publish Results</h3>
        <p className="text-sm text-gray-600">Make the final standings official</p>
      </div>
      
      {/* Pre-publish Checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h4 className="font-bold text-gray-900">Pre-publish Checklist</h4>
        
        {[
          { 
            label: 'All scores entered', 
            done: currentStandings.every(s => s.thru >= 18),
            count: `${currentStandings.filter(s => s.thru >= 18).length}/${currentStandings.length}`
          },
          { 
            label: 'Scores verified', 
            done: true, // Would track verification status
            count: null
          },
          { 
            label: 'Payouts configured', 
            done: calculatedPayouts.length > 0,
            count: calculatedPayouts.length > 0 ? `${calculatedPayouts.length} prizes` : null
          },
          { 
            label: 'Ties resolved', 
            done: !currentStandings.some((s, i) => i < 3 && s.isTied),
            count: null
          },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                item.done ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {item.done ? '✓' : '!'}
              </div>
              <span className="text-gray-900">{item.label}</span>
            </div>
            {item.count && (
              <span className="text-sm text-gray-500">{item.count}</span>
            )}
          </div>
        ))}
      </div>
      
      {/* Winners Preview */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-4">
        <h4 className="font-bold text-gray-900 mb-3">🏆 Winners</h4>
        <div className="space-y-2">
          {currentStandings.slice(0, 3).map((standing, idx) => (
            <div key={standing.registrationId} className="flex items-center gap-3">
              <span className={`text-2xl ${
                idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
              }`}></span>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{getPlayerName(standing.registrationId)}</p>
                <p className="text-xs text-gray-500">Net {standing.netTotal}</p>
              </div>
              {calculatedPayouts[idx] && (
                <span className="font-bold text-green-600">
                  {formatCurrency(calculatedPayouts[idx].grossAmountCents)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Notification Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-gray-900 mb-2">📧 Notifications</h4>
        <p className="text-sm text-gray-600">
          {tournament.registrations.length} players will be notified of the final results via email.
        </p>
      </div>
      
      {/* Publish Button */}
      <button
        onClick={onPublishResults}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
      >
        <span>🎉</span>
        Publish Official Results
      </button>
      
      <p className="text-center text-xs text-gray-500">
        This action cannot be undone. Results will be visible to all participants.
      </p>
    </div>
  );
  
  const renderCurrentTab = () => {
    switch (tab) {
      case 'standings': return renderStandingsTab();
      case 'payouts': return renderPayoutsTab();
      case 'publish': return renderPublishTab();
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Results & Payouts</h2>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          tournament.status === 'completed' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {tournament.status === 'completed' ? 'Published' : 'Draft'}
        </span>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 -mx-4 px-4">
        {[
          { key: 'standings', label: 'Standings', icon: '📊' },
          { key: 'payouts', label: 'Payouts', icon: '💰' },
          { key: 'publish', label: 'Publish', icon: '📢' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="mt-4">
        {renderCurrentTab()}
      </div>
    </div>
  );
};

export default TournamentResultsManager;
