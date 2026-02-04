/**
 * EventPage - Instagram-style swipeable Event Hub
 * 
 * Key features:
 * - Horizontal swipe navigation between pages (scroll-snap)
 * - Dot indicators showing current page
 * - Tab order: Chat → Leaderboard → Games → Golfers → Settings
 * - Message composer only visible on Chat page
 * - Mobile-first with smooth native feel
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { useEventSync } from '../hooks/useEventSync';
import SetupTab from '../components/tabs/SetupTab';
import ScoreHubTab from '../components/tabs/ScoreHubTab';
import GolfersTab from '../components/tabs/GolfersTab';
import GamesTab from '../components/tabs/GamesTab';
import ChatTab from '../components/tabs/ChatTab';
import ShareModal from '../components/ShareModal';
import EventNotifications from '../components/EventNotifications';
import { getCourseById } from '../data/cloudCourses';

// Mark group chat as read (stores in localStorage)
const LAST_READ_KEY = 'gimmies.chatLastRead.v1';
function markChatAsRead(groupId: string) {
  try {
    const current = JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
    current[groupId] = new Date().toISOString();
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const EventPage: React.FC = () => {
  const { id } = useParams();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEventsDropdown, setShowEventsDropdown] = useState(false);
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

  // Swipeable page index state
  const [activePageIndex, setActivePageIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Define tabs based on hub type
  // ORDER: Chat → Leaderboard → Games/Payouts → Golfers → Settings (most used first)
  const tabs = isGroupHub
    ? [
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'golfers', label: 'Members', icon: '👥', badge: stats.golferCount },
        { id: 'events', label: 'Events', icon: '🎯', badge: activeChildEvents.length || undefined, isModal: true },
        ...(isOwner ? [
          { id: 'alerts', label: 'Alerts', icon: '🔔', isModal: true },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ] : []),
      ]
    : [
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'scorecard', label: 'Leaderboard', icon: '🏆' },
        { id: 'games', label: 'Games', icon: '🎯' },
        { id: 'golfers', label: 'Golfers', icon: '👥', badge: stats.golferCount },
        ...(isOwner ? [
          { id: 'alerts', label: 'Alerts', icon: '🔔', isModal: true },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ] : []),
      ];
  
  // Filter out modal-only tabs for swipeable pages
  const swipeableTabs = tabs.filter(t => !t.isModal);
  
  // Handle scroll to update active page index
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const pageWidth = container.clientWidth;
    const newIndex = Math.round(scrollLeft / pageWidth);
    if (newIndex !== activePageIndex && newIndex >= 0 && newIndex < swipeableTabs.length) {
      setActivePageIndex(newIndex);
    }
  }, [activePageIndex, swipeableTabs.length]);
  
  // Scroll to page when tab is clicked
  const scrollToPage = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const pageWidth = container.clientWidth;
    container.scrollTo({ left: index * pageWidth, behavior: 'smooth' });
    setActivePageIndex(index);
  }, []);

  const handleDelete = () => {
    if (window.confirm(`Delete "${event.name}"? This cannot be undone.`)) {
      deleteEvent(id!);
      navigate('/');
    }
  };

  // Determine if on chat page (for showing composer)
  const isChatPage = activePageIndex === 0;
  
  // Mark group chat as read when viewing chat tab
  useEffect(() => {
    if (isGroupHub && isChatPage && event?.id) {
      markChatAsRead(event.id);
    }
  }, [isGroupHub, isChatPage, event?.id]);
  
  // Icon-only tabs (no labels): saves space and removes sideways scrolling.
  const tabPillClass =
    'flex items-center justify-center w-10 h-10 rounded-xl font-semibold text-[11px] transition-all flex-shrink-0';
  const tabBarClass = 'flex gap-1.5 px-3 pb-1 -mx-3 justify-center';

  return (
    <div className="h-full min-h-0 -mx-4 -mt-4 flex flex-col">
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
        
        {/* Tab Navigation - Icon buttons */}
        <div className={tabBarClass}>
          {tabs.map((tab, index) => {
            // Find the swipeable index for this tab (or -1 if modal-only)
            const swipeIndex = swipeableTabs.findIndex(t => t.id === tab.id);
            const isActive = swipeIndex === activePageIndex;
            const badge = tab.badge as number | undefined;
            
            // Alerts tab opens modal
            if (tab.id === 'alerts') {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowNotifications(true)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`relative ${tabPillClass} bg-white/10 text-white/85 hover:bg-white/20 hover:text-white`}
                >
                  <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                </button>
              );
            }
            
            // Events tab (groups) opens dropdown
            if (tab.id === 'events') {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowEventsDropdown(!showEventsDropdown)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`relative ${tabPillClass} ${
                    showEventsDropdown
                      ? 'bg-white text-primary-800 shadow-sm'
                      : badge && badge > 0
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                  {typeof badge === 'number' && badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center bg-white/30 text-white">
                      {badge}
                    </span>
                  )}
                </button>
              );
            }
            
            // Regular swipeable tab
            return (
              <button
                key={tab.id}
                onClick={() => scrollToPage(swipeIndex)}
                aria-label={tab.label}
                title={tab.label}
                className={`relative ${tabPillClass} ${
                  isActive
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                {typeof badge === 'number' && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center ${
                    isActive ? 'bg-primary-100 text-primary-800' : 'bg-white/20 text-white'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Dot Indicators - Instagram style */}
        <div className="flex justify-center gap-1.5 pb-2">
          {swipeableTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => scrollToPage(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === activePageIndex
                  ? 'bg-white w-3'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to ${tab.label}`}
            />
          ))}
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
      
      {/* Swipeable Content Area - Horizontal scroll-snap */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Hide scrollbar */}
        <style>{`.snap-x::-webkit-scrollbar { display: none; }`}</style>
        
        {swipeableTabs.map((tab) => (
          <div 
            key={tab.id}
            className="w-full flex-shrink-0 snap-center overflow-y-auto"
            style={{ minWidth: '100%' }}
          >
            <div className="h-full px-4 py-2">
              {tab.id === 'chat' && <ChatTab eventId={event.id} />}
              {tab.id === 'scorecard' && <ScoreHubTab eventId={event.id} />}
              {tab.id === 'games' && <GamesTab eventId={event.id} />}
              {tab.id === 'golfers' && <GolfersTab eventId={event.id} />}
              {tab.id === 'settings' && (isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />)}
            </div>
          </div>
        ))}
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
