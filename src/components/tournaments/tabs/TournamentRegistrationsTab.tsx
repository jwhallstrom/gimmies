/**
 * TournamentRegistrationsTab - View and manage tournament registrations
 */

import React, { useState } from 'react';
import useStore from '../../../state/store';
import type { TournamentRegistration } from '../../../state/types';

interface Props {
  tournamentId: string;
}

const TournamentRegistrationsTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { currentProfile, profiles, removeRegistration, updateRegistration } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  if (!tournament) return null;
  
  const isOrganizer = currentProfile?.id === tournament.organizerId;
  
  // Split registrations into confirmed and waiting list
  const confirmedRegistrations = tournament.registrations.filter(r => !r.waitingListPosition);
  const waitingList = tournament.registrations
    .filter(r => r.waitingListPosition)
    .sort((a, b) => (a.waitingListPosition || 0) - (b.waitingListPosition || 0));
  
  // Filter by search
  const filterRegistrations = (regs: TournamentRegistration[]) => {
    if (!searchQuery.trim()) return regs;
    const q = searchQuery.toLowerCase();
    return regs.filter(r => {
      const name = r.displayName || r.guestName || '';
      return name.toLowerCase().includes(q);
    });
  };
  
  const filteredConfirmed = filterRegistrations(confirmedRegistrations);
  const filteredWaiting = filterRegistrations(waitingList);
  
  const getProfile = (registration: TournamentRegistration) => {
    if (registration.profileId) {
      return profiles.find(p => p.id === registration.profileId);
    }
    return null;
  };
  
  const handleRemove = (registrationId: string) => {
    if (confirm('Remove this registration? This cannot be undone.')) {
      removeRegistration(tournamentId, registrationId);
    }
  };
  
  const handleUpdatePayment = (registrationId: string, status: 'pending' | 'paid' | 'refunded') => {
    updateRegistration(tournamentId, registrationId, { paymentStatus: status });
  };
  
  const RegistrationCard: React.FC<{ registration: TournamentRegistration }> = ({ registration }) => {
    const profile = getProfile(registration);
    const name = registration.displayName || registration.guestName || 'Unknown';
    const isCurrentUser = registration.profileId === currentProfile?.id;
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profile?.avatar ? (
            <img src={profile.avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary-600 font-semibold">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{name}</span>
            {isCurrentUser && (
              <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">You</span>
            )}
            {registration.waitingListPosition && (
              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                #{registration.waitingListPosition}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            {registration.handicapSnapshot != null && (
              <span>HCP: {registration.handicapSnapshot.toFixed(1)}</span>
            )}
            {registration.divisionId && tournament.divisions.length > 0 && (
              <span>
                {tournament.divisions.find(d => d.id === registration.divisionId)?.name || 'Unknown Division'}
              </span>
            )}
          </div>
        </div>
        
        {/* Payment Status */}
        <div className="flex items-center gap-2">
          {tournament.entryFeeCents > 0 && (
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              registration.paymentStatus === 'paid' 
                ? 'bg-green-100 text-green-700'
                : registration.paymentStatus === 'refunded'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-yellow-100 text-yellow-700'
            }`}>
              {registration.paymentStatus === 'paid' ? 'Paid' : registration.paymentStatus === 'refunded' ? 'Refunded' : 'Pending'}
            </span>
          )}
          
          {/* Admin Actions */}
          {isOrganizer && (
            <div className="relative group">
              <button className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40 hidden group-hover:block z-10">
                {tournament.entryFeeCents > 0 && registration.paymentStatus !== 'paid' && (
                  <button
                    onClick={() => handleUpdatePayment(registration.id, 'paid')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Mark as Paid
                  </button>
                )}
                {tournament.entryFeeCents > 0 && registration.paymentStatus === 'paid' && (
                  <button
                    onClick={() => handleUpdatePayment(registration.id, 'refunded')}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Mark as Refunded
                  </button>
                )}
                <button
                  onClick={() => handleRemove(registration.id)}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search golfers..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{confirmedRegistrations.length}</div>
          <div className="text-xs text-gray-500">Registered</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{tournament.maxPlayers}</div>
          <div className="text-xs text-gray-500">Max Spots</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-xl font-bold text-orange-600">{waitingList.length}</div>
          <div className="text-xs text-gray-500">Waiting</div>
        </div>
      </div>
      
      {/* Confirmed Registrations */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Registered ({filteredConfirmed.length})
        </h3>
        {filteredConfirmed.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            {searchQuery ? 'No matching golfers found.' : 'No registrations yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConfirmed.map(reg => (
              <RegistrationCard key={reg.id} registration={reg} />
            ))}
          </div>
        )}
      </div>
      
      {/* Waiting List */}
      {waitingList.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Waiting List ({filteredWaiting.length})
          </h3>
          <div className="space-y-2">
            {filteredWaiting.map(reg => (
              <RegistrationCard key={reg.id} registration={reg} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentRegistrationsTab;
