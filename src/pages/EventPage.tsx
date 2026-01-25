/**
 * EventPage - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Cleaner gradient header with clear hierarchy
 * - Pill-style tab navigation (matches Tournament)
 * - Better visual feedback and flow
 * - Mobile-first with large tap targets
 */

import React, { useState, useMemo } from 'react';
import { useParams, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../state/store';
import { useEventSync } from '../hooks/useEventSync';
import SetupTab from '../components/tabs/SetupTab';
import ScoreHubTab from '../components/tabs/ScoreHubTab';
import GolfersTab from '../components/tabs/GolfersTab';
import GamesTab from '../components/tabs/GamesTab';
import PayoutTab from '../components/tabs/PayoutTab';
import ChatTab from '../components/tabs/ChatTab';
import ShareModal from '../components/ShareModal';
import EventNotifications from '../components/EventNotifications';
import NassauTeamsPage from './NassauTeamsPage';
import { getCourseById } from '../data/cloudCourses';

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const EventPage: React.FC = () => {
  const { id } = useParams();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEventsDropdown, setShowEventsDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Auto-sync event from cloud every 30 seconds
  useEventSync(id, 30000);
  
  const event = useStore(s => 
    s.events.find(e => e.id === id) || 
    s.completedEvents.find(e => e.id === id)
  );
  const { deleteEvent, currentProfile, joinEventByCode, generateShareCode, addToast } = useStore();
  
  if (!event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-semibold text-gray-700">Event not found</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-xl font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isGroupHub = event.hubType === 'group';
  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);
  const courseName = event.course.courseId ? getCourseById(event.course.courseId)?.name : null;
  
  // Get child events for this group
  const childEvents = useStore((s) => {
    if (!isGroupHub) return [];
    return (s.events || [])
      .filter((e: any) => e.hubType !== 'group' && e.parentGroupId === id && !e.isCompleted)
      .sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  });
  
  // Separate into events user has joined vs not joined
  const { joinedEvents, unjoinedEvents } = useMemo(() => {
    const joined: typeof childEvents = [];
    const unjoined: typeof childEvents = [];
    
    childEvents.forEach((e: any) => {
      const isInEvent = currentProfile && e.golfers?.some((g: any) => g.profileId === currentProfile.id);
      if (isInEvent) {
        joined.push(e);
      } else {
        unjoined.push(e);
      }
    });
    
    return { joinedEvents: joined, unjoinedEvents: unjoined };
  }, [childEvents, currentProfile?.id]);
  
  // Calculate event stats for header
  const stats = useMemo(() => {
    const golferCount = event.golfers.length;
    const scoresEntered = event.scorecards.filter(sc => sc.scores.length > 0).length;
    const hasGames = (
      (event.games?.nassau?.length ?? 0) +
      (event.games?.skins?.length ?? 0) +
      (event.games?.pinky?.length ?? 0) +
      (event.games?.greenie?.length ?? 0)
    ) > 0;
    
    return { golferCount, scoresEntered, hasGames };
  }, [event]);

  // Define tabs based on hub type
  // Groups get Chat + Golfers (members), Events get full tabs
  const tabs = isGroupHub
    ? [
        { path: 'chat', label: 'Chat', icon: '💬' },
        { path: 'golfers', label: 'Members', icon: '👥' },
        ...(isOwner ? [
          { path: 'settings', label: 'Settings', icon: '⚙️', ownerOnly: true },
        ] : []),
      ]
    : [
        { path: 'chat', label: 'Chat', icon: '💬' },
        { path: 'golfers', label: 'Golfers', icon: '👥' },
        { path: 'scorecard', label: 'Leaderboard', icon: '📊' },
        { path: 'payout', label: 'Payout', icon: '💵' },
        ...(isOwner ? [
          { path: 'games', label: 'Games', icon: '🎯', ownerOnly: true },
          { path: 'settings', label: 'Settings', icon: '⚙️', ownerOnly: true },
        ] : []),
      ];

  const handleDelete = () => {
    if (window.confirm(`Delete "${event.name}"? This cannot be undone.`)) {
      deleteEvent(id!);
      navigate('/');
    }
  };

  // Determine current tab for highlighting
  const currentPath = location.pathname.split('/').pop() || 'chat';
  const isOnTab = tabs.some(t => t.path === currentPath);

  return (
    <div className="min-h-screen -mx-4 -mt-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-4 pt-6 pb-4 shadow-lg">
        {/* Top Row: Back + Actions */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Home</span>
          </button>
          
          <div className="flex items-center gap-1">
            {/* Events Pill - Groups only */}
            {isGroupHub && (
              <div className="relative">
                <button
                  onClick={() => setShowEventsDropdown(!showEventsDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    childEvents.length > 0 
                      ? 'bg-orange-500 text-white hover:bg-orange-600' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>🎯</span>
                  <span>Events</span>
                  {childEvents.length > 0 && (
                    <span className="bg-white text-orange-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center">
                      {childEvents.length}
                    </span>
                  )}
                  <svg className={`w-3.5 h-3.5 transition-transform ${showEventsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showEventsDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowEventsDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 max-h-80 overflow-y-auto">
                      {childEvents.length === 0 ? (
                        <div className="px-4 py-3 text-center">
                          <div className="text-2xl mb-2">📅</div>
                          <div className="text-sm font-semibold text-gray-700">No events yet</div>
                          <p className="text-xs text-gray-500 mt-1">Create an event for this group</p>
                          <button
                            onClick={() => {
                              setShowEventsDropdown(false);
                              navigate(`/events?create=true&returnTo=group&groupId=${encodeURIComponent(id!)}`);
                            }}
                            className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
                          >
                            + Create Event
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Joined events */}
                          {joinedEvents.length > 0 && (
                            <div className="px-3 py-1">
                              <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Your Events</div>
                              {joinedEvents.map((evt: any) => (
                                <button
                                  key={evt.id}
                                  onClick={() => {
                                    setShowEventsDropdown(false);
                                    navigate(`/event/${evt.id}`);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors text-left mb-1"
                                >
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 text-sm truncate">{evt.name || 'Event'}</div>
                                    <div className="text-[10px] text-gray-500">
                                      {evt.date ? formatDateShort(evt.date) : ''} • {evt.golfers?.length || 0} players
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                    JOINED
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {/* Unjoined events */}
                          {unjoinedEvents.length > 0 && (
                            <div className={`px-3 py-1 ${joinedEvents.length > 0 ? 'border-t border-gray-100' : ''}`}>
                              <div className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mb-1 mt-1">Available to Join</div>
                              {unjoinedEvents.map((evt: any) => (
                                <div key={evt.id} className="mb-2 last:mb-0">
                                  <div className="px-3 py-2 rounded-lg bg-gray-50">
                                    <div className="font-semibold text-gray-900 text-sm">{evt.name || 'Event'}</div>
                                    <div className="text-[10px] text-gray-500 mb-2">
                                      {evt.date ? formatDateShort(evt.date) : ''}{evt.course?.teeName ? ` • ${evt.course.teeName}` : ''}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={async () => {
                                          try {
                                            const code = evt.shareCode || (await generateShareCode(evt.id));
                                            if (!code) throw new Error('Missing join code');
                                            const result = await joinEventByCode(code);
                                            if (!result.success) throw new Error(result.error || 'Failed to join');
                                            addToast('Joined event', 'success');
                                            setShowEventsDropdown(false);
                                            navigate(`/event/${evt.id}`);
                                          } catch (e: any) {
                                            addToast(e?.message || 'Could not join event', 'error');
                                          }
                                        }}
                                        className="flex-1 bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-lg text-xs font-bold"
                                      >
                                        Join
                                      </button>
                                      <button
                                        onClick={() => {
                                          setShowEventsDropdown(false);
                                          navigate(`/event/${evt.id}`);
                                        }}
                                        className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700"
                                      >
                                        View
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Create new event button */}
                          <div className="px-3 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => {
                                setShowEventsDropdown(false);
                                navigate(`/events?create=true&returnTo=group&groupId=${encodeURIComponent(id!)}`);
                              }}
                              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              + New Event
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Share Button - Events only */}
            {!isGroupHub && (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Invite Players"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </button>
            )}
            
            {/* Notify Button (owner only) */}
            {isOwner && event.golfers.length > 0 && (
              <button
                onClick={() => setShowNotifications(true)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Notify Group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            )}
            
            {/* Menu Button */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50">
                    {/* Settings (owner) */}
                    {isOwner && (
                      <button
                        onClick={() => { setShowMenu(false); navigate(`/event/${id}/settings`); }}
                        className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {isGroupHub ? 'Group Settings' : 'Event Settings'}
                      </button>
                    )}
                    
                    {/* Create Event (groups only) */}
                    {isGroupHub && (
                      <button
                        onClick={() => { setShowMenu(false); navigate(`/events?create=true&returnTo=group&groupId=${encodeURIComponent(id!)}`); }}
                        className="w-full px-4 py-2.5 text-left text-primary-700 hover:bg-primary-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Event
                      </button>
                    )}
                    
                    {/* Games Setup (events only, owner) */}
                    {!isGroupHub && isOwner && (
                      <button
                        onClick={() => { setShowMenu(false); navigate(`/event/${id}/games`); }}
                        className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="w-4 text-center">🎯</span>
                        Setup Games
                      </button>
                    )}
                    
                    {/* Delete (owner) */}
                    {isOwner && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setShowMenu(false); handleDelete(); }}
                          className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete {isGroupHub ? 'Group' : 'Event'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Event Info */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white mb-1">
            {event.name || 'Untitled Event'}
          </h1>
          {courseName && (
            <p className="text-primary-200 text-sm font-medium">{courseName}</p>
          )}
          <p className="text-primary-300 text-xs mt-1">
            {new Date(event.date).toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
            {event.isCompleted && (
              <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-[10px] font-bold">
                COMPLETED
              </span>
            )}
          </p>
        </div>
        
        {/* Quick Stats */}
        {!isGroupHub && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold text-white">{stats.golferCount}</div>
              <div className="text-[10px] text-primary-200 font-medium">Golfers</div>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold text-white">{stats.scoresEntered}</div>
              <div className="text-[10px] text-primary-200 font-medium">Scoring</div>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <div className="text-lg font-bold text-white">{stats.hasGames ? '✓' : '—'}</div>
              <div className="text-[10px] text-primary-200 font-medium">Games</div>
            </div>
          </div>
        )}
        
        {/* Tab Navigation - Pill Style */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(tab => {
            const isActive = currentPath === tab.path || (!isOnTab && tab.path === 'chat');
            
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-primary-800 shadow-md'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
      
      {/* Content Area */}
      <div className="px-4 py-4">
        <Routes>
          <Route index element={<ChatTab eventId={event.id} />} />
          <Route path="chat" element={<ChatTab eventId={event.id} />} />
          
          {/* Golfers tab available for both groups (as Members) and events */}
          <Route path="golfers" element={<GolfersTab eventId={event.id} />} />
          
          {/* Group-specific: Settings for owner */}
          {isGroupHub && (
            <Route 
              path="settings" 
              element={isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />} 
            />
          )}
          
          {/* Event-specific tabs */}
          {!isGroupHub && (
            <>
              <Route path="scorecard" element={<ScoreHubTab eventId={event.id} />} />
              <Route path="payout" element={<PayoutTab eventId={event.id} />} />
              
              {/* Owner-only routes */}
              <Route 
                path="settings" 
                element={isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />} 
              />
              {/* Legacy games route kept for team picking navigation */}
              <Route 
                path="games" 
                element={isOwner ? <GamesTab eventId={event.id} /> : <AccessDenied />} 
              />
              <Route 
                path="games/nassau/:nassauId/teams" 
                element={isOwner ? <NassauTeamsPage eventId={event.id} /> : <AccessDenied />} 
              />
            </>
          )}
        </Routes>
      </div>
      
      {/* Modals */}
      <ShareModal 
        eventId={event.id} 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
      />
      
      {showNotifications && (
        <EventNotifications
          event={event}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};

// Access denied component
const AccessDenied: React.FC = () => (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">🔒</div>
    <p className="text-gray-600">Only the event owner can access this</p>
  </div>
);

export default EventPage;
