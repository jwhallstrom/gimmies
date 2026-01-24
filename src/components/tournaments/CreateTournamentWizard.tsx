/**
 * CreateTournamentWizard - Multi-step wizard for creating tournaments
 * Follows the CreateEventWizard pattern for consistent UX
 */

import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../state/store';
import { CourseSearch } from '../CourseSearch';
import { useCourses } from '../../hooks/useCourses';
import type { TournamentFormat, TournamentVisibility } from '../../state/types';

interface Props {
  onClose: () => void;
  onCreated?: (tournamentId: string) => void;
}

type WizardStep = 'details' | 'course' | 'settings';

const formatOptions: { value: TournamentFormat; label: string; description: string }[] = [
  { value: 'stroke', label: 'Stroke Play', description: 'Total strokes, lowest wins' },
  { value: 'stableford', label: 'Stableford', description: 'Points-based scoring' },
  { value: 'scramble', label: 'Scramble', description: 'Team best ball' },
  { value: 'best_ball', label: 'Best Ball', description: 'Team low score per hole' },
  { value: 'match_play', label: 'Match Play', description: 'Hole-by-hole competition' },
  { value: 'skins', label: 'Skins', description: 'Win hole outright to win skin' },
];

const visibilityOptions: { value: TournamentVisibility; label: string; description: string }[] = [
  { value: 'public', label: 'Public', description: 'Anyone can find and join' },
  { value: 'private', label: 'Private', description: 'Invite only, hidden from discover' },
  { value: 'invite_only', label: 'Invite with Code', description: 'Requires passcode to join' },
];

const CreateTournamentWizard: React.FC<Props> = ({ onClose, onCreated }) => {
  const { createTournament, currentProfile } = useStore();
  const { courses } = useCourses();
  
  const [step, setStep] = useState<WizardStep>('details');
  const [isCreating, setIsCreating] = useState(false);
  
  // Step 1: Details
  const [name, setName] = useState('');
  const [dates, setDates] = useState<string[]>([new Date().toISOString().split('T')[0]]);
  const [rounds, setRounds] = useState(1);
  const [description, setDescription] = useState('');
  
  // Step 2: Course
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedTeeName, setSelectedTeeName] = useState('');
  
  // Step 3: Settings
  const [format, setFormat] = useState<TournamentFormat>('stroke');
  const [visibility, setVisibility] = useState<TournamentVisibility>('public');
  const [passcode, setPasscode] = useState('');
  const [entryFee, setEntryFee] = useState('0');
  const [maxPlayers, setMaxPlayers] = useState('72');
  const [hasBettingOverlay, setHasBettingOverlay] = useState(false);
  
  // Generate a tournament name suggestion
  const generateName = () => {
    const adjectives = ['Spring', 'Summer', 'Fall', 'Winter', 'Classic', 'Championship', 'Open', 'Invitational', 'Masters', 'Cup'];
    const nouns = ['Tournament', 'Open', 'Classic', 'Championship', 'Cup', 'Invitational'];
    const year = new Date().getFullYear();
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun} ${year}`;
  };
  
  // Initialize with a generated name
  useEffect(() => {
    setName(generateName());
  }, []);
  
  // Get selected course details
  const selectedCourse = useMemo(() => 
    courses.find(c => c.courseId === selectedCourseId),
    [courses, selectedCourseId]
  );
  const tees = selectedCourse?.tees || [];
  
  // Validation
  const canProceedFromDetails = name.trim().length > 0 && dates.length > 0;
  const canProceedFromCourse = selectedCourseId && selectedTeeName;
  const canCreate = canProceedFromDetails && canProceedFromCourse;
  
  const handleNext = () => {
    if (step === 'details') setStep('course');
    else if (step === 'course') setStep('settings');
  };
  
  const handleBack = () => {
    if (step === 'course') setStep('details');
    else if (step === 'settings') setStep('course');
  };
  
  const handleAddDate = () => {
    const lastDate = dates[dates.length - 1];
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setDates([...dates, nextDate.toISOString().split('T')[0]]);
    setRounds(dates.length + 1);
  };
  
  const handleRemoveDate = (index: number) => {
    if (dates.length <= 1) return;
    const newDates = dates.filter((_, i) => i !== index);
    setDates(newDates);
    setRounds(newDates.length);
  };
  
  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    
    try {
      const tournamentId = createTournament({
        name: name.trim(),
        dates,
        rounds,
        description: description.trim(),
        courseId: selectedCourseId,
        courseName: selectedCourseName,
        format,
        visibility,
        passcode: visibility === 'invite_only' ? passcode : undefined,
        entryFeeCents: Math.round(parseFloat(entryFee) * 100),
        maxPlayers: parseInt(maxPlayers, 10) || 72,
        hasBettingOverlay,
      });
      
      if (tournamentId) {
        onCreated?.(tournamentId);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
    } finally {
      setIsCreating(false);
    }
  };
  
  const stepIndex = step === 'details' ? 0 : step === 'course' ? 1 : 2;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-primary-600 p-4 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Create Tournament</h2>
            <p className="text-sm text-white/70">
              {step === 'details' && 'Basic Information'}
              {step === 'course' && 'Course Selection'}
              {step === 'settings' && 'Tournament Settings'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="flex gap-1 p-2 bg-gray-50">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          
          {/* Step 1: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g. Spring Championship 2026"
                  />
                  <button
                    type="button"
                    onClick={() => setName(generateName())}
                    className="bg-primary-100 text-primary-700 p-2 rounded-lg hover:bg-primary-200 transition-colors"
                    title="Generate Name"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Date(s)
                </label>
                <div className="space-y-2">
                  {dates.map((date, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-16">
                        Round {index + 1}
                      </span>
                      <input
                        type="date"
                        value={date}
                        onChange={e => {
                          const newDates = [...dates];
                          newDates[index] = e.target.value;
                          setDates(newDates);
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      {dates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddDate}
                    className="w-full py-2 text-sm font-medium text-primary-600 border border-dashed border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    + Add Another Round
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder="Tell players what to expect..."
                />
              </div>
            </div>
          )}
          
          {/* Step 2: Course */}
          {step === 'course' && (
            <div className="space-y-4">
              <CourseSearch
                selectedCourseId={selectedCourseId}
                onSelect={(id, courseName) => {
                  setSelectedCourseId(id);
                  setSelectedCourseName(courseName);
                  setSelectedTeeName('');
                }}
              />
              
              {selectedCourseId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-800">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium truncate">{selectedCourseName}</span>
                </div>
              )}
              
              {/* Tee selection */}
              {selectedCourseId && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Select Tee</label>
                  {tees.length === 0 ? (
                    <p className="text-sm text-gray-500">No tee data available for this course.</p>
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
              )}
            </div>
          )}
          
          {/* Step 3: Settings */}
          {step === 'settings' && (
            <div className="space-y-5">
              {/* Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {formatOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        format === opt.value
                          ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-gray-900 text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                <div className="space-y-2">
                  {visibilityOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        visibility === opt.value
                          ? 'bg-primary-50 border-primary-500 ring-1 ring-primary-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium text-gray-900 text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.description}</div>
                    </button>
                  ))}
                </div>
                
                {visibility === 'invite_only' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Passcode</label>
                    <input
                      type="text"
                      value={passcode}
                      onChange={e => setPasscode(e.target.value.toUpperCase())}
                      placeholder="e.g. SPRING2026"
                      maxLength={12}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                    />
                  </div>
                )}
              </div>
              
              {/* Entry Fee & Max Players */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entry Fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={entryFee}
                      onChange={e => setEntryFee(e.target.value)}
                      min="0"
                      step="5"
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={maxPlayers}
                    onChange={e => setMaxPlayers(e.target.value)}
                    min="4"
                    max="200"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              {/* Betting Overlay */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBettingOverlay}
                    onChange={e => setHasBettingOverlay(e.target.checked)}
                    className="mt-1 h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Enable Gimmies Games</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      Add optional Nassau, Skins, and side games. Configure after creating.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          {step !== 'details' ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          
          {step === 'settings' ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !canCreate}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isCreating || !canCreate
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
              }`}
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Tournament'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={
                (step === 'details' && !canProceedFromDetails) ||
                (step === 'course' && !canProceedFromCourse)
              }
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                (step === 'details' && !canProceedFromDetails) ||
                (step === 'course' && !canProceedFromCourse)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateTournamentWizard;
