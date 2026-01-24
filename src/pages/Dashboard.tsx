/**
 * Dashboard - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Cleaner visual hierarchy
 * - Focused action areas
 * - Better card layouts
 * - Mobile-first with large tap targets
 * - Less clutter, more focus
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthMode } from '../hooks/useAuthMode';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { CreateGroupWizard } from '../components/CreateGroupWizard';
import { useEventsAdapter, useWalletAdapter } from '../adapters';
import type { Event } from '../state/types';
import useStore from '../state/store';

type Tab = 'events' | 'groups';

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const Dashboard: React.FC = () => {
  const {
    events,
    userEvents,
    currentProfile,
    loadEventsFromCloud,
    profiles,
  } = useEventsAdapter();
  const { wallet } = useWalletAdapter();
  const { isGuest } = useAuthMode();
  const navigate = useNavigate();

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showCreateGroupWizard, setShowCreateGroupWizard] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<Tab>('events');

  // Load events on mount
  useEffect(() => {
    if (!currentProfile) return;
    loadEventsFromCloud().catch(() => {});
  }, [currentProfile?.id]);

  // Separate active events from groups
  const { activeEvents, groups } = useMemo(() => {
    const active: Event[] = [];
    const groupList: Event[] = [];
    
    userEvents.forEach(e => {
      if (e.hubType === 'group') {
        groupList.push(e);
      } else if (!e.isCompleted) {
        active.push(e);
      }
    });
    
    // Sort by recent activity
    active.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    groupList.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    return { activeEvents: active, groups: groupList };
  }, [userEvents]);

  // Quick stats
  const stats = useMemo(() => {
    const handicap = currentProfile?.handicapIndex;
    const lastRound = (currentProfile?.individualRounds || [])[0];
    const netBalance = (wallet?.lifetimeNet ?? 0);
    
    return { handicap, lastRound, netBalance };
  }, [currentProfile, wallet]);

  const handleJoinEvent = async () => {
    if (!joinCode.trim()) return;
    const { joinEventByCode } = useStore.getState();
    try {
      const eventId = await joinEventByCode(joinCode.trim().toUpperCase());
      if (eventId) {
        navigate(`/event/${eventId}`);
      }
    } catch (err) {
      alert('Could not find event with that code');
    }
    setShowJoinModal(false);
    setJoinCode('');
  };

  if (!currentProfile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⛳</div>
          <div className="text-lg font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 -mx-4 -mt-6 px-4 pt-8 pb-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <Link to="/profile" className="block">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold text-white border-2 border-white/30">
                {currentProfile.avatar ? (
                  <img src={currentProfile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  currentProfile.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">
                Hey, {currentProfile.name?.split(' ')[0] || 'Golfer'}!
              </h1>
              <p className="text-primary-200 text-sm">Ready to play?</p>
            </div>
          </div>
          
          {/* Settings */}
          <Link
            to="/profile"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/handicap" className="bg-white/10 hover:bg-white/15 rounded-xl p-3 text-center transition-colors">
            <div className="text-2xl font-bold text-white">
              {stats.handicap != null ? stats.handicap.toFixed(1) : '—'}
            </div>
            <div className="text-[10px] text-primary-200 font-medium uppercase tracking-wide">Handicap</div>
          </Link>
          <Link to="/wallet" className="bg-white/10 hover:bg-white/15 rounded-xl p-3 text-center transition-colors">
            <div className="text-2xl font-bold text-white">
              ${(stats.netBalance / 100).toFixed(0)}
            </div>
            <div className="text-[10px] text-primary-200 font-medium uppercase tracking-wide">Wallet</div>
          </Link>
          <Link to="/analytics" className="bg-white/10 hover:bg-white/15 rounded-xl p-3 text-center transition-colors">
            <div className="text-2xl font-bold text-white">
              {(currentProfile?.individualRounds || []).length}
            </div>
            <div className="text-[10px] text-primary-200 font-medium uppercase tracking-wide">Rounds</div>
          </Link>
        </div>
      </header>

      {/* Quick Actions */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowCreateWizard(true)}
          className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-left text-white shadow-lg shadow-primary-200 hover:shadow-xl transition-all"
        >
          <div className="text-3xl mb-2">⛳</div>
          <div className="font-bold text-lg">New Event</div>
          <div className="text-primary-200 text-sm">Start a round</div>
        </button>
        
        <button
          onClick={() => setShowJoinModal(true)}
          className="bg-white rounded-2xl p-5 text-left border border-gray-200 shadow-md hover:shadow-lg hover:border-primary-300 transition-all"
        >
          <div className="text-3xl mb-2">🎫</div>
          <div className="font-bold text-lg text-gray-900">Join Event</div>
          <div className="text-gray-500 text-sm">Enter a code</div>
        </button>
      </section>

      {/* Events & Groups */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('events')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'events' ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Events
            {activeEvents.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary-100 text-primary-700 rounded-full">
                {activeEvents.length}
              </span>
            )}
            {tab === 'events' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'groups' ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Groups
            {groups.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full">
                {groups.length}
              </span>
            )}
            {tab === 'groups' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          {tab === 'events' && (
            <>
              {activeEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">⛳</div>
                  <div className="font-semibold text-gray-700 mb-1">No active events</div>
                  <p className="text-sm text-gray-500 mb-4">Create or join an event to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeEvents.slice(0, 5).map(event => (
                    <EventCard key={event.id} event={event} profiles={profiles} />
                  ))}
                  
                  {activeEvents.length > 5 && (
                    <Link 
                      to="/events" 
                      className="block text-center py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      View all {activeEvents.length} events →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'groups' && (
            <>
              {groups.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <div className="font-semibold text-gray-700 mb-1">No groups yet</div>
                  <p className="text-sm text-gray-500 mb-4">Create a group to chat with your golf crew</p>
                  <button
                    onClick={() => setShowCreateGroupWizard(true)}
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                  
                  <button
                    onClick={() => setShowCreateGroupWizard(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
                  >
                    + Create New Group
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Tournaments Link */}
      <Link
        to="/tournaments"
        className="block bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🏆</span>
              <span className="font-bold text-lg">Tournaments</span>
            </div>
            <p className="text-gray-400 text-sm">Discover and join tournaments</p>
          </div>
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Modals */}
      <CreateEventWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCreated={(eventId) => {
          setShowCreateWizard(false);
          navigate(`/event/${eventId}`);
        }}
      />

      <CreateGroupWizard
        isOpen={showCreateGroupWizard}
        onClose={() => setShowCreateGroupWizard(false)}
        onCreated={(groupId) => {
          setShowCreateGroupWizard(false);
          navigate(`/event/${groupId}/chat`);
        }}
      />

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Join Event</h3>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter event code"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center font-mono tracking-widest uppercase focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
                maxLength={8}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowJoinModal(false); setJoinCode(''); }}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinEvent}
                disabled={!joinCode.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold ${
                  joinCode.trim()
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Event Card Component
const EventCard: React.FC<{ event: Event; profiles: any[] }> = ({ event, profiles }) => {
  const navigate = useNavigate();
  
  const golferCount = event.golfers.length;
  const scoringCount = event.scorecards.filter(sc => sc.scores.length > 0).length;
  
  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className="w-full text-left bg-gray-50 hover:bg-primary-50 rounded-xl p-4 border border-gray-200 hover:border-primary-300 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 group-hover:text-primary-700 truncate transition-colors">
            {event.name || 'Untitled Event'}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{formatDateShort(event.date)}</span>
            <span>•</span>
            <span>{golferCount} golfer{golferCount !== 1 ? 's' : ''}</span>
            {scoringCount > 0 && (
              <>
                <span>•</span>
                <span className="text-green-600">{scoringCount} scoring</span>
              </>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

// Group Card Component
const GroupCard: React.FC<{ group: Event }> = ({ group }) => {
  const navigate = useNavigate();
  
  const lastMessage = group.chat?.length ? group.chat[group.chat.length - 1] : null;
  
  return (
    <button
      onClick={() => navigate(`/event/${group.id}/chat`)}
      className="w-full text-left bg-purple-50 hover:bg-purple-100 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 group-hover:text-purple-700 truncate transition-colors">
            {group.name || 'Untitled Group'}
          </div>
          <div className="text-sm text-gray-500 mt-1 truncate">
            {lastMessage ? `${lastMessage.senderName}: ${lastMessage.text}` : `${group.golfers.length} members`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-[10px] font-bold bg-purple-200 text-purple-700 rounded-full">
            CHAT
          </span>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default Dashboard;
