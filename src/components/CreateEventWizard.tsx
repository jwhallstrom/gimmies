import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { CourseSearch } from './CourseSearch';
import { generateFunnyEventName } from '../utils/nameGenerator';
import { useCourses } from '../hooks/useCourses';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (eventId: string) => void;
  /** If provided, this event was created from a group hub. */
  parentGroupId?: string;
}

type WizardStep = 'details' | 'course';

export const CreateEventWizard: React.FC<Props> = ({ isOpen, onClose, onCreated, parentGroupId }) => {
  const navigate = useNavigate();
  const { createEvent, updateEvent, setEventCourse, setEventTee, setGroupTeeTime, addChatMessage, generateShareCode, currentProfile } =
    useStore();
  const updateProfile = useStore((s) => s.updateProfile);
  const { courses } = useCourses();
  
  const [step, setStep] = useState<WizardStep>('details');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [teeTime, setTeeTime] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedCourseName, setSelectedCourseName] = useState<string>('');
  const [selectedTeeName, setSelectedTeeName] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setEventName(generateFunnyEventName());
      setEventDate(new Date().toISOString().slice(0, 10));
      setTeeTime('');
      const homeCourseId = (currentProfile?.preferences as any)?.homeCourseId || '';
      setSelectedCourseId(homeCourseId);
      setSelectedCourseName('');
      setSelectedTeeName('');
      setIsCreating(false);
    }
  }, [isOpen]);

  // Ensure home course is always a favorite (persisted).
  useEffect(() => {
    if (!isOpen) return;
    if (!currentProfile) return;
    const homeCourseId = currentProfile.preferences?.homeCourseId;
    if (!homeCourseId) return;
    const existing = currentProfile.preferences?.favoriteCourseIds || [];
    if (existing.includes(homeCourseId)) return;
    updateProfile(currentProfile.id, {
      preferences: { ...currentProfile.preferences, favoriteCourseIds: [homeCourseId, ...existing] },
    });
  }, [isOpen, currentProfile?.id]);

  const favoriteCourseIds = currentProfile?.preferences?.favoriteCourseIds || [];
  const favoriteCourses = useMemo(() => {
    const ids = new Set(favoriteCourseIds);
    const home = currentProfile?.preferences?.homeCourseId;
    if (home) ids.add(home);
    const list = courses.filter((c) => ids.has(c.courseId));
    // Home course first, then name.
    return list.sort((a, b) => {
      if (home && a.courseId === home) return -1;
      if (home && b.courseId === home) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [courses, favoriteCourseIds, currentProfile?.preferences?.homeCourseId]);

  const toggleFavoriteCourse = (courseId: string) => {
    if (!currentProfile) return;
    const current = currentProfile.preferences?.favoriteCourseIds || [];
    const next = current.includes(courseId) ? current.filter((id) => id !== courseId) : [courseId, ...current];
    updateProfile(currentProfile.id, { preferences: { ...currentProfile.preferences, favoriteCourseIds: next } });
  };

  // Hydrate course name when we have an id (home course default) and courses are loaded.
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedCourseId) return;
    if (selectedCourseName) return;
    const c = courses.find((x) => x.courseId === selectedCourseId);
    if (c) setSelectedCourseName(c.name);
  }, [isOpen, selectedCourseId, selectedCourseName, courses]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'details') setStep('course');
  };

  const handleBack = () => {
    if (step === 'course') setStep('details');
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // 1. Create the base event
      const eventId = createEvent(parentGroupId ? ({ parentGroupId } as any) : undefined);
      if (!eventId) throw new Error('Failed to create event');

      // 2. Update basic details
      await updateEvent(eventId, {
        name: eventName,
        date: eventDate
      });

      // 3. Set Course
      if (selectedCourseId) await setEventCourse(eventId, selectedCourseId);
      if (selectedTeeName) await setEventTee(eventId, selectedTeeName);

      // 4. Tee time (optional, stored on the default play group)
      if (teeTime) {
        const created = useStore.getState().events.find((e: any) => e.id === eventId);
        const groupId = created?.groups?.[0]?.id;
        if (groupId) setGroupTeeTime(eventId, groupId, teeTime);
      }

      // 5. Navigate
      onClose();

      // If created from a group hub, announce + ensure join code exists.
      if (parentGroupId && currentProfile) {
        const shareCode = await generateShareCode(eventId);
        const when = eventDate
          ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : '';
        const tee = selectedTeeName ? ` (${selectedTeeName})` : '';
        const code = shareCode ? ` Join code: ${shareCode}` : '';
        await addChatMessage(parentGroupId, `🏌️ ${currentProfile.name} created an event: ${eventName} • ${when}${tee}.${code}`);
      }

      if (typeof onCreated === 'function') {
        onCreated(eventId);
      } else {
        // Default: land directly in the newly created event's chat hub.
        navigate(`/event/${eventId}/chat?occurrenceId=${encodeURIComponent(eventId)}`);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setIsCreating(false);
    }
  };

  const selectedCourse = courses.find(c => c.courseId === selectedCourseId);
  const tees = selectedCourse?.tees || [];

  const canCreate = Boolean(eventName.trim() && eventDate && selectedCourseId && selectedTeeName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-primary-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">New Event Setup</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close Wizard">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-1 p-2 bg-gray-50">
          <div className={`h-1 flex-1 rounded-full ${step === 'details' || step === 'course' ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'course' ? 'bg-primary-500' : 'bg-gray-200'}`} />
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          
          {step === 'details' && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Event Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Sunday Scramble"
                  />
                  <button
                    onClick={() => setEventName(generateFunnyEventName())}
                    className="bg-primary-100 text-primary-700 p-2 rounded-lg hover:bg-primary-200 transition-colors"
                    title="Generate Funny Name"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    aria-label="Event Date"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                  <button
                    onClick={() => setEventDate(new Date().toISOString().slice(0, 10))}
                    className="bg-gray-100 text-gray-700 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Set to Today"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tee Time <span className="text-xs text-gray-500 font-normal">(optional)</span>
                </label>
                <input
                  type="time"
                  aria-label="Tee Time"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={teeTime}
                  onChange={(e) => setTeeTime(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">You can change this later from the event hub.</div>
              </div>
            </div>
          )}

          {step === 'course' && (
            <div className="space-y-4 min-h-[400px] pb-20">
              <h3 className="text-xl font-semibold text-gray-800">Course & Tee</h3>
              <p className="text-sm text-gray-600">Pick the course and tees your group will play.</p>
              
              {favoriteCourses.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Favorites</div>
                    <div className="text-xs text-gray-500">Tap to select</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favoriteCourses.map((c) => {
                      const isSelected = c.courseId === selectedCourseId;
                      const isFavorite = favoriteCourseIds.includes(c.courseId) || c.courseId === currentProfile?.preferences?.homeCourseId;
                      return (
                        <button
                          key={c.courseId}
                          type="button"
                          onClick={() => {
                            setSelectedCourseId(c.courseId);
                            setSelectedCourseName(c.name);
                            // Try to auto-select preferred tee if it exists on this course.
                            const preferred = currentProfile?.preferredTee;
                            const courseTees = courses.find((x) => x.courseId === c.courseId)?.tees || [];
                            const maybe = preferred && courseTees.some((t: any) => t.name === preferred) ? preferred : '';
                            setSelectedTeeName(maybe);
                          }}
                          className={`group flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                            isSelected ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                          title={c.name}
                        >
                          <span className="font-semibold text-sm text-gray-900 truncate max-w-[180px]">{c.name}</span>
                          {c.courseId === currentProfile?.preferences?.homeCourseId && (
                            <span className="text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Home
                            </span>
                          )}
                          {/* Only allow un-favoriting if it's not the home course */}
                          {c.courseId !== currentProfile?.preferences?.homeCourseId && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleFavoriteCourse(c.courseId);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleFavoriteCourse(c.courseId);
                                }
                              }}
                              className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                                isFavorite ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                              title={isFavorite ? 'Remove favorite' : 'Add favorite'}
                            >
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <CourseSearch
                selectedCourseId={selectedCourseId}
                onSelect={(id, name) => {
                  setSelectedCourseId(id);
                  setSelectedCourseName(name);
                  // Try to auto-select preferred tee if it exists on this course.
                  const preferred = currentProfile?.preferredTee;
                  const courseTees = courses.find((x) => x.courseId === id)?.tees || [];
                  const maybe = preferred && courseTees.some((t: any) => t.name === preferred) ? preferred : '';
                  setSelectedTeeName(maybe);
                }}
              />

              {selectedCourseId && selectedCourseId !== currentProfile?.preferences?.homeCourseId && (
                <button
                  type="button"
                  onClick={() => toggleFavoriteCourse(selectedCourseId)}
                  className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 w-fit"
                >
                  ★ {favoriteCourseIds.includes(selectedCourseId) ? 'Remove from favorites' : 'Add to favorites'}
                </button>
              )}
              
              {selectedCourseId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{selectedCourseName} selected</span>
                </div>
              )}

              {/* Tee selection (inline, right after course) */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Tee</div>
                {!selectedCourseId ? (
                  <div className="text-xs text-gray-500">Select a course to see available tees.</div>
                ) : tees.length === 0 ? (
                  <div className="text-xs text-gray-500">No tee data found for this course.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {tees.map((tee: any) => (
                      <button
                        key={tee.name}
                        type="button"
                        onClick={() => setSelectedTeeName(tee.name)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedTeeName === tee.name
                            ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{tee.name}</div>
                        <div className="text-xs text-gray-500 flex gap-3 mt-1">
                          <span>Rating: {tee.courseRating || tee.rating || 'N/A'}</span>
                          <span>Slope: {tee.slopeRating || tee.slope || 'N/A'}</span>
                          <span>Par: {tee.par}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          {step !== 'details' ? (
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
            >
              Back
            </button>
          ) : (
            <div></div> // Spacer
          )}

          {step === 'details' ? (
            <button
              onClick={handleNext}
              disabled={step === 'details' && !eventName}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                (step === 'details' && !eventName)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isCreating || !canCreate}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
