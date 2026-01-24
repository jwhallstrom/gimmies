/**
 * TournamentTeeTimesTab - View and manage tee times / pairings
 */

import React, { useState } from 'react';
import useStore from '../../../state/store';
import type { TournamentTeeTime, TournamentRegistration } from '../../../state/types';

interface Props {
  tournamentId: string;
}

const TournamentTeeTimesTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { currentProfile, generatePairings, removeTeeTime, profiles } = useStore();
  const [selectedRound, setSelectedRound] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [groupSize, setGroupSize] = useState('4');
  const [startTime, setStartTime] = useState('08:00');
  const [interval, setInterval] = useState('10');
  
  if (!tournament) return null;
  
  const isOrganizer = currentProfile?.id === tournament.organizerId;
  
  // Get tee times for selected round
  const roundTeeTimes = tournament.teeTimes
    .filter(tt => tt.roundNumber === selectedRound)
    .sort((a, b) => a.time.localeCompare(b.time));
  
  // Get registration by ID
  const getRegistration = (registrationId: string): TournamentRegistration | undefined => {
    return tournament.registrations.find(r => r.id === registrationId);
  };
  
  // Get profile for a registration
  const getProfile = (registration: TournamentRegistration | undefined) => {
    if (!registration?.profileId) return null;
    return profiles.find(p => p.id === registration.profileId);
  };
  
  const handleGeneratePairings = () => {
    generatePairings(tournamentId, {
      groupSize: parseInt(groupSize, 10),
      startTime,
      interval: parseInt(interval, 10),
    });
    setShowGenerateModal(false);
  };
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };
  
  const TeeTimeCard: React.FC<{ teeTime: TournamentTeeTime }> = ({ teeTime }) => {
    const golfers = teeTime.golferIds.map(id => {
      const reg = getRegistration(id);
      const profile = getProfile(reg);
      return { registration: reg, profile };
    });
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">{formatTime(teeTime.time)}</span>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
              Group {teeTime.groupNumber}
            </span>
          </div>
          {isOrganizer && (
            <button
              onClick={() => removeTeeTime(tournamentId, teeTime.id)}
              className="text-red-500 hover:text-red-700 p-1"
              title="Remove tee time"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {golfers.map(({ registration, profile }, index) => (
            <div key={registration?.id || index} className="px-4 py-2 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary-600 font-semibold text-sm">
                    {(registration?.displayName || registration?.guestName || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">
                  {registration?.displayName || registration?.guestName || 'TBD'}
                </div>
                {registration?.handicapSnapshot != null && (
                  <div className="text-xs text-gray-500">
                    HCP: {registration.handicapSnapshot.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {golfers.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No golfers assigned
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Round Selector (if multi-round) */}
      {tournament.rounds > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map(round => (
            <button
              key={round}
              onClick={() => setSelectedRound(round)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                selectedRound === round
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Round {round}
            </button>
          ))}
        </div>
      )}
      
      {/* Generate Pairings Button (Organizer only) */}
      {isOrganizer && tournament.status !== 'completed' && (
        <button
          onClick={() => setShowGenerateModal(true)}
          className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          Generate Pairings
        </button>
      )}
      
      {/* Tee Times List */}
      {roundTeeTimes.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Tee Times Set</h3>
          <p className="text-sm text-gray-500">
            {isOrganizer 
              ? 'Generate pairings to create tee times for registered players.'
              : 'The organizer has not set up tee times yet.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {roundTeeTimes.map(teeTime => (
            <TeeTimeCard key={teeTime.id} teeTime={teeTime} />
          ))}
        </div>
      )}
      
      {/* Generate Pairings Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Pairings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Size</label>
                <select
                  value={groupSize}
                  onChange={e => setGroupSize(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="2">Twosomes</option>
                  <option value="3">Threesomes</option>
                  <option value="4">Foursomes</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Tee Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interval (minutes)</label>
                <select
                  value={interval}
                  onChange={e => setInterval(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="8">8 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="12">12 minutes</option>
                  <option value="15">15 minutes</option>
                </select>
              </div>
              
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                This will create tee times for {tournament.registrations.filter(r => !r.waitingListPosition).length} registered players.
                {tournament.teeTimes.length > 0 && (
                  <span className="text-orange-600 block mt-1">
                    Warning: Existing tee times will be replaced.
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePairings}
                className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentTeeTimesTab;
