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
  const { currentProfile, profiles } = useStore();
  const { courses } = useCourses();
  
  if (!event) return null;

  const isGroupHub = event.hubType === 'group';
  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  
  // Get course and tee data
  const selectedCourse = courses.find(c => c.courseId === event.course.courseId);
  const teeDetails = selectedCourse?.tees.find(t => t.name === event.course.teeName);
  const teesForCourse = selectedCourse?.tees || [];

  // Default group settings
  const groupSettings = event.groupSettings || {
    visibility: 'private' as const,
    joinPolicy: 'open' as const,
    membersCanInvite: true,
    description: '',
    location: '',
  };

  const updateGroupSettings = (updates: any) => {
    useStore.getState().updateEvent(eventId, {
      groupSettings: { ...groupSettings, ...updates }
    } as any);
  };

  // GROUP SETTINGS
  if (isGroupHub) {
    return (
      <form className="space-y-5 max-w-xl" onSubmit={(e) => e.preventDefault()}>
        {/* Group Info */}
        <div className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
              Group Info
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Group Name</label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                value={event.name}
                onChange={(e) => useStore.getState().updateEvent(eventId, { name: e.target.value })}
                placeholder="e.g., Saturday Crew"
                disabled={!isOwner}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                rows={2}
                value={groupSettings.description || ''}
                onChange={(e) => updateGroupSettings({ description: e.target.value })}
                placeholder="What's this group about?"
                disabled={!isOwner}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location (optional)</label>
              <input
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                value={groupSettings.location || ''}
                onChange={(e) => updateGroupSettings({ location: e.target.value })}
                placeholder="e.g., Chicago, IL"
                disabled={!isOwner}
              />
            </div>
          </div>
        </div>

        {/* Privacy & Access */}
        {isOwner && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-sm font-bold text-gray-900">Privacy & Access</h3>
            </div>
            
            {/* Visibility */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Group Visibility</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ visibility: 'private' })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    groupSettings.visibility === 'private'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>🔒</span>
                    <span className="font-semibold text-sm text-gray-900">Private</span>
                  </div>
                  <p className="text-xs text-gray-500">Only members can see</p>
                </button>
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ visibility: 'public' })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    groupSettings.visibility === 'public'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>🌐</span>
                    <span className="font-semibold text-sm text-gray-900">Public</span>
                  </div>
                  <p className="text-xs text-gray-500">Anyone can find it</p>
                </button>
              </div>
            </div>
            
            {/* Join Policy */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">How People Join</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ joinPolicy: 'open', membersCanInvite: true })}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    groupSettings.joinPolicy === 'open'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>✨</span>
                    <span className="font-semibold text-sm text-gray-900">Open</span>
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Recommended</span>
                  </div>
                  <p className="text-xs text-gray-500">Anyone with the link can join instantly</p>
                </button>
                
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ joinPolicy: 'request' })}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    groupSettings.joinPolicy === 'request'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>✋</span>
                    <span className="font-semibold text-sm text-gray-900">Request to Join</span>
                  </div>
                  <p className="text-xs text-gray-500">People request, you approve</p>
                </button>
                
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ joinPolicy: 'invite_only', membersCanInvite: false })}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    groupSettings.joinPolicy === 'invite_only'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>🔐</span>
                    <span className="font-semibold text-sm text-gray-900">Invite Only</span>
                  </div>
                  <p className="text-xs text-gray-500">Only you can add members</p>
                </button>
              </div>
            </div>
            
            {/* Members Can Invite Toggle */}
            {groupSettings.joinPolicy !== 'invite_only' && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-gray-900">Members can share invites</div>
                  <p className="text-xs text-gray-500">Let everyone invite friends</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateGroupSettings({ membersCanInvite: !groupSettings.membersCanInvite })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    groupSettings.membersCanInvite ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    groupSettings.membersCanInvite ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create Event */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-gray-900">Create an Event</div>
              <div className="text-xs text-gray-500">Schedule a round for this group</div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/events?create=true&returnTo=group&groupId=${encodeURIComponent(eventId)}`)}
              className="text-xs px-4 py-2 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
            >
              + Create Event
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">Members</div>
              <div className="text-xs text-gray-500">{event.golfers?.length || 0} members</div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/event/${eventId}/golfers`)}
              className="text-xs px-4 py-2 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
            >
              Manage Members
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        {isOwner && (
          <div className="border-t border-red-200 pt-6 mt-4">
            <h3 className="text-sm font-semibold mb-2 text-red-800">Danger Zone</h3>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(`Delete "${event.name || 'this group'}"? This cannot be undone.`)) {
                  await useStore.getState().deleteEvent(eventId);
                  useStore.getState().addToast('Group deleted', 'success');
                  navigate('/');
                }
              }}
              className="w-full py-2.5 px-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Group
            </button>
          </div>
        )}
      </form>
    );
  }

  // EVENT SETTINGS
  return (
    <form className="space-y-5 max-w-xl" onSubmit={e => e.preventDefault()}>
      <div className="bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase tracking-wider">Event Settings</span>
        </div>
        
        {event.isCompleted && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <span className="font-medium">✓ Event Completed</span>
              <span className="text-xs">Settings are read-only</span>
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name</label>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              value={event.name}
              onChange={e => useStore.getState().updateEvent(eventId, { name: e.target.value })}
              placeholder="Event name"
              disabled={event.isCompleted || !isOwner}
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              value={event.date}
              onChange={e => useStore.getState().updateEvent(eventId, { date: e.target.value })}
              disabled={event.isCompleted || !isOwner}
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Course & Tee</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Course</label>
            <CourseSearch
              selectedCourseId={event.course.courseId}
              onSelect={(courseId) => {
                useStore.getState().setEventCourse(eventId, courseId);
              }}
              disabled={event.isCompleted || !isOwner}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tee</label>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
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
          <div className="mt-3 text-[11px] text-primary-800 bg-primary-50 border border-primary-200 rounded-xl p-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="font-semibold">CR:</span> {teeDetails.rating || teeDetails.courseRating || 'N/A'}</span>
            <span><span className="font-semibold">Slope:</span> {teeDetails.slope || teeDetails.slopeRating || 'N/A'}</span>
            <span><span className="font-semibold">Par:</span> {teeDetails.par}</span>
          </div>
        )}
      </div>
      
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900">Golfers</div>
            <div className="text-xs text-gray-500">{event.golfers?.length || 0} players in this event</div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/event/${eventId}/golfers`)}
            className="text-xs px-4 py-2 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
          >
            Manage Golfers
          </button>
        </div>
      </div>
      
      {/* Danger Zone */}
      {isOwner && !event.isCompleted && (
        <div className="border-t border-red-200 pt-6 mt-4">
          <h3 className="text-sm font-semibold mb-2 text-red-800">Danger Zone</h3>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Delete "${event.name || 'this event'}"? This removes all scores and data.`)) {
                await useStore.getState().deleteEvent(eventId);
                useStore.getState().addToast('Event deleted', 'success');
                navigate('/');
              }
            }}
            className="w-full py-2 px-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
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
