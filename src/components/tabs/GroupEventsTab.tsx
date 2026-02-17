import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { CreateEventWizard } from '../CreateEventWizard';
import { getCourseById } from '../../data/cloudCourses';

interface GroupEventsTabProps {
  eventId: string;
}

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getDateBadge = (dateStr: string): { text: string; color: string } | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr);
  eventDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: 'TODAY', color: 'bg-red-500 text-white' };
  if (diffDays === 1) return { text: 'TOMORROW', color: 'bg-orange-500 text-white' };
  if (diffDays > 1 && diffDays <= 7) return { text: `IN ${diffDays} DAYS`, color: 'bg-primary-100 text-primary-700' };
  return null;
};

const countStrokesEntered = (event: any): number =>
  (event.scorecards || []).reduce(
    (total: number, sc: any) =>
      total + ((sc.scores || []).filter((s: any) => s?.strokes != null).length || 0),
    0
  );

const GroupEventsTab: React.FC<GroupEventsTabProps> = ({ eventId }) => {
  const navigate = useNavigate();
  const currentProfile = useStore((s) => s.currentProfile);
  const joinEventByCode = useStore((s) => s.joinEventByCode);
  const generateShareCode = useStore((s) => s.generateShareCode);
  const addToast = useStore((s: any) => s.addToast);

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { activeEvents, completedEvents } = useStore((s) => {
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    const groupEvents = allEvents.filter(
      (e: any) => e.hubType !== 'group' && e.parentGroupId === eventId
    );

    const active = groupEvents
      .filter((e: any) => !e.isCompleted)
      .sort(
        (a: any, b: any) =>
          new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );

    const completed = groupEvents
      .filter((e: any) => e.isCompleted)
      .sort(
        (a: any, b: any) =>
          new Date(b.completedAt || b.lastModified).getTime() -
          new Date(a.completedAt || a.lastModified).getTime()
      );

    return { activeEvents: active, completedEvents: completed };
  });

  const { liveEvents, upcomingEvents } = useMemo(() => {
    const live: any[] = [];
    const upcoming: any[] = [];
    activeEvents.forEach((e: any) => {
      if (countStrokesEntered(e) > 0) live.push(e);
      else upcoming.push(e);
    });
    upcoming.sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return { liveEvents: live, upcomingEvents: upcoming };
  }, [activeEvents]);

  const handleJoin = async (evt: any) => {
    if (joiningId) return;
    setJoiningId(evt.id);
    try {
      const code = evt.shareCode || (await generateShareCode(evt.id));
      if (!code) throw new Error('Missing join code');
      const result = await joinEventByCode(code);
      if (!result.success) throw new Error(result.error || 'Failed to join');
      addToast?.('Joined event!', 'success');
      navigate(`/event/${evt.id}`);
    } catch (e: any) {
      addToast?.(e?.message || 'Could not join event', 'error');
    } finally {
      setJoiningId(null);
    }
  };

  const isInEvent = (evt: any) =>
    currentProfile && evt.golfers?.some((g: any) => g.profileId === currentProfile.id);

  return (
    <div className="space-y-4">
      {/* Schedule Event CTA */}
      <button
        onClick={() => setShowCreateEvent(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all active:scale-[0.98]"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Schedule Event
      </button>

      {/* Empty state */}
      {activeEvents.length === 0 && completedEvents.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <div className="font-bold text-gray-800 text-lg mb-1">No events yet</div>
          <p className="text-sm text-gray-500">
            Schedule an event for your group and invite members to play.
          </p>
        </div>
      )}

      {/* Live / In Progress */}
      {liveEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Live ({liveEvents.length})
            </h3>
          </div>
          <div className="space-y-2">
            {liveEvents.map((evt: any) => (
              <EventCard
                key={evt.id}
                evt={evt}
                status="live"
                isJoined={!!isInEvent(evt)}
                joiningId={joiningId}
                onJoin={() => handleJoin(evt)}
                onOpen={() => navigate(`/event/${evt.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📅</span>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Upcoming ({upcomingEvents.length})
            </h3>
          </div>
          <div className="space-y-2">
            {upcomingEvents.map((evt: any) => (
              <EventCard
                key={evt.id}
                evt={evt}
                status="upcoming"
                isJoined={!!isInEvent(evt)}
                joiningId={joiningId}
                onJoin={() => handleJoin(evt)}
                onOpen={() => navigate(`/event/${evt.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {completedEvents.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>📜</span>
              <span>
                History ({completedEvents.length})
              </span>
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2">
              {completedEvents.slice(0, 15).map((evt: any) => (
                <EventCard
                  key={evt.id}
                  evt={evt}
                  status="completed"
                  isJoined={!!isInEvent(evt)}
                  joiningId={null}
                  onJoin={() => {}}
                  onOpen={() => navigate(`/event/${evt.id}`)}
                />
              ))}
              {completedEvents.length > 15 && (
                <div className="text-[10px] text-gray-500 text-center py-1">
                  +{completedEvents.length - 15} more events
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Event Wizard */}
      <CreateEventWizard
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        parentGroupId={eventId}
        onCreated={(newEventId) => {
          setShowCreateEvent(false);
          navigate(`/event/${newEventId}`);
        }}
      />
    </div>
  );
};

// Individual event card
const EventCard: React.FC<{
  evt: any;
  status: 'live' | 'upcoming' | 'completed';
  isJoined: boolean;
  joiningId: string | null;
  onJoin: () => void;
  onOpen: () => void;
}> = ({ evt, status, isJoined, joiningId, onJoin, onOpen }) => {
  const courseName = evt.course?.courseId
    ? getCourseById(evt.course.courseId)?.name
    : null;
  const playerCount = evt.golfers?.length || 0;
  const dateBadge = status === 'upcoming' && evt.date ? getDateBadge(evt.date) : null;
  const isJoining = joiningId === evt.id;

  const cardStyle =
    status === 'live'
      ? 'bg-red-50 border-l-4 border-l-red-500 border-y border-r border-red-200'
      : status === 'completed'
      ? 'bg-gray-50 border border-gray-200'
      : 'bg-white border border-gray-200';

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-xl p-3 transition-all active:scale-[0.99] ${cardStyle}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm truncate">
              {evt.name || 'Untitled Event'}
            </span>
            {status === 'live' && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full uppercase">
                Live
              </span>
            )}
            {status === 'completed' && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-300 text-gray-700 rounded-full">
                Done
              </span>
            )}
            {dateBadge && (
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${dateBadge.color}`}>
                {dateBadge.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <span>{formatDateShort(evt.date)}</span>
            {courseName && (
              <>
                <span className="text-gray-300">·</span>
                <span className="truncate">{courseName}</span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span>{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Right side: action or chevron */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {status !== 'completed' && !isJoined && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoin();
              }}
              disabled={isJoining}
              className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
            >
              {isJoining ? '...' : 'Join'}
            </button>
          )}
          {isJoined && status !== 'completed' && (
            <span className="px-2 py-0.5 text-[9px] font-bold text-green-700 bg-green-100 rounded-full">
              Joined
            </span>
          )}
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default GroupEventsTab;
