import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { courseTeesMap } from '../data/courses';
import { applyESCAdjustment } from '../utils/handicap';

const RoundDetailPage: React.FC = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { currentProfile, getProfileRounds, deleteIndividualRound, addToast } = useStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!currentProfile || !roundId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Round not found or no profile selected.</p>
        <Link to="/handicap" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
          ← Back to Handicap
        </Link>
      </div>
    );
  }

  const rounds = getProfileRounds(currentProfile.id);
  const round = rounds.find(r => r.id === roundId);

  if (!round) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Round not found.</p>
        <Link to="/handicap" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
          ← Back to Handicap
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getScoreBadgeColor = (gross: number, par: number = 4) => {
    const diff = gross - par;
    if (diff <= -3) return 'bg-fuchsia-600 text-white font-semibold'; // Albatross or better
    if (diff === -2) return 'bg-amber-500 text-black font-semibold'; // Eagle
    if (diff === -1) return 'bg-green-500 text-white font-semibold'; // Birdie
    if (diff === 0) return 'bg-neutral-50'; // Par
    if (diff === 1) return 'bg-orange-200'; // Bogey
    if (diff === 2) return 'bg-red-300 text-red-900 font-semibold'; // Double bogey
    return 'bg-red-600 text-white font-semibold'; // Triple or worse
  };

  const handleDelete = async () => {
    if (round.type === 'individual') {
      try {
        deleteIndividualRound(round.id);
        addToast('Round deleted successfully', 'success');
        navigate('/handicap');
      } catch (error) {
        console.error('Failed to delete round:', error);
        addToast('Failed to delete round', 'error');
      }
    } else {
      addToast('Event rounds cannot be deleted from here. Delete the event instead.', 'error');
    }
    setShowDeleteConfirm(false);
  };

  // Get course info
  const courseId = Object.keys(courseTeesMap).find(id => 
    courseTeesMap[id].courseName === round.courseName
  );
  const courseInfo = courseId ? courseTeesMap[courseId] : null;
  const teeInfo = courseInfo?.tees.find(t => t.name === round.teeName);
  
  // Calculate stats
  const totalPar = round.scores.reduce((sum, score) => sum + score.par, 0);
  const toPar = round.grossScore - totalPar;
  
  const holeStats = {
    birdiesOrBetter: round.scores.filter(s => s.strokes !== null && s.strokes !== undefined && s.strokes < s.par).length,
    pars: round.scores.filter(s => s.strokes === s.par).length,
    bogeys: round.scores.filter(s => s.strokes !== null && s.strokes !== undefined && s.strokes === s.par + 1).length,
    doubleBogeys: round.scores.filter(s => s.strokes !== null && s.strokes !== undefined && s.strokes === s.par + 2).length,
    triplesOrWorse: round.scores.filter(s => s.strokes !== null && s.strokes !== undefined && s.strokes >= s.par + 3).length
  };

  const front9 = round.scores.slice(0, 9);
  const back9 = round.scores.slice(9, 18);

  const front9Score = front9.reduce((sum, score) => sum + (score.strokes || 0), 0);
  const back9Score = back9.reduce((sum, score) => sum + (score.strokes || 0), 0);
  const front9Par = front9.reduce((sum, score) => sum + score.par, 0);
  const back9Par = back9.reduce((sum, score) => sum + score.par, 0);

  const getAdjustedStrokes = (score: any): number | null => {
    if (score?.strokes == null) return null;
    if (typeof score.adjustedStrokes === 'number') return score.adjustedStrokes;
    const hs = score.handicapStrokes || 0;
    return applyESCAdjustment(score.strokes, score.par, hs);
  };

  const hasCompleteScores = round.scores.every(s => typeof s.strokes === 'number');
  const adjustedGross = hasCompleteScores
    ? round.scores.reduce((sum, s) => sum + (getAdjustedStrokes(s) || 0), 0)
    : null;
  const front9Adjusted = hasCompleteScores
    ? front9.reduce((sum, s) => sum + (getAdjustedStrokes(s) || 0), 0)
    : null;
  const back9Adjusted = hasCompleteScores
    ? back9.reduce((sum, s) => sum + (getAdjustedStrokes(s) || 0), 0)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/handicap" className="text-primary-600 hover:text-primary-700">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{round.courseName}</h1>
          <p className="text-gray-800 font-medium">{formatDate(round.date)} • <span className="text-primary-700 font-semibold">{round.teeName}</span></p>
        </div>
        {round.type === 'individual' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete round"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Round Summary */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            round.type === 'event' 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {round.type === 'event' ? 'Event Round' : 'Individual Round'}
          </div>
          {round.eventName && (
            <span className="text-sm text-gray-600">• {round.eventName}</span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600">{round.grossScore}</div>
            <div className="text-sm text-gray-600">Gross Score</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className={`text-3xl font-bold ${toPar === 0 ? 'text-green-600' : toPar < 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {toPar > 0 ? `+${toPar}` : toPar}
            </div>
            <div className="text-sm text-gray-600">vs Par</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            {round.type === 'individual' ? (
              <>
                <div className="text-3xl font-bold text-primary-600">{adjustedGross ?? '--'}</div>
                <div className="text-sm text-gray-600">Adjusted Gross (WHS)</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-primary-600">{round.netScore}</div>
                <div className="text-sm text-gray-600">Net Score</div>
              </>
            )}
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-primary-600">
              {round.scoreDifferential ? round.scoreDifferential.toFixed(1) : '--'}
            </div>
            <div className="text-sm text-gray-600">Differential</div>
          </div>
        </div>

        {/* Course Details */}
        {teeInfo && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Course Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Yardage:</span>
                <span className="ml-2 font-medium">{teeInfo.yardage}y</span>
              </div>
              <div>
                <span className="text-gray-600">Par:</span>
                <span className="ml-2 font-medium">{teeInfo.par}</span>
              </div>
              <div>
                <span className="text-gray-600">Course Rating:</span>
                <span className="ml-2 font-medium">{teeInfo.courseRating}</span>
              </div>
              <div>
                <span className="text-gray-600">Slope Rating:</span>
                <span className="ml-2 font-medium">{teeInfo.slopeRating}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hole Stats */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Performance Summary</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{holeStats.birdiesOrBetter}</div>
            <div className="text-xs text-gray-600">Birdies+</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{holeStats.pars}</div>
            <div className="text-xs text-gray-600">Pars</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{holeStats.bogeys}</div>
            <div className="text-xs text-gray-600">Bogeys</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{holeStats.doubleBogeys}</div>
            <div className="text-xs text-gray-600">Doubles</div>
          </div>
          <div className="p-3 bg-red-100 rounded-lg">
            <div className="text-2xl font-bold text-red-700">{holeStats.triplesOrWorse}</div>
            <div className="text-xs text-gray-600">Triples+</div>
          </div>
        </div>
      </div>

      {/* Scorecard */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md border border-primary-900/5 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Scorecard</h3>
        
        {/* Front 9 */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-2">Front Nine</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-600">
                  <th className="text-left py-1 px-2">Hole</th>
                  {front9.map((_, i) => (
                    <th key={i + 1} className="text-center py-1 px-2 min-w-[30px]">{i + 1}</th>
                  ))}
                  <th className="text-center py-1 px-2 font-semibold">OUT</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 px-2 font-medium">Par</td>
                  {front9.map((score, i) => (
                    <td key={i} className="text-center py-2 px-2 bg-gray-100">{score.par}</td>
                  ))}
                  <td className="text-center py-2 px-2 bg-gray-200 font-semibold">{front9Par}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 px-2 font-medium">Score</td>
                  {front9.map((score, i) => (
                    <td key={i} className="text-center py-2 px-2">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${
                        score.strokes ? getScoreBadgeColor(score.strokes, score.par) : 'bg-gray-100'
                      }`}>
                        {score.strokes || '-'}
                      </div>
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 bg-gray-100 font-semibold">{front9Score}</td>
                </tr>
                {round.type === 'individual' && (
                  <tr className="border-t">
                    <td className="py-2 px-2 font-medium text-primary-700">Adj</td>
                    {front9.map((score, i) => (
                      <td key={i} className="text-center py-2 px-2 text-primary-700">
                        {getAdjustedStrokes(score) ?? '-'}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 bg-primary-50 font-semibold text-primary-700">
                      {front9Adjusted ?? '--'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back 9 */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Back Nine</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-600">
                  <th className="text-left py-1 px-2">Hole</th>
                  {back9.map((_, i) => (
                    <th key={i + 10} className="text-center py-1 px-2 min-w-[30px]">{i + 10}</th>
                  ))}
                  <th className="text-center py-1 px-2 font-semibold">IN</th>
                  <th className="text-center py-1 px-2 font-semibold">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="py-2 px-2 font-medium">Par</td>
                  {back9.map((score, i) => (
                    <td key={i} className="text-center py-2 px-2 bg-gray-100">{score.par}</td>
                  ))}
                  <td className="text-center py-2 px-2 bg-gray-200 font-semibold">{back9Par}</td>
                  <td className="text-center py-2 px-2 bg-gray-300 font-semibold">{totalPar}</td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 px-2 font-medium">Score</td>
                  {back9.map((score, i) => (
                    <td key={i} className="text-center py-2 px-2">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium ${
                        score.strokes ? getScoreBadgeColor(score.strokes, score.par) : 'bg-gray-100'
                      }`}>
                        {score.strokes || '-'}
                      </div>
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 bg-gray-100 font-semibold">{back9Score}</td>
                  <td className="text-center py-2 px-2 bg-gray-200 font-semibold">{round.grossScore}</td>
                </tr>
                {round.type === 'individual' && (
                  <tr className="border-t">
                    <td className="py-2 px-2 font-medium text-primary-700">Adj</td>
                    {back9.map((score, i) => (
                      <td key={i} className="text-center py-2 px-2 text-primary-700">
                        {getAdjustedStrokes(score) ?? '-'}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 bg-primary-50 font-semibold text-primary-700">
                      {back9Adjusted ?? '--'}
                    </td>
                    <td className="text-center py-2 px-2 bg-primary-100 font-semibold text-primary-700">
                      {adjustedGross ?? '--'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Round</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this round? This action cannot be undone and will recalculate your handicap index.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundDetailPage;