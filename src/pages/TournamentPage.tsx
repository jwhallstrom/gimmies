/**
 * TournamentPage - Main tournament view with tabbed navigation
 * Mirrors EventPage pattern for consistent UX
 */

import React, { useState } from 'react';
import { useParams, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../state/store';
import TournamentInfoTab from '../components/tournaments/tabs/TournamentInfoTab';
import TournamentRegistrationsTab from '../components/tournaments/tabs/TournamentRegistrationsTab';
import TournamentTeeTimesTab from '../components/tournaments/tabs/TournamentTeeTimesTab';
import TournamentScoreHubTab from '../components/tournaments/tabs/TournamentScoreHubTab';
import TournamentResultsTab from '../components/tournaments/tabs/TournamentResultsTab';
import TournamentSettingsTab from '../components/tournaments/tabs/TournamentSettingsTab';
import TournamentAdminTab from '../components/tournaments/tabs/TournamentAdminTab';
import type { TournamentStatus } from '../state/types';

const TournamentPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const tournament = useStore(s => s.tournaments.find(t => t.id === id));
  const { currentProfile, deleteTournament } = useStore();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tournament Not Found</h2>
          <p className="text-sm text-gray-500 mb-4">This tournament may have been deleted or doesn't exist.</p>
          <button
            onClick={() => navigate('/tournaments')}
            className="text-primary-600 font-medium hover:text-primary-700"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }
  
  const isOrganizer = currentProfile?.id === tournament.organizerId;
  const isRegistered = tournament.registrations.some(r => r.profileId === currentProfile?.id);
  
  // Tab definitions
  const tabs = [
    {
      path: 'info',
      label: 'Info',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      alwaysEnabled: true,
    },
    {
      path: 'registrations',
      label: 'Golfers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
      ),
      alwaysEnabled: true,
    },
    {
      path: 'teetimes',
      label: 'Tee Times',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      requiresStatus: ['registration_open', 'in_progress', 'completed'] as TournamentStatus[],
    },
    {
      path: 'scores',
      label: 'Scores',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      requiresStatus: ['in_progress', 'completed'] as TournamentStatus[],
    },
    {
      path: 'results',
      label: 'Results',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      requiresStatus: ['completed'] as TournamentStatus[],
    },
    {
      path: 'admin',
      label: 'Admin',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      organizerOnly: true,
    },
    {
      path: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      organizerOnly: true,
    },
  ];
  
  // Filter visible tabs based on status and role
  const visibleTabs = tabs.filter(t => {
    if ((t as any).organizerOnly && !isOrganizer) return false;
    if ((t as any).requiresStatus && !(t as any).requiresStatus.includes(tournament.status)) return false;
    return true;
  });
  
  const getStatusBadge = (status: TournamentStatus) => {
    const styles: Record<TournamentStatus, string> = {
      draft: 'bg-gray-200 text-gray-700',
      registration_open: 'bg-green-200 text-green-800',
      in_progress: 'bg-blue-200 text-blue-800',
      completed: 'bg-gray-200 text-gray-700',
      cancelled: 'bg-red-200 text-red-800',
    };
    const labels: Record<TournamentStatus, string> = {
      draft: 'Draft',
      registration_open: 'Registration Open',
      in_progress: 'In Progress',
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const handleDelete = () => {
    deleteTournament(tournament.id);
    navigate('/tournaments');
  };
  
  const isSettingsActive = location.pathname.includes('/settings');
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 px-4 pt-safe pb-2 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/tournaments')}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-white truncate">{tournament.name}</h1>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span>{formatDate(tournament.dates[0])}</span>
                {tournament.dates.length > 1 && (
                  <span>- {formatDate(tournament.dates[tournament.dates.length - 1])}</span>
                )}
                {getStatusBadge(tournament.status)}
              </div>
            </div>
          </div>
          
          {isOrganizer && (
            <NavLink
              to="settings"
              className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                isSettingsActive ? 'bg-white text-primary-800' : 'text-white/80 hover:bg-white/10'
              }`}
              title="Tournament Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavLink>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
          {visibleTabs.filter(t => t.path !== 'settings').map(t => {
            const isDisabled = (t as any).requiresStatus && !(t as any).requiresStatus.includes(tournament.status);
            
            if (isDisabled) {
              return (
                <div
                  key={t.path}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg shadow-sm min-w-[60px] bg-primary-900/40 text-primary-400 cursor-not-allowed opacity-50"
                >
                  {t.icon}
                  <span className="text-xs text-center leading-tight">{t.label}</span>
                </div>
              );
            }
            
            return (
              <NavLink
                key={t.path}
                to={t.path}
                end={t.path === 'info'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors shadow-sm min-w-[60px] ${
                    isActive ? 'bg-white text-primary-800' : 'bg-primary-700/40 text-primary-100 hover:bg-primary-600/60'
                  }`
                }
              >
                {t.icon}
                <span className="text-xs text-center leading-tight">{t.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 pb-safe">
        <Routes>
          <Route index element={<TournamentInfoTab tournamentId={tournament.id} />} />
          <Route path="info" element={<TournamentInfoTab tournamentId={tournament.id} />} />
          <Route path="registrations" element={<TournamentRegistrationsTab tournamentId={tournament.id} />} />
          <Route path="teetimes" element={<TournamentTeeTimesTab tournamentId={tournament.id} />} />
          <Route path="scores" element={<TournamentScoreHubTab tournamentId={tournament.id} />} />
          <Route path="results" element={<TournamentResultsTab tournamentId={tournament.id} />} />
          <Route
            path="admin"
            element={
              isOrganizer ? (
                <TournamentAdminTab tournamentId={tournament.id} />
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
                  Only the tournament organizer can access admin controls.
                </div>
              )
            }
          />
          <Route
            path="settings"
            element={
              isOrganizer ? (
                <TournamentSettingsTab tournamentId={tournament.id} />
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
                  Only the tournament organizer can change settings.
                </div>
              )
            }
          />
        </Routes>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Tournament?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "{tournament.name}" and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentPage;
