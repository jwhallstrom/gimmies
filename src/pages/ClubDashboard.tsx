/**
 * ClubDashboard - Admin dashboard for golf clubs/courses
 * 
 * Features:
 * - Overview stats (tournaments, revenue, players)
 * - Tournament management
 * - Staff management
 * - Settings & Stripe configuration
 */

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import type { Club, Tournament, ClubMember } from '../state/types';
import ClubOnboardingWizard from '../components/club/ClubOnboardingWizard';

type Tab = 'overview' | 'tournaments' | 'staff' | 'settings' | 'payments';

// Mock data for demo - in production, this would come from the store
const MOCK_CLUB: Club = {
  id: 'club-1',
  name: 'Palmer Hills Golf Club',
  type: 'golf_course',
  description: 'A championship 18-hole course featuring stunning views and challenging play.',
  email: 'tournaments@palmerhills.com',
  phone: '(555) 123-4567',
  website: 'https://palmerhills.com',
  address: {
    street: '1234 Fairway Drive',
    city: 'Palm Beach',
    state: 'FL',
    zip: '33480',
    country: 'USA',
  },
  verificationStatus: 'verified',
  verifiedAt: '2025-01-15T00:00:00Z',
  stripe: {
    connectStatus: 'active',
    accountId: 'acct_xxx',
    onboardingComplete: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    defaultCurrency: 'usd',
    platformFeePercent: 2.5,
  },
  settings: {
    allowPublicTournaments: true,
    defaultEntryFeeEnabled: true,
    defaultTipFundEnabled: false,
    autoApproveRegistrations: false,
    requireHandicapVerification: false,
    maxPlayersPerTournament: 144,
    primaryColor: '#1e40af',
  },
  stats: {
    totalTournaments: 12,
    totalPlayers: 847,
    totalRevenue: 4235000, // $42,350.00
    activeTournaments: 2,
  },
  ownerProfileId: 'profile-1',
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2026-01-28T00:00:00Z',
};

const MOCK_TOURNAMENTS: Partial<Tournament>[] = [
  {
    id: 't1',
    name: 'Spring Championship',
    status: 'in_progress',
    dates: ['2026-02-15'],
    registrations: new Array(72).fill(null),
    maxPlayers: 144,
    entryFeeCents: 15000,
    format: 'stroke',
  },
  {
    id: 't2',
    name: 'Member-Guest Invitational',
    status: 'registration_open',
    dates: ['2026-03-01', '2026-03-02'],
    registrations: new Array(48).fill(null),
    maxPlayers: 72,
    entryFeeCents: 25000,
    format: 'best_ball',
  },
  {
    id: 't3',
    name: 'Winter Classic',
    status: 'completed',
    dates: ['2025-12-15'],
    registrations: new Array(96).fill(null),
    maxPlayers: 96,
    entryFeeCents: 10000,
    format: 'stroke',
  },
];

const MOCK_STAFF: ClubMember[] = [
  {
    id: 's1',
    clubId: 'club-1',
    profileId: 'p1',
    profileName: 'John Palmer',
    role: 'owner',
    permissions: {
      canCreateTournaments: true,
      canEditTournaments: true,
      canDeleteTournaments: true,
      canManageRegistrations: true,
      canProcessPayments: true,
      canViewFinancials: true,
      canManageStaff: true,
      canEditClubSettings: true,
      canSendAnnouncements: true,
    },
    invitedAt: '2024-06-01T00:00:00Z',
    status: 'active',
  },
  {
    id: 's2',
    clubId: 'club-1',
    profileId: 'p2',
    profileName: 'Sarah Mitchell',
    profileAvatar: '',
    role: 'manager',
    permissions: {
      canCreateTournaments: true,
      canEditTournaments: true,
      canDeleteTournaments: false,
      canManageRegistrations: true,
      canProcessPayments: false,
      canViewFinancials: true,
      canManageStaff: false,
      canEditClubSettings: false,
      canSendAnnouncements: true,
    },
    invitedAt: '2024-08-15T00:00:00Z',
    status: 'active',
  },
];

const ClubDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentProfile } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // In production, check if user has a club
  const hasClub = true; // MOCK: Would check if currentProfile.clubId exists
  const club = MOCK_CLUB;
  const tournaments = MOCK_TOURNAMENTS;
  const staff = MOCK_STAFF;
  
  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };
  
  // Stats
  const stats = useMemo(() => {
    const activeTournaments = tournaments.filter(t => t.status === 'in_progress' || t.status === 'registration_open');
    const totalRegistrations = tournaments.reduce((sum, t) => sum + (t.registrations?.length || 0), 0);
    return {
      active: activeTournaments.length,
      total: tournaments.length,
      players: totalRegistrations,
      revenue: club.stats.totalRevenue,
    };
  }, [tournaments, club]);
  
  // If no club, show setup prompt
  if (!hasClub) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🏌️‍♂️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Club Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Set up your golf club or course to host tournaments, collect entry fees, and manage players.
          </p>
          <button
            onClick={() => setShowOnboarding(true)}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors"
          >
            Set Up Your Club
          </button>
        </div>
        
        <ClubOnboardingWizard
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={(clubData) => {
            console.log('Club created:', clubData);
            setShowOnboarding(false);
            // In production, save to store/backend
          }}
        />
      </div>
    );
  }
  
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Active Events</p>
          <p className="text-3xl font-bold text-primary-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Players</p>
          <p className="text-3xl font-bold text-gray-900">{stats.players}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Tournaments</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.revenue)}</p>
        </div>
      </div>
      
      {/* Stripe Status */}
      {club.stripe.connectStatus !== 'active' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💳</span>
            <div className="flex-1">
              <p className="font-medium text-gray-900">Complete Payment Setup</p>
              <p className="text-sm text-gray-600">Connect Stripe to collect entry fees and distribute prizes.</p>
            </div>
            <button className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors">
              Set Up
            </button>
          </div>
        </div>
      )}
      
      {/* Active Tournaments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Active Tournaments</h3>
          <button 
            onClick={() => setTab('tournaments')}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            View All →
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {tournaments
            .filter(t => t.status === 'in_progress' || t.status === 'registration_open')
            .slice(0, 3)
            .map(tournament => (
              <div key={tournament.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{tournament.name}</p>
                    <p className="text-sm text-gray-500">
                      {tournament.dates?.[0] && new Date(tournament.dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}
                      {tournament.registrations?.length}/{tournament.maxPlayers} players
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tournament.status === 'in_progress' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {tournament.status === 'in_progress' ? 'In Progress' : 'Registration Open'}
                  </span>
                </div>
              </div>
            ))}
          {tournaments.filter(t => t.status === 'in_progress' || t.status === 'registration_open').length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No active tournaments
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/tournaments/create')}
          className="p-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-xl">🏆</span>
          Create Tournament
        </button>
        <button
          onClick={() => setTab('staff')}
          className="p-4 bg-white border border-gray-200 text-gray-900 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-xl">👥</span>
          Manage Staff
        </button>
      </div>
    </div>
  );
  
  const renderTournaments = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">All Tournaments</h3>
        <button
          onClick={() => navigate('/tournaments/create')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <span>+</span> New Tournament
        </button>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {tournaments.map(tournament => (
            <div key={tournament.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{tournament.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      tournament.status === 'in_progress' 
                        ? 'bg-green-100 text-green-700' 
                        : tournament.status === 'registration_open'
                          ? 'bg-blue-100 text-blue-700'
                          : tournament.status === 'completed'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                      {tournament.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>📅 {tournament.dates?.[0] && new Date(tournament.dates[0]).toLocaleDateString()}</span>
                    <span>👥 {tournament.registrations?.length}/{tournament.maxPlayers}</span>
                    <span>💰 {formatCurrency(tournament.entryFeeCents || 0)}</span>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  const renderStaff = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Staff & Admins</h3>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center gap-2">
          <span>+</span> Invite Staff
        </button>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {staff.map(member => (
            <div key={member.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                    {member.profileName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.profileName}</p>
                    <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {member.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-medium text-gray-900 mb-2">Staff Roles</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li><strong>Owner:</strong> Full access to everything</li>
          <li><strong>Admin:</strong> All permissions except ownership transfer</li>
          <li><strong>Manager:</strong> Create tournaments, manage players, view financials</li>
          <li><strong>Staff:</strong> Edit tournaments, check in players</li>
          <li><strong>Pro:</strong> Create/edit tournaments, send announcements</li>
        </ul>
      </div>
    </div>
  );
  
  const renderSettings = () => (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">Club Settings</h3>
      
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h4 className="font-medium text-gray-900 border-b border-gray-100 pb-2">Basic Information</h4>
        
        <div>
          <label className="block text-sm text-gray-500 mb-1">Club Name</label>
          <input
            type="text"
            value={club.name}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            readOnly
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-500 mb-1">Description</label>
          <textarea
            value={club.description}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            readOnly
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={club.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Phone</label>
            <input
              type="tel"
              value={club.phone}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              readOnly
            />
          </div>
        </div>
      </div>
      
      {/* Tournament Defaults */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h4 className="font-medium text-gray-900 border-b border-gray-100 pb-2">Tournament Defaults</h4>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Allow Public Tournaments</p>
            <p className="text-sm text-gray-500">Let anyone discover and register</p>
          </div>
          <div className={`w-12 h-6 rounded-full ${club.settings.allowPublicTournaments ? 'bg-primary-600' : 'bg-gray-300'} relative transition-colors`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${club.settings.allowPublicTournaments ? 'left-7' : 'left-1'}`} />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Auto-Approve Registrations</p>
            <p className="text-sm text-gray-500">Instantly confirm players</p>
          </div>
          <div className={`w-12 h-6 rounded-full ${club.settings.autoApproveRegistrations ? 'bg-primary-600' : 'bg-gray-300'} relative transition-colors`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${club.settings.autoApproveRegistrations ? 'left-7' : 'left-1'}`} />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-500 mb-1">Max Players per Tournament</label>
          <input
            type="number"
            value={club.settings.maxPlayersPerTournament}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            readOnly
          />
        </div>
      </div>
    </div>
  );
  
  const renderPayments = () => (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-900">Payments & Payouts</h3>
      
      {/* Stripe Status */}
      <div className={`rounded-xl border p-4 ${
        club.stripe.connectStatus === 'active' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            club.stripe.connectStatus === 'active' ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <span className="text-2xl">💳</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {club.stripe.connectStatus === 'active' ? 'Stripe Connected' : 'Setup Required'}
            </p>
            <p className="text-sm text-gray-600">
              {club.stripe.connectStatus === 'active' 
                ? 'You can collect entry fees and distribute prizes' 
                : 'Connect Stripe to accept payments'}
            </p>
          </div>
          {club.stripe.connectStatus === 'active' ? (
            <span className="text-green-600">✓</span>
          ) : (
            <button className="px-4 py-2 bg-[#635bff] text-white rounded-lg font-medium">
              Connect
            </button>
          )}
        </div>
      </div>
      
      {/* Payment Stats */}
      {club.stripe.connectStatus === 'active' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(club.stats.totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Platform Fee</p>
              <p className="text-2xl font-bold text-gray-900">{club.stripe.platformFeePercent}%</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-medium text-gray-900 mb-4">Recent Transactions</h4>
            <div className="text-center py-8 text-gray-500">
              <p>Transaction history coming soon</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
  
  const renderCurrentTab = () => {
    switch (tab) {
      case 'overview': return renderOverview();
      case 'tournaments': return renderTournaments();
      case 'staff': return renderStaff();
      case 'settings': return renderSettings();
      case 'payments': return renderPayments();
    }
  };
  
  return (
    <div className="pb-32">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 -mx-4 -mt-6 px-4 pt-8 pb-6">
        <div className="flex items-center gap-4 mb-4">
          {club.logo ? (
            <img src={club.logo} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white/20" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl">⛳</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{club.name}</h1>
            <p className="text-primary-200 text-sm">Club Dashboard</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'tournaments', label: 'Events', icon: '🏆' },
            { key: 'staff', label: 'Staff', icon: '👥' },
            { key: 'payments', label: 'Payments', icon: '💳' },
            { key: 'settings', label: 'Settings', icon: '⚙️' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key 
                  ? 'bg-white text-primary-700' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </header>
      
      {/* Content */}
      <div className="mt-6">
        {renderCurrentTab()}
      </div>
      
      {/* Onboarding Wizard */}
      <ClubOnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={(clubData) => {
          console.log('Club created:', clubData);
          setShowOnboarding(false);
        }}
      />
    </div>
  );
};

export default ClubDashboard;
