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
import { useParams, Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
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
  
  // Get child events for this group (both active and completed)
  const { activeChildEvents, completedChildEvents } = useStore((s) => {
    if (!isGroupHub) return { activeChildEvents: [], completedChildEvents: [] };
    
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    const groupEvents = allEvents.filter((e: any) => e.hubType !== 'group' && e.parentGroupId === id);
    
    const active = groupEvents
      .filter((e: any) => !e.isCompleted)
      .sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    const completed = groupEvents
      .filter((e: any) => e.isCompleted)
      .sort((a: any, b: any) => new Date(b.completedAt || b.lastModified).getTime() - new Date(a.completedAt || a.lastModified).getTime());
    
    return { activeChildEvents: active, completedChildEvents: completed };
  });
  
  // For backward compatibility
  const childEvents = activeChildEvents;
  
  // State for showing history
  const [showHistory, setShowHistory] = useState(false);
  
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
  
  // Header badges / counts
  const stats = useMemo(() => {
    const golferCount = event.golfers.length;
    return { golferCount };
  }, [event.golfers.length]);

  // Define tabs based on hub type
  // Groups get Chat + Golfers (members), Events get full tabs
  const tabs = isGroupHub
    ? [
        { path: 'chat', label: 'Chat', icon: '💬' },
        { path: 'golfers', label: 'Members', icon: '👥', badge: stats.golferCount },
        { path: 'events', label: 'Events', icon: '🎯', badge: activeChildEvents.length || undefined },
        ...(isOwner ? [
          { path: 'alerts', label: 'Alerts', icon: '🔔', ownerOnly: true },
          { path: 'settings', label: 'Settings', icon: '⚙️', ownerOnly: true },
        ] : []),
      ]
    : [
        { path: 'chat', label: 'Chat', icon: '💬' },
        { path: 'golfers', label: 'Golfers', icon: '👥', badge: stats.golferCount },
        { path: 'scorecard', label: 'Leaderboard', icon: '📊' },
        { path: 'games', label: 'Games', icon: '🎯' },
        ...(isOwner ? [
          { path: 'alerts', label: 'Alerts', icon: '🔔', ownerOnly: true },
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
    <div className="min-h-screen -mx-4 -mt-6 flex flex-col">
      {/* Header - Compact & Sticky */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-3 py-2 shadow-lg sticky top-0 z-30 flex-shrink-0">
        {/* Single Row: Event Info + Actions */}
        <div className="flex items-center gap-2">
          {/* Event Title - Takes remaining space */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {event.name || 'Untitled Event'}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-primary-200">
              {courseName && <span className="truncate max-w-[120px]">{courseName}</span>}
              {courseName && <span className="text-primary-400">•</span>}
              <span className="flex-shrink-0">
                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {event.isCompleted && (
                <span className="px-1 py-0.5 bg-green-500/20 text-green-300 rounded text-[8px] font-bold flex-shrink-0">
                  DONE
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Tab Navigation - Inline */}
        <div className={`flex justify-center px-3 pb-2 -mx-3 ${isGroupHub ? 'gap-1' : 'gap-3'}`}>
          {tabs.map((tab) => {
            const isActive = currentPath === tab.path || (!isOnTab && tab.path === 'chat');
            const badge = (tab as any).badge as number | undefined;
            
            // For events (not groups), show icons only to save space
            const showLabel = isGroupHub;
            
            // Alerts tab opens modal instead of navigating
            if (tab.path === 'alerts') {
              return (
                <button
                  key={tab.path}
                  onClick={() => setShowNotifications(true)}
                  className={`flex items-center justify-center gap-1 rounded-lg font-semibold transition-all flex-shrink-0 bg-white/10 text-white/85 hover:bg-white/20 hover:text-white ${
                    showLabel ? 'px-2.5 py-1.5 text-[11px]' : 'w-10 h-10 text-lg'
                  }`}
                  title={tab.label}
                >
                  <span className={showLabel ? 'text-sm leading-none' : ''}>{tab.icon}</span>
                  {showLabel && <span className="leading-none whitespace-nowrap">{tab.label}</span>}
                </button>
              );
            }
            
            // Events tab opens dropdown instead of navigating
            if (tab.path === 'events') {
              return (
                <button
                  key={tab.path}
                  onClick={() => setShowEventsDropdown(!showEventsDropdown)}
                  className={`flex items-center justify-center gap-1 rounded-lg font-semibold transition-all flex-shrink-0 ${
                    showLabel ? 'px-2.5 py-1.5 text-[11px]' : 'w-10 h-10 text-lg'
                  } ${
                    showEventsDropdown
                      ? 'bg-white text-primary-800 shadow-sm'
                      : badge && badge > 0
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                  }`}
                  title={tab.label}
                >
                  <span className={showLabel ? 'text-sm leading-none' : ''}>{tab.icon}</span>
                  {showLabel && <span className="leading-none whitespace-nowrap">{tab.label}</span>}
                  {typeof badge === 'number' && badge > 0 && (
                    <span
                      className={`ml-0.5 px-1 py-0.5 rounded-full text-[9px] font-extrabold leading-none ${
                        showEventsDropdown ? 'bg-primary-100 text-primary-800' : 'bg-white/30 text-white'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            }
            
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={`relative flex items-center justify-center gap-1 rounded-lg font-semibold transition-all flex-shrink-0 ${
                  showLabel ? 'px-2.5 py-1.5 text-[11px]' : 'w-10 h-10 text-lg'
                } ${
                  isActive
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                }`}
                title={tab.label}
              >
                <span className={showLabel ? 'text-sm leading-none' : ''}>{tab.icon}</span>
                {showLabel && <span className="leading-none whitespace-nowrap">{tab.label}</span>}
                {typeof badge === 'number' && (
                  showLabel ? (
                    <span
                      className={`ml-0.5 px-1 py-0.5 rounded-full text-[9px] font-extrabold leading-none ${
                        isActive ? 'bg-primary-100 text-primary-800' : 'bg-white/20 text-white'
                      }`}
                    >
                      {badge}
                    </span>
                  ) : (
                    <span
                      className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-primary-600 text-white' : 'bg-white text-primary-800'
                      }`}
                    >
                      {badge}
                    </span>
                  )
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
      
      {/* Events Dropdown Modal - Groups only */}
      {isGroupHub && showEventsDropdown && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowEventsDropdown(false)} />
          <div className="fixed left-4 right-4 top-28 z-50 max-w-sm mx-auto">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-2 max-h-80 overflow-y-auto">
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
                  
                  {/* History toggle */}
                  {completedChildEvents.length > 0 && (
                    <div className="px-3 py-2 border-t border-gray-100">
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>📜</span>
                          <span>History ({completedChildEvents.length})</span>
                        </span>
                        <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showHistory && (
                        <div className="mt-2 space-y-1">
                          {completedChildEvents.slice(0, 10).map((evt: any) => (
                            <button
                              key={evt.id}
                              onClick={() => {
                                setShowEventsDropdown(false);
                                navigate(`/event/${evt.id}`);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-gray-700 text-sm truncate">{evt.name || 'Event'}</div>
                                <div className="text-[10px] text-gray-500">
                                  {evt.date ? formatDateShort(evt.date) : ''} • {evt.golfers?.length || 0} players
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                ✓ DONE
                              </span>
                            </button>
                          ))}
                          {completedChildEvents.length > 10 && (
                            <div className="text-[10px] text-gray-500 text-center py-1">
                              +{completedChildEvents.length - 10} more events
                            </div>
                          )}
                        </div>
                      )}
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
          </div>
        </>
      )}
      
      {/* Content Area - Fills remaining height, scrolls internally */}
      <div className="flex-1 overflow-auto px-4 py-2">
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
              {/* Games tab - accessible to all, admin controls shown only to owner */}
              <Route path="games" element={<GamesTab eventId={event.id} />} />
              {/* Legacy payout route - redirect to games */}
              <Route path="payout" element={<Navigate to={`/event/${event.id}/games`} replace />} />
              
              {/* Owner-only routes */}
              <Route 
                path="settings" 
                element={isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />} 
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
