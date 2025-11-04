import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { IndividualRound, ScoreEntry } from '../types/handicap';
import { calculateCourseHandicap, distributeHandicapStrokes, calculateNetScore, applyESCAdjustment, calculateScoreDifferential } from '../utils/handicap';
import { useCourses } from '../hooks/useCourses';

const AddScorePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentProfile, addIndividualRound, addToast } = useStore();

  const [formData, setFormData] = useState({
    courseId: '', // cloud courseId token
    teeName: '',
    date: new Date().toISOString().split('T')[0],
    grossScore: 0,
    scores: [] as ScoreEntry[]
  });

  const [step, setStep] = useState<'course' | 'score' | 'complete'>('course');

  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load cloud courses
  const { courses, searchCourses } = useCourses();
  const selectedCourse = useMemo(() => courses.find(c => c.courseId === formData.courseId), [courses, formData.courseId]);
  const selectedTee = selectedCourse?.tees.find(t => t.name === formData.teeName);

  // Simple client-side filter for course search. Limits results to 50 for performance.
  const filteredCourses = useMemo(() => {
    const q = query.trim();
    const list = q ? searchCourses(q) : courses;
    return list.slice(0, 50);
  }, [query, courses, searchCourses]);

  // Select course (do not auto-advance). Tee must be selected next.
  const handleCourseSelect = (courseId: string) => {
    setFormData(prev => ({ 
      ...prev, 
      courseId, 
      teeName: '',
      scores: [] 
    }));
  };

  const handleScoreSubmit = (grossScore: number) => {
    if (!selectedCourse || !selectedTee || !currentProfile) return;
    
    // Calculate course handicap for stroke allocation
    const courseHandicap = calculateCourseHandicap(
      currentProfile.handicapIndex || 0,
      selectedTee.slopeRating ?? 113,
      (selectedTee.courseRating ?? selectedTee.par ?? 72),
      selectedTee.par ?? 72
    );

    // Initialize scores with course data
    const scores = (selectedTee.holes || Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 })) ).map((hole) => ({
      hole: hole.number,
      par: hole.par,
      strokes: Math.ceil(grossScore / 18), // Rough distribution to start
      handicapStrokes: hole.strokeIndex <= courseHandicap ? 1 : 0
    }));

    setFormData(prev => ({ 
      ...prev, 
      grossScore,
      scores 
    }));
    setStep('complete');
  };

  const handleSubmit = async () => {
    if (!currentProfile || !selectedCourse || !selectedTee) {
      addToast('Missing required data', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Calculate course handicap
      const courseHandicap = calculateCourseHandicap(
        currentProfile.handicapIndex || 0,
        selectedTee.slopeRating ?? 113,
        (selectedTee.courseRating ?? selectedTee.par ?? 72),
        selectedTee.par ?? 72
      );

      // Ensure all hole scores are present to compute differential
  const holes = selectedTee.holes || [];
      const scoreMap: Record<number, number | null> = {};
      (formData.scores || []).forEach(s => { scoreMap[s.hole] = s.strokes ?? null; });
      const missing = holes.some(h => scoreMap[h.number] == null);
      if (missing) {
        addToast('Please enter all hole scores to calculate handicap differential', 'error');
        setIsSaving(false);
        return;
      }

      // Distribute handicap strokes and apply ESC per hole, then compute adjusted gross
  const strokeDistribution = distributeHandicapStrokes(courseHandicap, formData.courseId, formData.teeName);
      let adjustedGross = 0;
      const enrichedScores = holes.map(h => {
        const raw = scoreMap[h.number] as number;
        const handicapStrokes = strokeDistribution[h.number] || 0;
        const adjusted = applyESCAdjustment(raw, h.par, handicapStrokes);
        adjustedGross += adjusted;
        return {
          hole: h.number,
          par: h.par,
          strokes: raw,
          handicapStrokes,
          netStrokes: calculateNetScore(raw, handicapStrokes)
        } as ScoreEntry;
      });

      // Calculate score differential using adjusted gross
  const differential = calculateScoreDifferential(adjustedGross, (selectedTee.courseRating ?? selectedTee.par ?? 72), (selectedTee.slopeRating ?? 113));

      const round: Omit<IndividualRound, 'id' | 'createdAt'> = {
        profileId: currentProfile.id,
        courseId: formData.courseId,
        teeName: formData.teeName,
        date: formData.date,
        scores: enrichedScores,
        grossScore: formData.grossScore,
        netScore: formData.grossScore - courseHandicap,
        scoreDifferential: differential,
        courseRating: (selectedTee.courseRating ?? selectedTee.par ?? 72) as number,
        slopeRating: (selectedTee.slopeRating ?? 113) as number,
        courseHandicap
      } as Omit<IndividualRound, 'id' | 'createdAt'>;

  console.debug('Saving individual round', round);
      const newId = addIndividualRound(round);
      console.debug('addIndividualRound returned id:', newId);

      addToast('Round added successfully!', 'success');

      // Ensure a tick for state propagation before navigating (guards against rare race conditions)
      await new Promise(resolve => setTimeout(resolve, 0));
      navigate('/handicap');
    } catch (err) {
      console.error('Failed to save round', err);
      addToast('Failed to save round', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please create a profile to add rounds.</p>
      </div>
    );
  }

  if (step === 'course') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/handicap" className="text-primary-600 hover:text-primary-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-primary-800">Add New Round</h1>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h2 className="text-lg font-semibold mb-4">Select Course & Tees</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Course</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Start typing a course name..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="max-h-72 overflow-auto">
              {filteredCourses.length === 0 ? (
                <div className="text-sm text-gray-500">No courses found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredCourses.map(course => {
                    const isSelected = formData.courseId === course.courseId;
                    return (
                      <div
                        key={course.courseId}
                        className={`p-3 border ${isSelected ? 'border-primary-600 bg-primary-50' : 'border-gray-200'} rounded-lg transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="font-medium">{course.name}</div>
                            <div className="text-sm text-gray-500">{course.tees?.[0]?.holes?.length || 18} holes</div>
                          </div>
                          {isSelected ? (
                            <span className="text-xs px-2 py-1 rounded bg-primary-600 text-white">Selected</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCourseSelect(course.courseId)}
                              className="text-sm text-primary-700 border border-primary-200 hover:border-primary-400 px-3 py-1 rounded"
                            >
                              Select
                            </button>
                          )}
                        </div>

                        {isSelected && (
                          <div className="pt-3">
                            <label htmlFor={`tee-select-${course.courseId}`} className="block text-sm font-medium text-gray-700 mb-2">Choose Tees</label>
                            <select
                              id={`tee-select-${course.courseId}`}
                              value={formData.teeName}
                              onChange={(e) => setFormData(prev => ({ ...prev, teeName: e.target.value }))}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            >
                              <option value="">-- Choose tees --</option>
                              {course.tees.map(tee => (
                                <option key={tee.name} value={tee.name}>{`${tee.name}${tee.yardage ? ` — ${tee.yardage}y` : ''} • Par ${tee.par} • ${(tee.courseRating ?? tee.par ?? 72)}/${(tee.slopeRating ?? 113)}`}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={() => {
                  if (!formData.courseId) {
                    addToast('Please select a course', 'error');
                    return;
                  }
                  if (!formData.teeName) {
                    addToast('Please select tees for the course', 'error');
                    return;
                  }
                  setStep('score');
                }}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'score') {
    // Hole-by-hole entry using stacked layout (front/back stacked vertically)
  const coursePar = selectedTee?.par || 72;
  const holes = selectedTee?.holes || Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4, strokeIndex: i + 1 }));

    // compute course handicap and stroke distribution
  const courseHandicap = calculateCourseHandicap(currentProfile?.handicapIndex || 0, selectedTee?.slopeRating || 113, selectedTee?.courseRating || coursePar, coursePar);
  const strokeDistribution = selectedCourse ? distributeHandicapStrokes(courseHandicap, selectedCourse.courseId, formData.teeName) : {};

    const front = holes.slice(0, 9);
    const back = holes.slice(9);

    const updateHole = (holeNumber: number, value: number | null) => {
      setFormData(prev => {
        const nextScores = [...prev.scores];
        const idx = nextScores.findIndex(s => s.hole === holeNumber);
        const handicapStrokes = strokeDistribution[holeNumber] || 0;
        const entry = {
          hole: holeNumber,
          par: holes.find(h => h.number === holeNumber)?.par || 4,
          strokes: value,
          handicapStrokes,
          netStrokes: value != null ? calculateNetScore(value, handicapStrokes) : undefined
        };
        if (idx === -1) nextScores.push(entry);
        else nextScores[idx] = entry;
        return { ...prev, scores: nextScores };
      });
    };

    const grossSum = formData.scores.reduce((a, s) => a + (s.strokes || 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setStep('course')}
            className="text-primary-600 hover:text-primary-700"
            aria-label="Back to course selection"
            title="Back to course selection"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-primary-800">Enter Hole-by-Hole Score</h1>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900">{selectedCourse?.name}</h3>
            <p className="text-sm text-gray-600">{selectedTee?.name} • {selectedTee?.yardage}y • Par {coursePar}</p>
          </div>

          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-600">Front Nine</div>
            <div className="space-y-0.5">
              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-600 py-1">Hole</div>
                {front.map(h => (
                  <div key={h.number} className="w-7 text-[10px] font-semibold text-slate-600 py-1 text-center">{h.number}</div>
                ))}
                <div className="w-8 text-[10px] font-semibold text-slate-600 py-1 text-center ml-0.5">Out</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-600 py-1">Par</div>
                {front.map(h => (
                  <div key={h.number} className="w-7 text-[10px] text-slate-600 py-1 text-center bg-slate-100 rounded">{h.par}</div>
                ))}
                <div className="w-8 text-[10px] text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 font-semibold">{front.reduce((a, h) => a + h.par, 0)}</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-700 py-1">Score</div>
                {front.map(h => {
                  const s = formData.scores.find(ss => ss.hole === h.number);
                  const gross = s?.strokes ?? '';
                  const handicapStrokes = strokeDistribution[h.number] || 0;
                  const diff = typeof gross === 'number' ? gross - h.par : null;
                  let colorClass = '';
                  if (diff != null) {
                    if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                    else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                    else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                    else if (diff === 0) colorClass = 'bg-neutral-50';
                    else if (diff === 1) colorClass = 'bg-orange-200';
                    else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                    else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                  }
                  return (
                    <div key={h.number} className="w-7 relative">
                      {handicapStrokes > 0 && (
                        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                          {Array.from({ length: handicapStrokes }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-primary-700 block"></span>
                          ))}
                        </div>
                      )}
                      <input
                        className={`w-full h-7 px-0.5 py-0 text-center text-[10px] outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition rounded ${colorClass} ${handicapStrokes > 0 ? 'pl-2' : ''}`}
                        value={gross}
                        inputMode="numeric"
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const numeric = raw === '' ? null : parseInt(raw, 10);
                          updateHole(h.number, numeric);
                          // auto-advance if necessary
                          const shouldAdvance = (raw.length === 1 && raw !== '1') || raw.length === 2;
                          if (shouldAdvance) {
                            const next = document.querySelector(`input[data-hole='${h.number + 1}']`) as HTMLInputElement | null;
                            if (next) requestAnimationFrame(() => { next.focus(); next.select(); });
                          }
                        }}
                        data-hole={h.number}
                      />
                    </div>
                  );
                })}
                <div className="w-8 text-[10px] py-1 text-center font-semibold bg-slate-100 rounded ml-0.5">{(() => {
                  const frontScores = formData.scores.filter(s => s.hole <= 9).map(s => s.strokes || 0);
                  return frontScores.length === 9 ? frontScores.reduce((a, b) => a + b, 0) : frontScores.reduce((a, b) => a + b, 0);
                })()}</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-medium text-primary-700 py-1">Net</div>
                {front.map(h => {
                  const s = formData.scores.find(ss => ss.hole === h.number);
                  const net = s?.netStrokes ?? '';
                  return (
                    <div key={`net-${h.number}`} className="w-7 text-[10px] py-1 text-center text-primary-700 font-medium">{net !== undefined ? net : ''}</div>
                  );
                })}
                <div className="w-8 text-[10px] py-1 text-center font-medium text-primary-700 bg-primary-50 rounded ml-0.5">{''}</div>
              </div>
            </div>

            {/* Back nine - similar layout */}
            <div className="text-xs font-semibold text-slate-600">Back Nine</div>
            <div className="space-y-0.5">
              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-600 py-1">Hole</div>
                {back.map(h => (
                  <div key={h.number} className="w-7 text-[10px] font-semibold text-slate-600 py-1 text-center">{h.number}</div>
                ))}
                <div className="w-8 text-[10px] font-semibold text-slate-600 py-1 text-center ml-0.5">In</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-600 py-1">Par</div>
                {back.map(h => (
                  <div key={h.number} className="w-7 text-[10px] text-slate-600 py-1 text-center bg-slate-100 rounded">{h.par}</div>
                ))}
                <div className="w-8 text-[10px] text-slate-600 py-1 text-center bg-slate-200 rounded ml-0.5 font-semibold">{back.reduce((a, h) => a + h.par, 0)}</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-semibold text-slate-700 py-1">Score</div>
                {back.map(h => {
                  const s = formData.scores.find(ss => ss.hole === h.number);
                  const gross = s?.strokes ?? '';
                  const handicapStrokes = strokeDistribution[h.number] || 0;
                  const diff = typeof gross === 'number' ? gross - h.par : null;
                  let colorClass = '';
                  if (diff != null) {
                    if (diff <= -3) colorClass = 'bg-fuchsia-600 text-white font-semibold';
                    else if (diff === -2) colorClass = 'bg-amber-500 text-black font-semibold';
                    else if (diff === -1) colorClass = 'bg-green-500 text-white font-semibold';
                    else if (diff === 0) colorClass = 'bg-neutral-50';
                    else if (diff === 1) colorClass = 'bg-orange-200';
                    else if (diff === 2) colorClass = 'bg-red-300 text-red-900 font-semibold';
                    else if (diff >= 3) colorClass = 'bg-red-600 text-white font-semibold';
                  }
                  return (
                    <div key={h.number} className="w-7 relative">
                      {handicapStrokes > 0 && (
                        <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5 z-10">
                          {Array.from({ length: handicapStrokes }).map((_, i) => (
                            <span key={i} className="w-1 h-1 rounded-full bg-primary-700 block"></span>
                          ))}
                        </div>
                      )}
                      <input
                        className={`w-full h-7 px-0.5 py-0 text-center text-[10px] outline-none focus:ring-2 focus:ring-primary-300 focus:bg-primary-50/70 transition rounded ${colorClass} ${handicapStrokes > 0 ? 'pl-2' : ''}`}
                        value={gross}
                        inputMode="numeric"
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const numeric = raw === '' ? null : parseInt(raw, 10);
                          updateHole(h.number, numeric);
                          const shouldAdvance = (raw.length === 1 && raw !== '1') || raw.length === 2;
                          if (shouldAdvance) {
                            const next = document.querySelector(`input[data-hole='${h.number + 1}']`) as HTMLInputElement | null;
                            if (next) requestAnimationFrame(() => { next.focus(); next.select(); });
                          }
                        }}
                        data-hole={h.number}
                      />
                    </div>
                  );
                })}
                <div className="w-8 text-[10px] py-1 text-center font-semibold bg-slate-100 rounded ml-0.5">{(() => {
                  const backScores = formData.scores.filter(s => s.hole >= 10).map(s => s.strokes || 0);
                  return backScores.length === 9 ? backScores.reduce((a, b) => a + b, 0) : backScores.reduce((a, b) => a + b, 0);
                })()}</div>
              </div>

              <div className="flex gap-0.5">
                <div className="w-10 text-[10px] font-medium text-primary-700 py-1">Net</div>
                {back.map(h => {
                  const s = formData.scores.find(ss => ss.hole === h.number);
                  const net = s?.netStrokes ?? '';
                  return (
                    <div key={`net-${h.number}`} className="w-7 text-[10px] py-1 text-center text-primary-700 font-medium">{net !== undefined ? net : ''}</div>
                  );
                })}
                <div className="w-8 text-[10px] py-1 text-center font-medium text-primary-700 bg-primary-50 rounded ml-0.5">{''}</div>
              </div>
            </div>

            <div className="pt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">{grossSum}</div>
                  <div className="text-sm text-gray-600">Gross Score</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">{selectedTee?.courseRating || '--'}</div>
                  <div className="text-sm text-gray-600">Course Rating</div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    // ensure at least some scores entered
                    if ((formData.scores || []).length === 0) {
                      addToast('Please enter at least one hole score', 'error');
                      return;
                    }
                    // compute gross
                    const gross = formData.scores.reduce((a, s) => a + (s.strokes || 0), 0);
                    setFormData(prev => ({ ...prev, grossScore: gross }));
                    setStep('complete');
                  }}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Review Round
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Complete step - show summary and save
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setStep('score')}
          className="text-primary-600 hover:text-primary-700"
          aria-label="Back to score entry"
          title="Back to score entry"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-primary-800">Review Round</h1>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        {(() => {
          // Precompute adjusted gross and differential preview
          const coursePar = selectedTee?.par || 72;
          const courseRating = selectedTee?.courseRating ?? coursePar;
          const slopeRating = selectedTee?.slopeRating ?? 113;
          const ch = calculateCourseHandicap(currentProfile?.handicapIndex || 0, slopeRating, courseRating, coursePar);
          const holes = selectedTee?.holes || [];
          const dist = selectedCourse ? distributeHandicapStrokes(ch, selectedCourse.courseId, formData.teeName) : {};
          const scoreMap: Record<number, number | null> = {};
          (formData.scores || []).forEach(s => { scoreMap[s.hole] = s.strokes ?? null; });
          let adj = 0;
          holes.forEach(h => {
            const raw = scoreMap[h.number];
            if (typeof raw === 'number') {
              const hs = dist[h.number] || 0;
              adj += applyESCAdjustment(raw, h.par, hs);
            }
          });
          const diff = holes.length > 0 ? calculateScoreDifferential(adj, courseRating, slopeRating) : undefined;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-primary-600">{formData.grossScore}</div>
                <div className="text-sm text-gray-600">Gross Score</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-primary-600">{formData.grossScore - (selectedTee?.par || 72)}</div>
                <div className="text-sm text-gray-600">vs Par</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-primary-600">{selectedTee?.courseRating || '--'}</div>
                <div className="text-sm text-gray-600">Course Rating</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-primary-600">{selectedTee?.slopeRating || '--'}</div>
                <div className="text-sm text-gray-600">Slope Rating</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg col-span-2 md:col-span-2">
                <div className="text-2xl font-bold text-primary-600">{adj || '--'}</div>
                <div className="text-sm text-gray-600">Adjusted Gross (WHS)</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg col-span-2 md:col-span-2">
                <div className="text-2xl font-bold text-primary-600">{diff ?? '--'}</div>
                <div className="text-sm text-gray-600">Score Differential (uses adjusted)</div>
              </div>
            </div>
          );
        })()}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900">{selectedCourse?.name}</h3>
          <p className="text-sm text-gray-600">
            {selectedTee?.name} • {formData.date}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This round will be added to your handicap history and used for handicap index calculations.
          </p>
          
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${isSaving ? 'bg-primary-300 text-white cursor-wait' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
            type="button"
          >
            {isSaving ? 'Saving…' : 'Save Round'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddScorePage;