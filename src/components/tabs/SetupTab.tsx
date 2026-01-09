import React from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { CourseSearch } from '../CourseSearch';
import { useCourses } from '../../hooks/useCourses';

type Props = { eventId: string };

const SetupTab: React.FC<Props> = ({ eventId }) => {
  const navigate = useNavigate();
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const { currentProfile, profiles, addGolferToEvent, updateEventGolfer } = useStore();
  const { courses } = useCourses();
  
  if (!event) return null;
  
  // Check if current user is the event owner
  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  console.log('⚙️ SetupTab: Is owner?', isOwner, 'Current profile:', currentProfile?.id, 'Owner:', event.ownerProfileId);
  
  // Get course and tee data from DynamoDB courses
  const selectedCourse = courses.find(c => c.courseId === event.course.courseId);
  const teeDetails = selectedCourse?.tees.find(t => t.name === event.course.teeName);

  const teesForCourse = selectedCourse?.tees || [];
  
  return (
    <form className="space-y-5 max-w-xl" onSubmit={e => e.preventDefault()}>
      {event.isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="font-medium">✓ Event Completed</span>
            <span className="text-xs">Event setup is read-only</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Event Name</label>
          <input
            className="w-full border border-gray-400 rounded px-2 py-1 text-sm"
            value={event.name}
            onChange={e => useStore.getState().updateEvent(eventId, { name: e.target.value })}
            placeholder="Event name"
            disabled={event.isCompleted || !isOwner}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium mb-1">Date</label>
          <input
            type="date"
            className="w-full border border-gray-400 rounded px-2 py-1 text-sm"
            value={event.date}
            onChange={e => useStore.getState().updateEvent(eventId, { date: e.target.value })}
            aria-label="Event date"
            title="Event date"
            disabled={event.isCompleted || !isOwner}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className="block text-xs font-medium mb-1">Course</label>
          <CourseSearch
            selectedCourseId={event.course.courseId}
            onSelect={(courseId) => {
              useStore.getState().setEventCourse(eventId, courseId);
            }}
            disabled={event.isCompleted || !isOwner}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Tee</label>
          <select
            className="w-full border border-gray-400 rounded px-2 py-1 text-sm"
            value={event.course.teeName || ''}
            onChange={e => useStore.getState().setEventTee(eventId, e.target.value)}
            aria-label="Tee selection"
            title="Tee selection"
            disabled={!event.course.courseId || event.isCompleted || !isOwner}
          >
            <option value="">Select tee</option>
            {teesForCourse.map((t: any) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {teeDetails && (
        <div className="text-[11px] text-primary-800 bg-primary-50 border border-primary-200 rounded p-2 flex flex-wrap gap-x-4 gap-y-1 max-w-xl">
          <span><span className="font-semibold">Tee:</span> {teeDetails.name}</span>
          <span><span className="font-semibold">CR:</span> {teeDetails.rating || teeDetails.courseRating || 'N/A'}</span>
          <span><span className="font-semibold">Slope:</span> {teeDetails.slope || teeDetails.slopeRating || 'N/A'}</span>
          <span><span className="font-semibold">Par:</span> {teeDetails.par}</span>
        </div>
      )}
      
      <div className="border rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-primary-900">Golfers</div>
            <div className="text-[11px] text-slate-600">Manage who is playing from the Golfers tab.</div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/event/${eventId}/golfers`)}
            className="text-xs px-3 py-1 rounded font-medium border bg-primary-600 text-white border-primary-700 hover:bg-primary-700"
          >
            Open Golfers
          </button>
        </div>
      </div>
      
      {/* Danger Zone */}
      {isOwner && !event.isCompleted && (
        <div className="border-t border-red-200 pt-6 mt-8">
          <h3 className="text-sm font-semibold mb-2 text-red-800">Danger Zone</h3>
          <p className="text-xs text-yellow-600 font-medium mb-3">
            Deleting this event will remove it for all players. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Are you sure you want to delete "${event.name || 'Untitled Event'}"? This will permanently delete the event, all scores, and chat messages from all devices. This action cannot be undone.`)) {
                console.log('🗑️ Deleting event:', eventId);
                await useStore.getState().deleteEvent(eventId);
                useStore.getState().addToast('Event deleted successfully', 'success');
                console.log('✅ Event deleted, navigating to home');
                navigate('/');
              }
            }}
            className="w-full py-2 px-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Event
          </button>
        </div>
      )}
    </form>
  );
};

export default SetupTab;
