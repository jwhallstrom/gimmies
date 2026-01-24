/**
 * TournamentsPage - Discover and manage tournaments
 * Prototype feature - accessible via Settings > Tournaments
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import type { Tournament, TournamentStatus } from '../state/types';
import CreateTournamentWizard from '../components/tournaments/CreateTournamentWizard';

const TournamentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentProfile, tournaments, getMyTournaments, getPublicTournaments } = useStore();
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  
  const myTournaments = useMemo(() => {
    if (!currentProfile) return [];
    return getMyTournaments(currentProfile.id);
  }, [currentProfile, tournaments]);
  
  const publicTournaments = useMemo(() => {
    return getPublicTournaments().filter(t => 
      !myTournaments.some(mt => mt.id === t.id)
    );
  }, [tournaments, myTournaments]);
  
  const getStatusBadge = (status: TournamentStatus) => {
    const styles: Record<TournamentStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      registration_open: 'bg-green-100 text-green-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<TournamentStatus, string> = {
      draft: 'Draft',
      registration_open: 'Open',
      in_progress: 'Live',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const TournamentCard: React.FC<{ tournament: Tournament; showOrganizer?: boolean }> = ({ 
    tournament, 
    showOrganizer = false 
  }) => {
    const isOrganizer = currentProfile?.id === tournament.organizerId;
    const isRegistered = tournament.registrations.some(r => r.profileId === currentProfile?.id);
    const spotsLeft = tournament.maxPlayers - tournament.registrations.filter(r => !r.waitingListPosition).length;
    
    return (
      <button
        onClick={() => navigate(`/tournament/${tournament.id}`)}
        className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{tournament.name}</h3>
            <p className="text-sm text-gray-500 truncate">
              {tournament.courseName || 'Course TBD'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {isOrganizer && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-medium">
                Organizer
              </span>
            )}
            {isRegistered && !isOrganizer && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                Registered
              </span>
            )}
            {getStatusBadge(tournament.status)}
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(tournament.dates[0])}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{tournament.registrations.length}/{tournament.maxPlayers}</span>
          </div>
          {tournament.entryFeeCents > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-medium text-green-600">
                ${(tournament.entryFeeCents / 100).toFixed(0)}
              </span>
            </div>
          )}
          {tournament.rounds > 1 && (
            <div className="text-xs text-gray-500">
              {tournament.rounds} rounds
            </div>
          )}
        </div>
        
        {tournament.status === 'registration_open' && spotsLeft > 0 && spotsLeft <= 10 && (
          <div className="mt-2 text-xs text-orange-600 font-medium">
            Only {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left!
          </div>
        )}
      </button>
    );
  };
  
  const EmptyState: React.FC<{ type: 'my' | 'discover' }> = ({ type }) => (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      {type === 'my' ? (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No tournaments yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first tournament or browse open tournaments to join.
          </p>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Tournament
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No open tournaments</h3>
          <p className="text-sm text-gray-500">
            Check back later for upcoming tournaments in your area.
          </p>
        </>
      )}
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-900 text-white px-4 py-4 pt-safe">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">Tournaments</h1>
              <p className="text-sm text-white/70">Beta Feature</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Create Tournament"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('my')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'my'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            My Tournaments
            {myTournaments.length > 0 && (
              <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {myTournaments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('discover')}
            className={`py-3 px-1 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'discover'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Discover
            {publicTournaments.length > 0 && (
              <span className="ml-2 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
                {publicTournaments.length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 pb-safe">
        {activeTab === 'my' && (
          <div className="space-y-3">
            {myTournaments.length === 0 ? (
              <EmptyState type="my" />
            ) : (
              myTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'discover' && (
          <div className="space-y-3">
            {publicTournaments.length === 0 ? (
              <EmptyState type="discover" />
            ) : (
              publicTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} showOrganizer />
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Create Tournament Wizard */}
      {showCreateWizard && (
        <CreateTournamentWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={(tournamentId) => {
            setShowCreateWizard(false);
            navigate(`/tournament/${tournamentId}`);
          }}
        />
      )}
    </div>
  );
};

export default TournamentsPage;
