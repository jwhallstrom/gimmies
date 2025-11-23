import React, { useState, useEffect } from 'react';
import useStore from '../state/store';
import { Link, useNavigate } from 'react-router-dom';
import { getCourseById } from '../data/cloudCourses';
import { CreateEventWizard } from '../components/CreateEventWizard';

const EventsPage: React.FC = () => {
  const { events, completedEvents, currentProfile, profiles, deleteEvent, loadEventsFromCloud } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [previousCompletedCount, setPreviousCompletedCount] = useState(0);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Load events from cloud when profile is available
  useEffect(() => {
    if (currentProfile && !isLoadingEvents) {
      console.log('📥 EventsPage: Loading events from cloud for profile:', currentProfile.id);
      setIsLoadingEvents(true);
      loadEventsFromCloud().finally(() => {
        console.log('✅ EventsPage: Finished loading events from cloud');
        setIsLoadingEvents(false);
      });
    }
  }, [currentProfile?.id]);

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
    !event.isCompleted && // Exclude events marked as completed
    !completedEventIds.has(event.id) // Also exclude if event ID exists in completedEvents
  );

  // Filter completed events to only show those the current user participated in
  const userCompletedEvents = completedEvents.filter(event =>
    currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id)
  );

  if (!currentProfile) {
    return <div>Please log in to view your events.</div>;
  }

  return (
    <div className="space-y-6 relative">
      {/* Floating New Event Button */}
      <button
        onClick={() => setIsWizardOpen(true)}
        className="fixed bottom-20 right-4 z-50 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
        title="Create New Event"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <CreateEventWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />

      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
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
          
          {/* Active Events */}
          {userEvents.length > 0 ? (
            <div className="space-y-3">
              {userEvents.map(event => {
                const isOwner = currentProfile.id === event.ownerProfileId;
                return (
                  <div key={event.id} className="bg-white/90 backdrop-blur rounded-lg p-4 shadow-md border border-primary-900/5 relative">
                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete "${event.name || 'Untitled Event'}"? This will permanently delete the event, all scores, and chat messages from all devices. This action cannot be undone.`)) {
                          deleteEvent(event.id);
                        }
                      }}
                      className="absolute top-3 right-3 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                      title="Delete Event"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <div className="flex flex-col pr-8">
                      <div className="font-semibold text-primary-800">{event.name || 'Untitled Event'}</div>
                      <div className="text-sm text-gray-600">
                        {event.date} • {event.golfers.length} players
                        {event.course.courseId && ` • ${getCourseById(event.course.courseId)?.name || event.course.courseId}`}
                      </div>
                      {isOwner && (
                        <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded w-fit mt-1">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <Link
                        to={`/event/${event.id}`}
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        Open Event
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">No active events</div>
              <div className="text-sm">Create your first event to get started!</div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {/* Completed Events */}
          {userCompletedEvents.length > 0 ? (
            <div className="space-y-3">
              {userCompletedEvents.map(event => {
                const isOwner = currentProfile.id === event.ownerProfileId;
                return (
                  <div key={event.id} className="bg-green-50/90 backdrop-blur rounded-lg p-4 shadow-md border border-green-200 relative">
                    {/* Completed Badge */}
                    <div className="absolute top-3 right-3">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                        ✓ Completed
                      </span>
                    </div>

                    <div className="flex flex-col pr-8">
                      <div className="font-semibold text-green-800">
                        {event.name || 'Untitled Event'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {event.date} • {event.golfers.length} players
                        {event.course.courseId && ` • ${getCourseById(event.course.courseId)?.name || event.course.courseId}`}
                        {event.completedAt && ` • Completed ${new Date(event.completedAt).toLocaleDateString()}`}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {isOwner && (
                          <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          Read-only
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Link
                        to={`/event/${event.id}`}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        View Results
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-lg mb-2">No completed events</div>
              <div className="text-sm">Completed events will appear here after you finish them.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventsPage;