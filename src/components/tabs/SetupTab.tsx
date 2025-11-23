import React, { useState } from 'react';
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
  
  const [golferName, setGolferName] = useState('');
  const [customTeeName, setCustomTeeName] = useState('');
  const [customHandicap, setCustomHandicap] = useState('');
  
  const courseSelected = !!event.course.courseId;
  const teeSelected = !!event.course.teeName;
  const teesForCourse = selectedCourse?.tees || [];
  
  const canAddGolfer = courseSelected && teeSelected && golferName.trim();
  
  const handleAddGolfer = () => {
    if (!canAddGolfer) return;
    
    const teeName = customTeeName || undefined;
    const handicapOverride = customHandicap ? parseFloat(customHandicap) : null;
    
    addGolferToEvent(eventId, golferName.trim(), teeName, handicapOverride);
    setGolferName('');
    setCustomTeeName('');
    setCustomHandicap('');
  };
  
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
      
      <div>
        <label className="block text-xs font-medium mb-2">Golfers</label>
        {!courseSelected || !teeSelected ? (
          <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">Select course and tee before adding golfers.</div>
        ) : null}
        
        {event.groups[0] && (
          <div className="mb-2 flex items-center gap-2 text-[11px] bg-white border border-primary-200 rounded px-2 py-1 w-fit">
            <span className="font-medium">Tee Time</span>
            <input 
              type="time" 
              value={event.groups[0].teeTime || ''} 
              onChange={e => useStore.getState().setGroupTeeTime(eventId, event.groups[0].id, e.target.value)} 
              className="border border-gray-400 rounded px-1 py-0.5 text-[11px]" 
              disabled={event.isCompleted || !isOwner}
            />
          </div>
        )}
        
        <div className="space-y-2">
          {event.golfers.map((eventGolfer: any) => {
            const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
            // Use displayName snapshot for cross-device compatibility
            const displayName = profile ? profile.name : (eventGolfer.displayName || eventGolfer.customName || 'Unknown');
            const displayInitial = displayName.charAt(0).toUpperCase();
            const handicapValue = eventGolfer.handicapOverride ?? (profile?.handicapIndex ?? eventGolfer.handicapSnapshot ?? '');
            
            if (!displayName || displayName === 'Unknown') {
              console.warn('⚠️ SetupTab: Golfer with no displayName:', eventGolfer);
            }
            
            const tees = selectedCourse?.tees || [];
            return (
              <div key={eventGolfer.profileId || eventGolfer.customName} className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {displayInitial}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{displayName}</div>
                    {profile && profile.handicapIndex && (
                      <div className="text-xs text-gray-700">Hcp Index: {profile.handicapIndex}</div>
                    )}
                    {eventGolfer.customName && (
                      <div className="text-xs text-gray-700">Custom Player</div>
                    )}
                  </div>
                </div>
                
                {tees && tees.length > 0 && (
                  <select
                    className="border border-gray-400 rounded px-2 py-1 text-xs"
                    value={eventGolfer.teeName || ''}
                    onChange={e => updateEventGolfer(eventId, eventGolfer.profileId || eventGolfer.customName, { teeName: e.target.value || undefined })}
                    disabled={event.isCompleted || !isOwner}
                  >
                    <option value="">Event Tee</option>
                    {tees.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                )}
                
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="54"
                  className="w-14 border border-gray-400 rounded px-1 py-1 text-sm text-center"
                  value={handicapValue}
                  placeholder="0.0"
                  onChange={e => {
                    const v = e.target.value;
                    updateEventGolfer(eventId, eventGolfer.profileId || eventGolfer.customName, { 
                      handicapOverride: v === '' ? null : parseFloat(v) 
                    });
                  }}
                  title="Handicap override"
                  disabled={event.isCompleted || !isOwner}
                />
                
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Remove golfer from event?')) 
                      useStore.getState().removeGolferFromEvent(eventId, eventGolfer.profileId || eventGolfer.customName);
                  }}
                  aria-label="Delete golfer"
                  title="Delete golfer"
                  className="p-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                  disabled={event.isCompleted || !isOwner}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                  </svg>
                </button>
              </div>
            );
          })}
          
          <div className="mt-3 border-t pt-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-[10px] font-medium mb-0.5">Golfer Name</label>
                <input
                  type="text"
                  className="border border-gray-400 rounded px-2 py-1 text-sm w-40"
                  value={golferName}
                  onChange={e => setGolferName(e.target.value)}
                  disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                  placeholder="Enter name"
                />
              </div>
              
              <div className="flex flex-col">
                <label className="text-[10px] font-medium mb-0.5">Tee Override</label>
                <select
                  className="border border-gray-400 rounded px-2 py-1 text-xs"
                  value={customTeeName}
                  onChange={e => setCustomTeeName(e.target.value)}
                  disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                >
                  <option value="">Event Tee ({event.course.teeName||''})</option>
                  {teesForCourse.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="text-[10px] font-medium mb-0.5">Hcp Index Override</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="54"
                  className="border border-gray-400 rounded px-1 py-1 text-sm w-14 text-center"
                  value={customHandicap}
                  onChange={e => setCustomHandicap(e.target.value)}
                  disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                  placeholder="0.0"
                />
              </div>
              
              <button
                type="button"
                disabled={!canAddGolfer || event.isCompleted || !isOwner}
                onClick={handleAddGolfer}
                className={`text-xs px-3 py-1 rounded font-medium border ${canAddGolfer && !event.isCompleted && isOwner ? 'bg-primary-600 text-white border-primary-700 hover:bg-primary-700':'bg-neutral-200 text-neutral-500 border-neutral-300 cursor-not-allowed'}`}
              >
                Add
              </button>
            </div>
            
            <div className="text-[10px] text-gray-700">
              Enter a name to add a golfer to the event. Tee and handicap can be overridden for this specific event.
            </div>
          </div>
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
