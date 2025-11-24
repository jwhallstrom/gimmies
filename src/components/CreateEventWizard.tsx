import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { CourseSearch } from './CourseSearch';
import { generateFunnyEventName } from '../utils/nameGenerator';
import { useCourses } from '../hooks/useCourses';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'details' | 'course' | 'tee' | 'review';

export const CreateEventWizard: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { createEvent, updateEvent, setEventCourse, setEventTee } = useStore();
  const { courses } = useCourses();
  
  const [step, setStep] = useState<WizardStep>('details');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
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
      setSelectedCourseId('');
      setSelectedCourseName('');
      setSelectedTeeName('');
      setIsCreating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'details') setStep('course');
    else if (step === 'course') setStep('tee');
    else if (step === 'tee') setStep('review');
  };

  const handleBack = () => {
    if (step === 'course') setStep('details');
    else if (step === 'tee') setStep('course');
    else if (step === 'review') setStep('tee');
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      // 1. Create the base event
      const eventId = createEvent();
      if (!eventId) throw new Error('Failed to create event');

      // 2. Update basic details
      await updateEvent(eventId, {
        name: eventName,
        date: eventDate
      });

      // 3. Set Course
      if (selectedCourseId) {
        await setEventCourse(eventId, selectedCourseId);
        
        // 4. Set Tee (if selected)
        if (selectedTeeName) {
          await setEventTee(eventId, selectedTeeName);
        }
      }

      // 5. Navigate
      onClose();
      navigate(`/event/${eventId}`);
    } catch (error) {
      console.error('Error creating event:', error);
      setIsCreating(false);
    }
  };

  const selectedCourse = courses.find(c => c.courseId === selectedCourseId);
  const tees = selectedCourse?.tees || [];

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
          <div className={`h-1 flex-1 rounded-full ${step === 'details' || step === 'course' || step === 'tee' || step === 'review' ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'course' || step === 'tee' || step === 'review' ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'tee' || step === 'review' ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step === 'review' ? 'bg-primary-500' : 'bg-gray-200'}`} />
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
            </div>
          )}

          {step === 'course' && (
            <div className="space-y-4 min-h-[400px] pb-20">
              <h3 className="text-xl font-semibold text-gray-800">Select Course</h3>
              <p className="text-sm text-gray-600">Where are you playing?</p>
              
              <CourseSearch
                selectedCourseId={selectedCourseId}
                onSelect={(id, name) => {
                  setSelectedCourseId(id);
                  setSelectedCourseName(name);
                  setSelectedTeeName(''); // Reset tee when course changes
                }}
              />
              
              {selectedCourseId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{selectedCourseName} selected</span>
                </div>
              )}
            </div>
          )}

          {step === 'tee' && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Select Tee</h3>
              <p className="text-sm text-gray-600">Which tees will the group play?</p>
              
              {!selectedCourseId ? (
                <div className="text-red-500 bg-red-50 p-3 rounded-lg">Please select a course first.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {tees.length > 0 ? (
                    tees.map((tee: any) => (
                      <button
                        key={tee.name}
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
                    ))
                  ) : (
                    <div className="text-gray-500 italic">No tee information available for this course.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800">Ready to Play?</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Event</div>
                  <div className="font-medium text-lg text-primary-900">{eventName || 'Untitled Event'}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Date</div>
                  <div className="font-medium text-gray-900">{new Date(eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Course</div>
                  <div className="font-medium text-gray-900">{selectedCourseName || 'No course selected'}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tees</div>
                  <div className="font-medium text-gray-900">{selectedTeeName || 'No tee selected'}</div>
                </div>
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

          {step !== 'review' ? (
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
              disabled={isCreating}
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
