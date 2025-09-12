import React from 'react';
import useStore from '../state/store';
import { Link, useNavigate } from 'react-router-dom';

const EventsPage: React.FC = () => {
  const { events, currentProfile, profiles, deleteEvent } = useStore();
  const navigate = useNavigate();

  // Filter events to only show those the current user is participating in
  const userEvents = events.filter(event =>
    currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id)
  );

  if (!currentProfile) {
    return <div>Please log in to view your events.</div>;
  }

  return (
    <div className="space-y-6 relative">
      {/* Floating New Event Button */}
      <button
        onClick={() => {
          const eventId = useStore.getState().createEvent();
          if (eventId) {
            navigate(`/event/${eventId}`);
          }
        }}
        className="fixed bottom-20 right-4 z-50 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
        title="Create New Event"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <h1 className="text-2xl font-bold text-primary-800">My Events</h1>
        <p className="text-gray-600 mt-1">Events you're participating in</p>
      </div>

      {userEvents.length > 0 ? (
        <div className="space-y-3">
          {userEvents.map(event => {
            const isOwner = currentProfile.id === event.ownerProfileId;
            return (
              <div key={event.id} className="bg-white/90 backdrop-blur rounded-lg p-4 shadow-md border border-primary-900/5 relative">
                {/* Delete Button */}
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete "${event.name || 'Untitled Event'}"? This action cannot be undone.`)) {
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
                    {event.course.courseId && ` • ${event.course.courseId}`}
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
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">No events yet</div>
          <div className="text-sm">Create your first event or join one with a share code!</div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;