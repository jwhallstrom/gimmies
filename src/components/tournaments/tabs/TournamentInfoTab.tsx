/**
 * TournamentInfoTab - Tournament details and registration CTA
 */

import React, { useState } from 'react';
import useStore from '../../../state/store';
import { getCourseById } from '../../../data/cloudCourses';
import type { TournamentFormat } from '../../../state/types';
import TournamentRegistrationModal from '../TournamentRegistrationModal';

interface Props {
  tournamentId: string;
}

const formatLabels: Record<TournamentFormat, string> = {
  stroke: 'Stroke Play',
  stableford: 'Stableford',
  scramble: 'Scramble',
  best_ball: 'Best Ball',
  match_play: 'Match Play',
  skins: 'Skins',
};

const TournamentInfoTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { currentProfile, publishTournament, startTournament, addToast } = useStore();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  
  if (!tournament) return null;
  
  const isOrganizer = currentProfile?.id === tournament.organizerId;
  const registration = tournament.registrations.find(r => r.profileId === currentProfile?.id);
  const isRegistered = Boolean(registration);
  const spotsLeft = tournament.maxPlayers - tournament.registrations.filter(r => !r.waitingListPosition).length;
  const isFull = spotsLeft <= 0;
  
  const course = tournament.courseId ? getCourseById(tournament.courseId) : null;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  
  const handleRegister = () => {
    setShowRegistrationModal(true);
  };
  
  const handleRegistrationComplete = (registrationId: string) => {
    setShowRegistrationModal(false);
    addToast('Successfully registered for tournament!', 'success');
  };
  
  const handlePublish = () => {
    publishTournament(tournamentId);
  };
  
  const handleStart = () => {
    startTournament(tournamentId);
  };
  
  return (
    <div className="space-y-4">
      {/* Main Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-4 py-6 text-white">
          <h2 className="text-xl font-bold mb-1">{tournament.name}</h2>
          <div className="flex items-center gap-2 text-primary-100 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {tournament.dates.length === 1 
                ? formatDate(tournament.dates[0])
                : `${formatDate(tournament.dates[0])} - ${formatDate(tournament.dates[tournament.dates.length - 1])}`
              }
            </span>
          </div>
          {tournament.courseName && (
            <div className="flex items-center gap-2 text-primary-100 text-sm mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{tournament.courseName}</span>
            </div>
          )}
        </div>
        
        {/* Details */}
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{tournament.registrations.length}</div>
              <div className="text-xs text-gray-500">Registered</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{tournament.rounds}</div>
              <div className="text-xs text-gray-500">Round{tournament.rounds !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {tournament.entryFeeCents > 0 ? `$${(tournament.entryFeeCents / 100).toFixed(0)}` : 'Free'}
              </div>
              <div className="text-xs text-gray-500">Entry</div>
            </div>
          </div>
          
          {/* Format & Spots */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Format</div>
              <div className="font-semibold text-gray-900">{formatLabels[tournament.format]}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Spots</div>
              <div className={`font-semibold ${spotsLeft <= 5 ? 'text-orange-600' : 'text-gray-900'}`}>
                {spotsLeft} / {tournament.maxPlayers} available
              </div>
            </div>
          </div>
          
          {/* Description */}
          {tournament.description && (
            <div className="py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">About</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tournament.description}</p>
            </div>
          )}
          
          {/* Rules */}
          {tournament.rules && (
            <div className="py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rules</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{tournament.rules}</p>
            </div>
          )}
          
          {/* Divisions */}
          {tournament.divisions.length > 0 && (
            <div className="py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Divisions</div>
              <div className="flex flex-wrap gap-2">
                {tournament.divisions.map(div => (
                  <span key={div.id} className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium">
                    {div.name}
                    {(div.handicapMin != null || div.handicapMax != null) && (
                      <span className="text-primary-500 ml-1 text-xs">
                        ({div.handicapMin ?? 0} - {div.handicapMax ?? 'any'})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Organizer Actions */}
        {isOrganizer && tournament.status === 'draft' && (
          <button
            onClick={handlePublish}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Publish Tournament
          </button>
        )}
        
        {isOrganizer && tournament.status === 'registration_open' && tournament.registrations.length > 0 && (
          <button
            onClick={handleStart}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Tournament
          </button>
        )}
        
        {/* Player Registration */}
        {tournament.status === 'registration_open' && !isRegistered && !isFull && currentProfile && (
          <button
            onClick={handleRegister}
            className="w-full py-4 bg-primary-600 text-white font-bold text-lg rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
          >
            Register Now
            {tournament.entryFeeCents > 0 && (
              <span className="ml-2 text-primary-200">
                ${(tournament.entryFeeCents / 100).toFixed(0)}
              </span>
            )}
          </button>
        )}
        
        {tournament.status === 'registration_open' && isFull && !isRegistered && (
          <button
            onClick={handleRegister}
            className="w-full py-4 bg-orange-600 text-white font-bold text-lg rounded-xl hover:bg-orange-700 transition-colors"
          >
            Join Waiting List
          </button>
        )}
        
        {isRegistered && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-green-800">You're Registered!</div>
              <div className="text-sm text-green-600">
                {registration?.waitingListPosition 
                  ? `Waiting list position: #${registration.waitingListPosition}`
                  : registration?.paymentStatus === 'pending' 
                    ? 'Payment pending'
                    : 'See you on the course!'
                }
              </div>
            </div>
          </div>
        )}
        
        {tournament.status === 'draft' && !isOrganizer && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-gray-500">
            This tournament is not yet open for registration.
          </div>
        )}
        
        {tournament.status === 'in_progress' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <div className="font-semibold text-blue-800">Tournament in Progress</div>
            <div className="text-sm text-blue-600">Check the Scores tab for live leaderboard.</div>
          </div>
        )}
        
        {tournament.status === 'completed' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="font-semibold text-gray-800">Tournament Complete</div>
            <div className="text-sm text-gray-600">See the Results tab for final standings.</div>
          </div>
        )}
      </div>
      
      {/* Registration Modal */}
      {showRegistrationModal && (
        <TournamentRegistrationModal
          tournament={tournament}
          onClose={() => setShowRegistrationModal(false)}
          onComplete={handleRegistrationComplete}
        />
      )}
    </div>
  );
};

export default TournamentInfoTab;
