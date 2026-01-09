import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import useStore from '../../state/store';
import { useCourses } from '../../hooks/useCourses';

type Props = { eventId: string };

const GolfersTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) =>
    s.events.find((e: any) => e.id === eventId) ||
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const { currentProfile, profiles, addGolferToEvent, updateEventGolfer, setGroupTeeTime } = useStore();
  const { courses, loading: coursesLoading } = useCourses();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [golferName, setGolferName] = useState('');
  const [customTeeName, setCustomTeeName] = useState('');
  const [customHandicap, setCustomHandicap] = useState('');

  if (!event) return null;

  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;

  const selectedCourse = useMemo(
    () => courses.find((c: any) => c.courseId === event.course.courseId),
    [courses, event.course.courseId]
  );

  const courseSelected = !!event.course.courseId;
  const teeSelected = !!event.course.teeName;
  const teesForCourse = selectedCourse?.tees || [];

  const canAddGolfer = courseSelected && teeSelected && golferName.trim();

  const handleAddGolfer = async () => {
    if (!canAddGolfer || event.isCompleted || !isOwner) return;

    const teeName = customTeeName || undefined;
    const handicapOverride = customHandicap ? parseFloat(customHandicap) : null;

    await addGolferToEvent(eventId, golferName.trim(), teeName, handicapOverride);

    setGolferName('');
    setCustomTeeName('');
    setCustomHandicap('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-4 max-w-xl">
      {event.isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="font-medium">✓ Event Completed</span>
            <span className="text-xs">Golfers are read-only</span>
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-primary-900">Golfers</h2>
            <div className="text-[11px] text-slate-600">Who is playing in this event</div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
            className={`text-xs px-3 py-1 rounded font-medium border ${
              courseSelected && teeSelected && !event.isCompleted && isOwner
                ? 'bg-primary-600 text-white border-primary-700 hover:bg-primary-700'
                : 'bg-neutral-200 text-neutral-500 border-neutral-300 cursor-not-allowed'
            }`}
          >
            Add Golfer
          </button>
        </div>

        {!courseSelected || !teeSelected ? (
          <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            Select course and tee in{' '}
            <NavLink to="../settings" className="underline">Settings</NavLink>
            {' '}before adding golfers.
          </div>
        ) : null}

        {event.groups[0] && (
          <div className="mt-2 flex items-center gap-2 text-[11px] bg-white border border-primary-200 rounded px-2 py-1 w-fit">
            <span className="font-medium">Tee Time</span>
            <input
              type="time"
              value={event.groups[0].teeTime || ''}
              onChange={e => setGroupTeeTime(eventId, event.groups[0].id, e.target.value)}
              className="border border-gray-400 rounded px-1 py-0.5 text-[11px]"
              aria-label="Tee time"
              title="Tee time"
              disabled={event.isCompleted || !isOwner}
            />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {event.golfers.map((eventGolfer: any) => {
            const profile = eventGolfer.profileId ? profiles.find((p: any) => p.id === eventGolfer.profileId) : null;
            const displayName = profile ? profile.name : (eventGolfer.displayName || eventGolfer.customName || 'Unknown');
            const displayInitial = displayName.charAt(0).toUpperCase();
            const handicapValue = eventGolfer.handicapOverride ?? (profile?.handicapIndex ?? eventGolfer.handicapSnapshot ?? '');

            const tees = selectedCourse?.tees || [];
            const golferKey = eventGolfer.profileId || eventGolfer.customName;

            return (
              <div key={golferKey} className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {displayInitial}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900">{displayName}</div>
                    {profile && profile.handicapIndex != null && (
                      <div className="text-xs text-slate-600">Hcp Index: {profile.handicapIndex}</div>
                    )}
                    {eventGolfer.customName && (
                      <div className="text-xs text-slate-600">Custom Player</div>
                    )}
                  </div>
                </div>

                {tees && tees.length > 0 && (
                  <select
                    className="border border-gray-400 rounded px-2 py-1 text-xs"
                    value={eventGolfer.teeName || ''}
                    onChange={e => updateEventGolfer(eventId, golferKey, { teeName: e.target.value || undefined })}
                    aria-label={`${displayName} tee override`}
                    title={`${displayName} tee override`}
                    disabled={event.isCompleted || !isOwner}
                  >
                    <option value="">Event Tee</option>
                    {tees.map((t: any) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
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
                    updateEventGolfer(eventId, golferKey, { handicapOverride: v === '' ? null : parseFloat(v) });
                  }}
                  title="Handicap override"
                  disabled={event.isCompleted || !isOwner}
                />

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Remove golfer from event?')) {
                      useStore.getState().removeGolferFromEvent(eventId, golferKey);
                    }
                  }}
                  aria-label="Delete golfer"
                  title="Delete golfer"
                  className="p-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-slate-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div>
                <div className="font-semibold text-sm text-primary-900">Add Golfer</div>
                <div className="text-[11px] text-slate-600">Add a manual golfer to this event</div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100"
                aria-label="Close"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {!courseSelected || !teeSelected ? (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  Select course and tee in{' '}
                  <NavLink to="../settings" className="underline" onClick={() => setIsAddOpen(false)}>
                    Settings
                  </NavLink>
                  {' '}first.
                </div>
              ) : null}

              <div className="flex flex-col">
                <label className="text-[10px] font-medium mb-0.5">Golfer Name</label>
                <input
                  type="text"
                  className="border border-gray-400 rounded px-2 py-1 text-sm"
                  value={golferName}
                  onChange={e => setGolferName(e.target.value)}
                  disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                  placeholder="Enter name"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <label className="text-[10px] font-medium mb-0.5">Tee Override</label>
                  <select
                    className="border border-gray-400 rounded px-2 py-1 text-xs"
                    value={customTeeName}
                    onChange={e => setCustomTeeName(e.target.value)}
                    aria-label="Tee override"
                    title="Tee override"
                    disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                  >
                    <option value="">Event Tee ({event.course.teeName || ''})</option>
                    {teesForCourse.map((t: any) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-medium mb-0.5">Hcp Index Override</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="54"
                    className="border border-gray-400 rounded px-2 py-1 text-sm text-center"
                    value={customHandicap}
                    onChange={e => setCustomHandicap(e.target.value)}
                    disabled={!courseSelected || !teeSelected || event.isCompleted || !isOwner}
                    placeholder="0.0"
                  />
                </div>
              </div>

              <div className="text-[10px] text-gray-700">
                Tee and handicap can be overridden for this specific event.
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                disabled={!canAddGolfer || event.isCompleted || !isOwner}
                onClick={handleAddGolfer}
                className={`text-xs px-3 py-1 rounded font-medium border ${
                  canAddGolfer && !event.isCompleted && isOwner
                    ? 'bg-primary-600 text-white border-primary-700 hover:bg-primary-700'
                    : 'bg-neutral-200 text-neutral-500 border-neutral-300 cursor-not-allowed'
                }`}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GolfersTab;
