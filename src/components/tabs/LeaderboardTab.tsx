import React, { useState, useEffect } from 'react';
import useStore from '../../state/store';
import { courseMap } from '../../data/courses';

type Props = { eventId: string };

const LeaderboardTab: React.FC<Props> = ({ eventId }) => {
  const { profiles } = useStore();
  const event = useStore((s: any) => s.events.find((e: any) => e.id === eventId));
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && viewMode === 'full') {
        setViewMode('compact');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [viewMode]);

  if (!event) return null;

  const course = event.course.courseId ? courseMap[event.course.courseId] : null;
  const holes = course ? course.holes : Array.from({ length: 18 }).map((_, i) => ({ number: i + 1, par: 4 }));

  // Calculate total par for the course
  const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0);

  // Calculate scores for each golfer
  const leaderboardData = event.golfers.map((eventGolfer: any) => {
    const profile = eventGolfer.profileId ? profiles.find(p => p.id === eventGolfer.profileId) : null;
    const displayName = profile ? profile.name : eventGolfer.customName;
    const golferId = eventGolfer.profileId || eventGolfer.customName;

    // Find the scorecard for this golfer
    const scorecard = event.scorecards.find((sc: any) =>
      sc.golferId === eventGolfer.profileId || sc.golferId === eventGolfer.customName
    );

    if (!scorecard) {
      return {
        id: golferId,
        name: displayName,
        totalScore: null,
        totalStrokes: 0,
        toPar: null,
        front9Score: null,
        back9Score: null,
        holesPlayed: 0
      };
    }

    // Calculate scores
    let totalStrokes = 0;
    let holesPlayed = 0;
    let front9Strokes = 0;
    let back9Strokes = 0;
    let front9Holes = 0;
    let back9Holes = 0;

    scorecard.scores.forEach((score: any) => {
      if (score.strokes != null) {
        totalStrokes += score.strokes;
        holesPlayed++;

        if (score.hole <= 9) {
          front9Strokes += score.strokes;
          front9Holes++;
        } else {
          back9Strokes += score.strokes;
          back9Holes++;
        }
      }
    });

    const toPar = holesPlayed === 18 ? totalStrokes - totalPar : null;
    const front9Score = front9Holes === 9 ? front9Strokes - holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0) : null;
    const back9Score = back9Holes === 9 ? back9Strokes - holes.slice(9).reduce((sum, h) => sum + h.par, 0) : null;

    return {
      id: golferId,
      name: displayName,
      totalScore: holesPlayed === 18 ? totalStrokes : null,
      totalStrokes,
      toPar,
      front9Score,
      back9Score,
      holesPlayed
    };
  });

  // Sort by total score (ascending), then by holes played (descending)
  const sortedLeaderboard = leaderboardData
    .filter((player: any) => player.totalScore !== null)
    .sort((a: any, b: any) => {
      if (a.totalScore !== b.totalScore) {
        return a.totalScore! - b.totalScore!;
      }
      return b.holesPlayed - a.holesPlayed;
    });

  // Add position numbers
  const leaderboardWithPositions = sortedLeaderboard.map((player: any, index: number) => ({
    ...player,
    position: index + 1
  }));

  // Add players who haven't completed all holes
  const incompletePlayers = leaderboardData
    .filter((player: any) => player.totalScore === null && player.holesPlayed > 0)
    .sort((a: any, b: any) => b.holesPlayed - a.holesPlayed);

  const allPlayers = [...leaderboardWithPositions, ...incompletePlayers];

  const formatToPar = (toPar: number | null) => {
    if (toPar === null) return '-';
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return 'text-yellow-600 font-bold';
    if (position === 2) return 'text-gray-500 font-semibold';
    if (position === 3) return 'text-amber-600 font-semibold';
    return 'text-gray-700';
  };

  const getToParColor = (toPar: number | null) => {
    if (toPar === null) return 'text-gray-400';
    if (toPar < 0) return 'text-green-600';
    if (toPar === 0) return 'text-gray-600';
    if (toPar <= 2) return 'text-orange-500';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  viewMode === 'compact'
                    ? 'bg-white text-primary-700'
                    : 'bg-primary-500/30 text-white hover:bg-primary-500/50'
                }`}
              >
                Compact
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  viewMode === 'full'
                    ? 'bg-white text-primary-700'
                    : 'bg-primary-500/30 text-white hover:bg-primary-500/50'
                }`}
              >
                Full
              </button>
            </div>
          </div>
          <p className="text-sm opacity-90">{event.name} - {course?.name || 'Course'}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-700">Pos</th>
                <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-700">Golfer</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Total</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">To Par</th>
                {viewMode === 'full' && (
                  <>
                    <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Front 9</th>
                    <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Back 9</th>
                  </>
                )}
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Holes</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((player, index) => (
                <tr key={player.id} className={`border-b border-slate-100 hover:bg-slate-50 ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''}`}>
                  <td className={`px-2 sm:px-4 py-3 font-mono text-center ${getPositionColor(player.position || 0)}`}>
                    {player.position ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm ${
                        player.position === 1 ? 'bg-yellow-400 text-yellow-900' :
                        player.position === 2 ? 'bg-gray-300 text-gray-800' :
                        player.position === 3 ? 'bg-amber-600 text-white' :
                        'bg-slate-100 text-slate-600'
                      } font-bold`}>
                        {player.position}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3 font-medium text-slate-900">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="truncate max-w-[120px] sm:max-w-none">{player.name}</span>
                      {isMobile && viewMode === 'compact' && (
                        <div className="flex gap-2 text-xs mt-1 sm:mt-0">
                          {player.front9Score !== null && (
                            <span className={player.front9Score < 0 ? 'text-green-600' : player.front9Score > 0 ? 'text-red-600' : 'text-gray-600'}>
                              F9: {player.front9Score === 0 ? 'E' : (player.front9Score > 0 ? `+${player.front9Score}` : player.front9Score)}
                            </span>
                          )}
                          {player.back9Score !== null && (
                            <span className={player.back9Score < 0 ? 'text-green-600' : player.back9Score > 0 ? 'text-red-600' : 'text-gray-600'}>
                              B9: {player.back9Score === 0 ? 'E' : (player.back9Score > 0 ? `+${player.back9Score}` : player.back9Score)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-center font-mono font-semibold">
                    {player.totalScore !== null ? (
                      <span className="text-slate-800">{player.totalScore}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className={`px-2 sm:px-4 py-3 text-center font-mono font-semibold ${getToParColor(player.toPar)}`}>
                    {formatToPar(player.toPar)}
                  </td>
                  {viewMode === 'full' && (
                    <>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center font-mono">
                        {player.front9Score !== null ? (
                          <span className={player.front9Score < 0 ? 'text-green-600' : player.front9Score > 0 ? 'text-red-600' : 'text-gray-600'}>
                            {player.front9Score === 0 ? 'E' : (player.front9Score > 0 ? `+${player.front9Score}` : player.front9Score)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center font-mono">
                        {player.back9Score !== null ? (
                          <span className={player.back9Score < 0 ? 'text-green-600' : player.back9Score > 0 ? 'text-red-600' : 'text-gray-600'}>
                            {player.back9Score === 0 ? 'E' : (player.back9Score > 0 ? `+${player.back9Score}` : player.back9Score)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-2 sm:px-4 py-3 text-center text-slate-600">
                    {player.holesPlayed}/18
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allPlayers.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500">
            <p>No scores recorded yet.</p>
            <p className="text-sm mt-1">Scores will appear here once golfers start entering their scores.</p>
          </div>
        )}
      </div>

      {/* Course Info */}
      {course && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 mb-2">Course Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Par:</span>
              <span className="ml-2 font-semibold">{totalPar}</span>
            </div>
            <div>
              <span className="text-slate-600">Front 9:</span>
              <span className="ml-2 font-semibold">{holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}</span>
            </div>
            <div>
              <span className="text-slate-600">Back 9:</span>
              <span className="ml-2 font-semibold">{holes.slice(9).reduce((sum, h) => sum + h.par, 0)}</span>
            </div>
            <div>
              <span className="text-slate-600">Holes:</span>
              <span className="ml-2 font-semibold">{holes.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
