import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../state/store';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getCourseById, getHole } from '../data/cloudCourses';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { useAuthMode } from '../hooks/useAuthMode';
import type { Event } from '../state/types';

// Format date short
const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Count actual strokes entered
const countStrokesEntered = (event: Event): number => {
  return event.scorecards.reduce((total, sc) => {
    return total + (sc.scores?.filter((s: any) => s?.strokes != null).length || 0);
  }, 0);
};

// Check if event is live (has scores being entered)
const isEventLive = (event: Event): boolean => {
  if (event.isCompleted) return false;
  return countStrokesEntered(event) > 0;
};

const EventsPage: React.FC = () => {
  const { events, completedEvents, currentProfile, profiles, deleteEvent, loadEventsFromCloud } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuthMode();
  const addToast = useStore((s: any) => s.addToast);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [previousCompletedCount, setPreviousCompletedCount] = useState(0);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Helper to get parent group name for group child events
  const getParentGroupName = (event: any) => {
    if (!event.parentGroupId) return null;
    const parentGroup = events.find((e: any) => e.id === event.parentGroupId && e.hubType === 'group');
    return parentGroup?.name || 'Group';
  };

  // Load events from cloud when profile is available
  useEffect(() => {
    if (currentProfile && !isLoadingEvents && !isGuest) {
      console.log('📥 EventsPage: Loading events from cloud for profile:', currentProfile.id);
      setIsLoadingEvents(true);
      loadEventsFromCloud().finally(() => {
        console.log('✅ EventsPage: Finished loading events from cloud');
        setIsLoadingEvents(false);
      });
    }
  }, [currentProfile?.id, isGuest]);

  // Support deep-linking into event creation (e.g. from Chat hub): /events?create=true&returnTo=chat
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldCreate = params.get('create') === 'true';
    if (shouldCreate && !isGuest) setIsWizardOpen(true);
  }, [location.search, isGuest]);

  // Auto-switch to history tab when a new event is completed
  useEffect(() => {
    const currentCompletedCount = completedEvents.filter(event =>
      currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id)
    ).length;

    if (currentCompletedCount > previousCompletedCount && previousCompletedCount > 0) {
      setActiveTab('history');
    }
    setPreviousCompletedCount(currentCompletedCount);
  }, [completedEvents.length, currentProfile, previousCompletedCount]);

  // Filter events to only show ACTIVE events the current user is participating in
  // Double-check: exclude any events that are marked completed OR exist in completedEvents array
  const completedEventIds = new Set(completedEvents.map(e => e.id));
  const userEvents = events.filter(event =>
    currentProfile && 
    event.golfers.some(golfer => golfer.profileId === currentProfile.id) &&
    event.hubType !== 'group' &&
    !event.isCompleted && // Exclude events marked as completed
    !completedEventIds.has(event.id) // Also exclude if event ID exists in completedEvents
  );

  // Split active events into Live vs Upcoming
  const { liveEvents, upcomingEvents } = useMemo(() => {
    const live: Event[] = [];
    const upcoming: Event[] = [];
    
    userEvents.forEach(e => {
      if (isEventLive(e)) {
        live.push(e);
      } else {
        upcoming.push(e);
      }
    });
    
    // Sort live by recent activity, upcoming by date
    live.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    upcoming.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { liveEvents: live, upcomingEvents: upcoming };
  }, [userEvents]);

  // Filter completed events to only show those the current user participated in
  const userCompletedEvents = completedEvents.filter(event =>
    currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id) && event.hubType !== 'group'
  );

  if (!currentProfile) {
    return <div>Please log in to view your events.</div>;
  }

  return (
    <div className="space-y-6 relative">
      {/* Floating New Event Button */}
      <button
        onClick={() => {
          if (isGuest) {
            addToast?.('Sign in to create events', 'error', 2500);
            return;
          }
          setIsWizardOpen(true);
        }}
        className="fixed bottom-20 right-4 z-50 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
        title="Create New Event"
        disabled={isGuest}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <CreateEventWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        parentGroupId={new URLSearchParams(location.search).get('groupId') || undefined}
        onCreated={(eventId) => {
          const params = new URLSearchParams(location.search);
          const returnTo = params.get('returnTo');
          const groupId = params.get('groupId');
          if (returnTo === 'group' && groupId) {
            navigate(`/event/${groupId}/chat`);
            return;
          }
          if (returnTo === 'chat') {
            navigate(`/event/${eventId}/chat?occurrenceId=${encodeURIComponent(eventId)}`);
            return;
          }
          navigate(`/event/${eventId}`);
        }}
      />

      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary-800">My Events</h1>
            <p className="text-gray-600 mt-1">
          {userEvents.length > 0 && userCompletedEvents.length > 0 
            ? `${userEvents.length} active, ${userCompletedEvents.length} completed`
            : userEvents.length > 0 
              ? `${userEvents.length} active event${userEvents.length !== 1 ? 's' : ''}`
              : userCompletedEvents.length > 0
                ? `${userCompletedEvents.length} completed event${userCompletedEvents.length !== 1 ? 's' : ''}`
                : 'Events you\'re participating in'
          }
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isGuest) {
                addToast?.('Sign in to join events', 'error', 2500);
                return;
              }
              navigate('/join');
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-orange-500 hover:from-orange-500 hover:to-accent text-white font-extrabold shadow-md"
            title="Join an event with a code"
            disabled={isGuest}
          >
            Join Event
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            Active ({userEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            History ({userCompletedEvents.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'active' && (
        <>
          {/* Loading Indicator */}
          {isLoadingEvents && (
            <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading events from cloud...
            </div>
          )}
          
          {/* Empty State */}
          {userEvents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-lg mb-2 text-gray-600">No active events</div>
              <div className="text-sm text-gray-500">Create your first event to get started!</div>
            </div>
          )}

          {/* 🔴 LIVE Section */}
          {liveEvents.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Live</h3>
                <span className="text-xs text-gray-500">({liveEvents.length})</span>
              </div>
              <div className="space-y-3">
                {liveEvents.map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    profiles={profiles}
                    currentProfile={currentProfile}
                    status="live"
                    parentGroupId={event.parentGroupId}
                    parentGroupName={getParentGroupName(event)}
                    onDelete={deleteEvent}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 📅 UPCOMING Section */}
          {upcomingEvents.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">📅</span>
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Upcoming</h3>
                <span className="text-xs text-gray-500">({upcomingEvents.length})</span>
              </div>
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    profiles={profiles}
                    currentProfile={currentProfile}
                    status="upcoming"
                    parentGroupId={event.parentGroupId}
                    parentGroupName={getParentGroupName(event)}
                    onDelete={deleteEvent}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {/* Completed Events */}
          {userCompletedEvents.length > 0 ? (
            <div className="space-y-3">
              {userCompletedEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  profiles={profiles}
                  currentProfile={currentProfile}
                  status="completed"
                  parentGroupId={event.parentGroupId}
                  parentGroupName={getParentGroupName(event)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-lg mb-2 text-gray-600">No completed events</div>
              <div className="text-sm text-gray-500">Completed events will appear here after you finish them.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Event Card Component with leader stats
const EventCard: React.FC<{
  event: Event;
  profiles: any[];
  currentProfile: any;
  status: 'live' | 'upcoming' | 'completed';
  parentGroupId?: string | null;
  parentGroupName?: string | null;
  onDelete?: (id: string) => void;
}> = ({ event, profiles, currentProfile, status, parentGroupId, parentGroupName, onDelete }) => {
  const navigate = useNavigate();
  
  const golferCount = event.golfers.length;
  const courseId = event.course?.courseId;
  const teeName = event.course?.teeName;
  const isOwner = currentProfile?.id === event.ownerProfileId;
  
  // Calculate leaderboard with positions, scores, and thru
  const leaderboard = useMemo(() => {
    const rows = event.scorecards.map(sc => {
      const scores = Array.isArray(sc?.scores) ? sc.scores : [];
      const holesCompleted = scores.filter((s: any) => s?.strokes != null).length;
      
      // Calculate gross and par
      const gross = scores.reduce((sum: number, s: any) => sum + (typeof s?.strokes === 'number' ? s.strokes : 0), 0);
      const parSoFar = scores.reduce((sum: number, s: any) => {
        if (s?.strokes == null) return sum;
        const holeNo = Number(s.hole);
        const hole = courseId ? getHole(courseId, holeNo, teeName) : undefined;
        const par = typeof hole?.par === 'number' ? hole.par : 4;
        return sum + par;
      }, 0);
      
      const toPar = holesCompleted === 0 ? null : (courseId ? gross - parSoFar : null);
      const isFinal = holesCompleted >= 18;
      
      // Get golfer name
      const eventGolfer = (event.golfers || []).find((g: any) => g.profileId === sc.golferId || g.customName === sc.golferId);
      const profile = eventGolfer?.profileId ? (profiles || []).find((p: any) => p.id === eventGolfer.profileId) : null;
      const name = profile?.name || eventGolfer?.displayName || eventGolfer?.customName || 'Unknown';
      
      return { golferId: sc.golferId, name, toPar, thru: holesCompleted, isFinal };
    });
    
    // Sort by score (lowest first), then by progress
    rows.sort((a, b) => {
      if (typeof a.toPar === 'number' && typeof b.toPar === 'number' && a.toPar !== b.toPar) return a.toPar - b.toPar;
      if ((b.thru || 0) !== (a.thru || 0)) return (b.thru || 0) - (a.thru || 0);
      return a.name.localeCompare(b.name);
    });
    
    // Add positions with ties
    return rows.map((row, idx) => {
      const betterCount = rows.slice(0, idx).filter(r => typeof r.toPar === 'number' && typeof row.toPar === 'number' && r.toPar < row.toPar).length;
      const position = betterCount + 1;
      const isTied = rows.filter(r => typeof r.toPar === 'number' && typeof row.toPar === 'number' && r.toPar === row.toPar).length > 1;
      return { ...row, position, isTied };
    });
  }, [event.scorecards, event.golfers, profiles, courseId, teeName]);
  
  const leader = leaderboard[0];
  
  // Format score to par
  const formatToPar = (score: number | null) => {
    if (score === null) return '';
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };
  
  // Format position with tie indicator
  const formatPosition = (pos: number, isTied: boolean) => {
    return isTied ? `T${pos}` : `${pos}`;
  };
  
  // Format thru status
  const formatThru = (thru: number, isFinal: boolean) => {
    if (isFinal || thru >= 18) return 'F';
    return `Thru ${thru}`;
  };
  
  // Style variations based on status
  const cardStyles = {
    live: 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500 border-y border-r border-red-200',
    upcoming: 'bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300',
    completed: 'bg-gray-50 hover:bg-gray-100 border border-gray-200',
  };
  
  const style = cardStyles[status];
  
  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className={`w-full text-left rounded-xl p-4 transition-all group ${style} relative`}
    >
      {/* Delete button for active events */}
      {onDelete && status !== 'completed' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Are you sure you want to delete "${event.name || 'Untitled Event'}"? This will permanently delete the event, all scores, and chat messages from all devices. This action cannot be undone.`)) {
              onDelete(event.id);
            }
          }}
          className="absolute top-3 right-3 text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-100 transition-colors z-10"
          title="Delete Event"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      
      <div className="flex items-center justify-between pr-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">
              {event.name || 'Untitled Event'}
            </span>
            {status === 'live' && (
              <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full uppercase">
                Live
              </span>
            )}
            {status === 'completed' && (
              <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full uppercase">
                Final
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 flex-wrap">
            <span>{formatDateShort(event.date)}</span>
            <span className="text-gray-300">•</span>
            <span>{golferCount} golfer{golferCount !== 1 ? 's' : ''}</span>
            {parentGroupId && parentGroupName && (
              <>
                <span className="text-gray-300">•</span>
                <Link
                  to={`/event/${parentGroupId}/chat`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded hover:bg-purple-200 transition-colors"
                >
                  <span>👥</span>
                  <span className="truncate max-w-[140px]">{parentGroupName}</span>
                </Link>
              </>
            )}
            {(status === 'live' || status === 'completed') && leader && leader.thru > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className={status === 'live' ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
                  {formatThru(leader.thru, leader.isFinal)} {formatToPar(leader.toPar)}
                </span>
              </>
            )}
            {isOwner && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-primary-600 text-xs">Owner</span>
              </>
            )}
          </div>
        </div>
        
        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

export default EventsPage;