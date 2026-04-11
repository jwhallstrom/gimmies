import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';
import { courseHandicap, strokesForHole } from '../../games/handicap';
import { distributeHandicapStrokes, calculateCourseHandicap } from '../../utils/handicap';
import { getTee } from '../../data/cloudCourses';
import { courseMap } from '../../data/courses';

type Props = {
  eventId: string;
  onEnterScores?: (golferId: string) => void;
};

const LeaderboardTab: React.FC<Props> = ({ eventId, onEnterScores }) => {
  const { profiles, currentProfile, canEditScore } = useStore() as any;
  const [scoreMode, setScoreMode] = useState<'gross' | 'net'>('gross');
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [showCourseStats, setShowCourseStats] = useState(false);
  const [teamModal, setTeamModal] = useState<null | {
    id: string;
    name: string;
    golferIds: string[];
    bestCount: number;
    isNet: boolean;
  }>(null);
  
  if (!event) return null;

  const togglePlayerExpanded = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId);
  };

  const resolveGolferName = (golferId: string) => {
    const eventGolfer = (event.golfers || []).find(
      (g: any) => g.profileId === golferId || g.customName === golferId
    );
    const profile = eventGolfer?.profileId ? profiles.find((p: any) => p.id === eventGolfer.profileId) : null;
    return profile ? profile.name : (eventGolfer?.displayName || eventGolfer?.customName || golferId || 'Unknown');
  };

  const nassauTeams: Array<{
    id: string;
    name: string;
    golferIds: string[];
    bestCount: number;
    isNet: boolean;
  }> = (event.games?.nassau || [])
    .flatMap((n: any) => {
      const bestCount = Math.max(1, Number(n?.teamBestCount) || 1);
      const isNet = n?.net === true;
      return ((n?.teams || []) as any[]).map((t: any) => ({ ...t, bestCount, isNet }));
    })
    .filter((t: any) => t && Array.isArray(t.golferIds) && t.golferIds.length > 0);

  const teamByGolferId = new Map<string, {
    id: string;
    name: string;
    golferIds: string[];
    bestCount: number;
    isNet: boolean;
  }>();
  for (const t of nassauTeams) {
    for (const gid of t.golferIds || []) {
      // First match wins (keeps UI simple if multiple Nassau configs exist)
      if (!teamByGolferId.has(gid)) teamByGolferId.set(gid, t);
    }
  }
  
  // Check if we should show team column
  const hasTeams = nassauTeams.length > 0;

  const getPlayerScorecard = (playerId: string) => {
    const scorecard = event.scorecards.find((sc: any) => 
      sc.golferId === playerId
    );
    return scorecard?.scores || [];
  };

  // Load only the selected course from DynamoDB (faster than loading full catalog)
  const { course: selectedCourse, loading: coursesLoading } = useCourse(event.course.courseId);
  const selectedTeeName = event.course.teeName;
  const selectedTee = selectedCourse?.tees?.find((t: any) => t.name === selectedTeeName);
  const teeWithHoles = selectedTee || selectedCourse?.tees?.[0];

  // Determine holes for scoring:
  // - Prefer the selected tee's holes from cloud data
  // - Fallback to any tee's holes for the course
  // - Fallback to 18 generic holes (par 4) only for true custom-course events
  const holes = teeWithHoles?.holes?.length
    ? teeWithHoles.holes
    : Array.from({ length: 18 }).map((_, i) => ({
        number: i + 1,
        par: event.course.courseId ? undefined : 4,
      }));

  const parsKnown = holes.every((h: any) => typeof h.par === 'number');
  const holeParByNumber: Record<number, number> = {};
  if (parsKnown) {
    holes.forEach((h: any) => {
      holeParByNumber[h.number] = h.par as number;
    });
  }

  // Calculate total par for the course
  const totalPar = parsKnown ? holes.reduce((sum: number, hole: any) => sum + (hole.par as number), 0) : null;

  // Function to get emoji based on recent performance
  const getPlayerEmoji = (scorecard: any) => {
    if (!scorecard?.scores || scorecard.scores.length === 0) return '';
    if (!parsKnown) return '';

    const scores = scorecard.scores
      .filter((s: any) => s.strokes != null)
      .sort((a: any, b: any) => a.hole - b.hole);

    if (scores.length === 0) return '';

    const latestScore = scores[scores.length - 1];
    const latestHoleNumber = latestScore.hole;

    // Check for snowman (8) on latest score - disappears after next score entry
    if (latestScore.strokes === 8) {
      return '\u26C4';
    }

    // Check current consecutive birdies streak (from the end working backwards)
    let currentBirdieStreak = 0;
    for (let i = scores.length - 1; i >= 0; i--) {
      const score = scores[i];
      const par = holeParByNumber[score.hole];

      if (typeof par === 'number' && score.strokes === par - 1) {
        currentBirdieStreak++;
      } else {
        break; // Streak is broken
      }
    }

    // Fire emoji for 3+ current consecutive birdies - disappears when streak breaks
    if (currentBirdieStreak >= 3) {
      return '\uD83D\uDD25';
    }

    // Bird emoji for 2+ current consecutive birdies - disappears when streak breaks
    if (currentBirdieStreak >= 2) {
      return '\uD83D\uDC26';
    }

    // Check for permanent achievements within last 2 holes
    const recentHoles = scores.filter((s: any) => s.hole > latestHoleNumber - 2);
    
    // Check for hole in one (ace) in last 2 holes
    if (recentHoles.some((s: any) => {
      const par = holeParByNumber[s.hole];
      return s.strokes === 1 && typeof par === 'number' && par > 1;
    })) {
      return '\uD83D\uDC8E';
    }

    // Check for eagle (2 under par) in last 2 holes
    if (recentHoles.some((s: any) => {
      const par = holeParByNumber[s.hole];
      return typeof par === 'number' && s.strokes <= par - 2;
    })) {
      return '\uD83E\uDD85';
    }

    return '';
  };

  // Calculate scores for each golfer
  const leaderboardData = event.golfers.map((eventGolfer: any) => {
    const profile = eventGolfer.profileId ? profiles.find((p: any) => p.id === eventGolfer.profileId) : null;
    // Use displayName snapshot if profile not found locally
    const displayName = profile ? profile.name : (eventGolfer.displayName || eventGolfer.customName || 'Unknown');
    const golferId = eventGolfer.profileId || eventGolfer.customName;

    // Find the scorecard for this golfer
    const scorecard = event.scorecards.find((sc: any) =>
      sc.golferId === eventGolfer.profileId || sc.golferId === eventGolfer.customName
    );

    if (!scorecard) {
      return {
        id: golferId,
        name: displayName,
        totalStrokes: 0,
        toPar: null,
        outStrokes: null,
        inStrokes: null,
        holesPlayed: 0,
        front9Holes: 0,
        back9Holes: 0
      };
    }

    // Calculate scores
    let totalStrokes = 0;
    let holesPlayed = 0;
    let front9Strokes = 0;
    let back9Strokes = 0;
    let front9Holes = 0;
    let back9Holes = 0;

    let totalPlayedPar: number | null = parsKnown ? 0 : null;

    scorecard.scores.forEach((score: any) => {
      if (score.strokes != null) {
        totalStrokes += score.strokes;
        holesPlayed++;

        if (totalPlayedPar != null) {
          const par = holeParByNumber[score.hole];
          if (typeof par === 'number') totalPlayedPar += par;
          else totalPlayedPar = null;
        }

        if (score.hole <= 9) {
          front9Strokes += score.strokes;
          front9Holes++;
        } else {
          back9Strokes += score.strokes;
          back9Holes++;
        }
      }
    });

    // Always calculate to par if any holes played AND pars are known
    const toPar = holesPlayed > 0 && totalPlayedPar != null ? totalStrokes - totalPlayedPar : null;

    // Calculate net score (gross - handicap strokes)
    let netStrokes = 0;
    let netToPar: number | null = null;
    if (holesPlayed > 0) {
      scorecard.scores.forEach((score: any) => {
        if (score.strokes != null) {
          const hcpStrokes = strokesForHole(event, golferId, score.hole, profiles);
          netStrokes += score.strokes - hcpStrokes;
        }
      });
      if (totalPlayedPar != null) {
        netToPar = netStrokes - totalPlayedPar;
      }
    }

    return {
      id: golferId,
      name: displayName,
      totalStrokes,
      toPar,
      netStrokes,
      netToPar,
      outStrokes: front9Holes > 0 ? front9Strokes : null,
      inStrokes: back9Holes > 0 ? back9Strokes : null,
      holesPlayed,
      front9Holes,
      back9Holes,
      emoji: getPlayerEmoji(scorecard),
      scorecard: scorecard
    };
  });

  // Sort by active score mode (gross or net) ascending, then by holes played
  const playersWithScores = leaderboardData
    .filter((player: any) => player.holesPlayed > 0)
    .sort((a: any, b: any) => {
      const aScore = scoreMode === 'net' ? a.netToPar : a.toPar;
      const bScore = scoreMode === 'net' ? b.netToPar : b.toPar;
      if (aScore !== null && bScore !== null) {
        if (aScore !== bScore) return aScore - bScore;
        return b.holesPlayed - a.holesPlayed;
      }
      if (aScore !== null) return -1;
      if (bScore !== null) return 1;
      return b.holesPlayed - a.holesPlayed;
    });

  // Add position numbers
  const leaderboardWithPositions = playersWithScores.map((player: any, index: number) => ({
    ...player,
    position: index + 1
  }));

  // Add players who haven't started
  const playersWithoutScores = leaderboardData
    .filter((player: any) => player.holesPlayed === 0);

  const allPlayers = [...leaderboardWithPositions, ...playersWithoutScores];

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

  // PGA/Masters convention: Red = under par, Black = even/over
  const getToParColor = (toPar: number | null) => {
    if (toPar === null) return 'text-gray-400';
    if (toPar < 0) return 'text-red-600'; // Under par = RED (golf standard)
    if (toPar === 0) return 'text-gray-800'; // Even = dark/black
    return 'text-gray-800'; // Over par = dark/black (+ sign shows it's over)
  };

  // Check if any golfer has handicap data (to show Gross/Net toggle)
  const hasHandicapData = useMemo(() => {
    return event.golfers.some((g: any) => {
      const ch = courseHandicap(event, g.profileId || g.customName, profiles);
      return ch != null && ch !== 0;
    });
  }, [event, profiles]);

  return (
    <div className="-mx-4 sm:mx-0">
      <div className="bg-white sm:rounded-lg shadow-sm border-y sm:border border-slate-200 overflow-hidden">
        {/* Header bar with toggles */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leaderboard</span>
            {parsKnown && playersWithScores.length > 0 && (
              <button
                onClick={() => setShowCourseStats(!showCourseStats)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                  showCourseStats
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Stats
              </button>
            )}
          </div>
          {hasHandicapData && (
            <div className="flex gap-0.5 text-[11px] font-bold rounded-lg overflow-hidden border border-slate-300 bg-white">
              <button
                onClick={() => setScoreMode('gross')}
                className={`px-3 py-1.5 transition-colors ${scoreMode === 'gross' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Gross
              </button>
              <button
                onClick={() => setScoreMode('net')}
                className={`px-3 py-1.5 transition-colors ${scoreMode === 'net' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Net
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-700 text-xs">Pos</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700 text-xs">Player</th>
                {hasTeams && <th className="px-3 py-3 text-left font-semibold text-slate-700 text-xs">Team</th>}
                <th className="px-3 py-3 text-center font-semibold text-slate-700 text-xs">
                  {scoreMode === 'net' ? 'Net' : 'Score'}
                </th>
                <th className="px-3 py-3 text-center font-semibold text-slate-700 text-xs">Thru</th>
                <th className="px-3 py-3 text-center font-semibold text-slate-700 text-xs">Tot</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((player, index) => (
                <React.Fragment key={player.id}>
                  <tr 
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                      player.position && player.position <= 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''
                    } ${expandedPlayer === player.id ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      // If we can edit and onEnterScores is available, go directly to edit mode
                      if (typeof onEnterScores === 'function' && !event.isCompleted && canEditScore?.(eventId, player.id)) {
                        onEnterScores(player.id);
                      } else {
                        // Otherwise, toggle expand to view scorecard (read-only)
                        togglePlayerExpanded(player.id);
                      }
                    }}
                  >
                    <td className={`px-3 py-3 font-mono text-center ${getPositionColor(player.position || 0)}`}>
                      {player.position ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${
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
                    <td className="px-3 py-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {typeof onEnterScores === 'function' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!event.isCompleted && canEditScore?.(eventId, player.id)) {
                                onEnterScores(player.id);
                              }
                            }}
                            disabled={event.isCompleted || !canEditScore?.(eventId, player.id)}
                            className="truncate max-w-[140px] sm:max-w-none text-left font-bold text-slate-900 hover:text-primary-700 disabled:text-slate-400 disabled:cursor-not-allowed"
                            title={event.isCompleted ? 'Read-only' : (canEditScore?.(eventId, player.id) ? 'Enter scores' : 'You cannot edit this golfer')}
                          >
                            {player.name}
                          </button>
                        ) : (
                          <span className="truncate max-w-[140px] sm:max-w-none font-bold">{player.name}</span>
                        )}
                        {player.emoji && <span className="text-lg">{player.emoji}</span>}
                      </div>
                    </td>
                    {hasTeams && (
                      <td className="px-3 py-3">
                        {(() => {
                          const team = teamByGolferId.get(String(player.id));
                          if (!team) return <span className="text-slate-300">-</span>;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTeamModal(team);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
                              title="View team scorecard"
                            >
                              <span className="w-2 h-2 rounded-full bg-primary-500" aria-hidden="true" />
                              <span className="truncate max-w-[100px]">{team.name || 'Team'}</span>
                            </button>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-3 py-3 text-center">
                      <span className={`font-mono font-bold text-xl ${getToParColor(scoreMode === 'net' ? player.netToPar : player.toPar)}`}>
                        {player.holesPlayed > 0 ? formatToPar(scoreMode === 'net' ? player.netToPar : player.toPar) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600 font-medium">
                      {player.holesPlayed >= 18 ? (
                        <span className="text-green-600 font-bold">F</span>
                      ) : (
                        player.holesPlayed || '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500 font-mono text-sm">
                      {player.holesPlayed > 0 ? (scoreMode === 'net' ? player.netStrokes : player.totalStrokes) : '-'}
                    </td>
                  </tr>
                  {expandedPlayer === player.id && (
                    <tr>
                      <td colSpan={hasTeams ? 6 : 5} className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="space-y-3">
                          {/* Read-only notice */}
                          <div className="text-[11px] text-slate-500 italic">
                            {event.isCompleted ? 'Event completed' : 'Viewing scorecard (read-only)'}
                          </div>
                          {/* Front 9 */}
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Front Nine</div>
                            <div className="flex flex-col gap-1">
                              {/* Hole numbers 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-12 shrink-0">Hole</div>
                                {holes.slice(0, 9).map((hole) => (
                                  <div key={`hole-${hole.number}`} className="text-xs font-semibold text-slate-600 py-1 text-center w-8 shrink-0">
                                    {hole.number}
                                  </div>
                                ))}
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-10 shrink-0 ml-1">Out</div>
                              </div>
                              
                              {/* Par 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-12 shrink-0">Par</div>
                                {holes.slice(0, 9).map((hole) => (
                                  <div key={`par-${hole.number}`} className="text-xs text-slate-600 py-1 text-center bg-slate-100 rounded w-8 shrink-0">
                                    {typeof hole.par === 'number' ? hole.par : '-'}
                                  </div>
                                ))}
                                <div className="text-xs text-slate-600 py-1 text-center bg-slate-200 rounded w-10 shrink-0 ml-1 font-semibold">
                                  {parsKnown
                                    ? holes.slice(0, 9).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '-'}
                                </div>
                              </div>
                              
                              {/* Player scores 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-700 py-1 text-center w-12 shrink-0">Score</div>
                                {holes.slice(0, 9).map((hole) => {
                                  const playerScores = getPlayerScorecard(player.id);
                                  const scoreForHole = playerScores.find((s: any) => s.hole === hole.number);
                                  const strokes = scoreForHole?.strokes;
                                  const par = holeParByNumber[hole.number];
                                  const toPar = strokes != null && typeof par === 'number' ? strokes - par : null;
                                  
                                  return (
                                    <div key={`score-${hole.number}`} className={`text-xs py-1 text-center font-mono rounded w-8 shrink-0 ${
                                      strokes == null ? 'text-slate-400' :
                                      toPar === null ? 'text-slate-700' :
                                      toPar <= -2 ? 'text-amber-700 bg-amber-100 font-bold' :
                                      toPar === -1 ? 'text-red-700 bg-red-100 font-semibold' :
                                      toPar === 0 ? 'text-slate-700 bg-white' :
                                      toPar === 1 ? 'text-blue-700 bg-blue-100 font-semibold' :
                                      'text-blue-900 bg-blue-200 font-semibold'
                                    }`}>
                                      {strokes ?? '-'}
                                    </div>
                                  );
                                })}
                                <div className="text-xs py-1 text-center font-mono rounded w-10 shrink-0 ml-1 bg-slate-100 font-semibold">
                                  {player.outStrokes || '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Back 9 */}
                          <div>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Back Nine</div>
                            <div className="flex flex-col gap-1">
                              {/* Hole numbers 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-12 shrink-0">Hole</div>
                                {holes.slice(9, 18).map((hole) => (
                                  <div key={`hole-${hole.number}`} className="text-xs font-semibold text-slate-600 py-1 text-center w-8 shrink-0">
                                    {hole.number}
                                  </div>
                                ))}
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-10 shrink-0 ml-1">In</div>
                              </div>
                              
                              {/* Par 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 py-1 text-center w-12 shrink-0">Par</div>
                                {holes.slice(9, 18).map((hole) => (
                                  <div key={`par-${hole.number}`} className="text-xs text-slate-600 py-1 text-center bg-slate-100 rounded w-8 shrink-0">
                                    {typeof hole.par === 'number' ? hole.par : '-'}
                                  </div>
                                ))}
                                <div className="text-xs text-slate-600 py-1 text-center bg-slate-200 rounded w-10 shrink-0 ml-1 font-semibold">
                                  {parsKnown
                                    ? holes.slice(9, 18).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '-'}
                                </div>
                              </div>
                              
                              {/* Player scores 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-700 py-1 text-center w-12 shrink-0">Score</div>
                                {holes.slice(9, 18).map((hole) => {
                                  const playerScores = getPlayerScorecard(player.id);
                                  const scoreForHole = playerScores.find((s: any) => s.hole === hole.number);
                                  const strokes = scoreForHole?.strokes;
                                  const par = holeParByNumber[hole.number];
                                  const toPar = strokes != null && typeof par === 'number' ? strokes - par : null;
                                  
                                  return (
                                    <div key={`score-${hole.number}`} className={`text-xs py-1 text-center font-mono rounded w-8 shrink-0 ${
                                      strokes == null ? 'text-slate-400' :
                                      toPar === null ? 'text-slate-700' :
                                      toPar <= -2 ? 'text-amber-700 bg-amber-100 font-bold' :
                                      toPar === -1 ? 'text-red-700 bg-red-100 font-semibold' :
                                      toPar === 0 ? 'text-slate-700 bg-white' :
                                      toPar === 1 ? 'text-blue-700 bg-blue-100 font-semibold' :
                                      'text-blue-900 bg-blue-200 font-semibold'
                                    }`}>
                                      {strokes ?? '-'}
                                    </div>
                                  );
                                })}
                                <div className="text-xs py-1 text-center font-mono rounded w-10 shrink-0 ml-1 bg-slate-100 font-semibold">
                                  {player.inStrokes || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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

      {/* Course Stats Panel */}
      {showCourseStats && parsKnown && playersWithScores.length > 0 && (() => {
        const holeNumbers = holes.map((h: any) => h.number).sort((a: number, b: number) => a - b);
        const front9 = holeNumbers.filter((h: number) => h <= 9);
        const back9 = holeNumbers.filter((h: number) => h >= 10);

        type HoleStat = {
          hole: number;
          par: number;
          scores: number[];
          avg: number;
          avgVsPar: number;
          eagles: number;
          birdies: number;
          pars: number;
          bogeys: number;
          doubles: number;
          triples: number;
          rank?: number;
        };

        const holeStats: HoleStat[] = holeNumbers.map((h: number) => {
          const par = holeParByNumber[h] || 4;
          const scores: number[] = [];

          event.scorecards.forEach((sc: any) => {
            const s = sc.scores?.find((x: any) => x.hole === h);
            if (s?.strokes != null) scores.push(s.strokes);
          });

          let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0, triples = 0;
          scores.forEach((s) => {
            const diff = s - par;
            if (diff <= -2) eagles++;
            else if (diff === -1) birdies++;
            else if (diff === 0) pars++;
            else if (diff === 1) bogeys++;
            else if (diff === 2) doubles++;
            else triples++;
          });

          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : par;
          return { hole: h, par, scores, avg, avgVsPar: avg - par, eagles, birdies, pars, bogeys, doubles, triples };
        });

        const sorted = [...holeStats].sort((a, b) => b.avgVsPar - a.avgVsPar);
        sorted.forEach((h, i) => { h.rank = i + 1; });
        holeStats.forEach((h) => { h.rank = sorted.find((s) => s.hole === h.hole)?.rank; });

        const totals = holeStats.reduce(
          (acc, h) => ({
            eagles: acc.eagles + h.eagles,
            birdies: acc.birdies + h.birdies,
            pars: acc.pars + h.pars,
            bogeys: acc.bogeys + h.bogeys,
            doubles: acc.doubles + h.doubles,
            triples: acc.triples + h.triples,
          }),
          { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, triples: 0 }
        );

        const allScores = holeStats.flatMap((h) => h.scores);
        const fieldAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / playersWithScores.length : 0;
        const lowRound = playersWithScores.reduce((best: any, p: any) => {
          if (!best || (p.totalStrokes > 0 && p.holesPlayed >= 18 && p.totalStrokes < best.totalStrokes)) return p;
          return best;
        }, null as any);

        const front9Avg = front9.length > 0
          ? holeStats.filter((h) => h.hole <= 9).reduce((s, h) => s + h.avg, 0)
          : null;
        const back9Avg = back9.length > 0
          ? holeStats.filter((h) => h.hole >= 10).reduce((s, h) => s + h.avg, 0)
          : null;

        const hardestHole = sorted[0];
        const easiestHole = sorted[sorted.length - 1];

        const getDiffBg = (avgVsPar: number) => {
          if (avgVsPar <= -0.3) return 'bg-emerald-100 text-emerald-800';
          if (avgVsPar <= 0.1) return 'bg-slate-100 text-slate-700';
          if (avgVsPar <= 0.5) return 'bg-amber-100 text-amber-800';
          return 'bg-red-100 text-red-800';
        };

        const getBarWidth = (count: number, total: number) => total > 0 ? Math.max(2, (count / total) * 100) : 0;

        const renderHalfStats = (holeRange: number[], label: string) => {
          const rangeStats = holeStats.filter((h) => holeRange.includes(h.hole));
          const rangePar = rangeStats.reduce((s, h) => s + h.par, 0);
          const rangeAvg = rangeStats.reduce((s, h) => s + h.avg, 0);
          return (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                <div className="text-[10px] text-slate-500">
                  Par {rangePar} · Avg {rangeAvg.toFixed(1)}
                </div>
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80">
                      <th className="px-1.5 py-1 text-left font-bold text-slate-500 w-[38px]">Hole</th>
                      <th className="px-1 py-1 text-center font-bold text-slate-500 w-[30px]">Par</th>
                      <th className="px-1 py-1 text-center font-bold text-slate-500 w-[36px]">Avg</th>
                      <th className="px-1 py-1 text-center font-bold text-slate-500 w-[32px]">+/-</th>
                      <th className="px-1 py-1 text-center font-bold text-slate-500 w-[24px]">#</th>
                      <th className="px-1.5 py-1 font-bold text-slate-500 text-left">Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangeStats.map((h) => {
                      const totalScored = h.scores.length;
                      const isHardest = h.hole === hardestHole?.hole;
                      const isEasiest = h.hole === easiestHole?.hole;
                      return (
                        <tr key={h.hole} className={`border-t border-slate-100 ${isHardest ? 'bg-red-50/50' : isEasiest ? 'bg-emerald-50/50' : ''}`}>
                          <td className="px-1.5 py-1.5 font-bold text-slate-700">
                            <div className="flex items-center gap-1">
                              {h.hole}
                              {isHardest && <span className="text-[8px] text-red-500 font-black">H</span>}
                              {isEasiest && <span className="text-[8px] text-emerald-500 font-black">E</span>}
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center text-slate-600">{h.par}</td>
                          <td className="px-1 py-1.5 text-center font-mono font-bold text-slate-800">{h.avg.toFixed(1)}</td>
                          <td className="px-1 py-1.5 text-center">
                            <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-bold ${getDiffBg(h.avgVsPar)}`}>
                              {h.avgVsPar >= 0 ? '+' : ''}{h.avgVsPar.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-1 py-1.5 text-center text-slate-500 text-[10px]">{h.rank}</td>
                          <td className="px-1.5 py-1.5">
                            {totalScored > 0 ? (
                              <div className="flex h-3 rounded-full overflow-hidden bg-slate-200/60">
                                {h.eagles > 0 && <div className="bg-amber-400" style={{ width: `${getBarWidth(h.eagles, totalScored)}%` }} title={`Eagles: ${h.eagles}`} />}
                                {h.birdies > 0 && <div className="bg-emerald-500" style={{ width: `${getBarWidth(h.birdies, totalScored)}%` }} title={`Birdies: ${h.birdies}`} />}
                                {h.pars > 0 && <div className="bg-slate-400" style={{ width: `${getBarWidth(h.pars, totalScored)}%` }} title={`Pars: ${h.pars}`} />}
                                {h.bogeys > 0 && <div className="bg-orange-400" style={{ width: `${getBarWidth(h.bogeys, totalScored)}%` }} title={`Bogeys: ${h.bogeys}`} />}
                                {h.doubles > 0 && <div className="bg-red-500" style={{ width: `${getBarWidth(h.doubles, totalScored)}%` }} title={`Doubles: ${h.doubles}`} />}
                                {h.triples > 0 && <div className="bg-red-800" style={{ width: `${getBarWidth(h.triples, totalScored)}%` }} title={`Triples+: ${h.triples}`} />}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        };

        return (
          <div className="mt-3 bg-white sm:rounded-lg shadow-sm border-y sm:border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2.5 bg-gradient-to-r from-emerald-50 to-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Course Stats</span>
                </div>
                <button onClick={() => setShowCourseStats(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Aggregate Summary */}
            <div className="px-3 py-3 border-b border-slate-100">
              {/* Top-line stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Field Avg</div>
                  <div className="text-lg font-black text-slate-800">{fieldAvg.toFixed(1)}</div>
                  {totalPar && <div className="text-[10px] text-slate-500">{fieldAvg - totalPar >= 0 ? '+' : ''}{(fieldAvg - totalPar).toFixed(1)} vs par</div>}
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Low Round</div>
                  <div className="text-lg font-black text-slate-800">{lowRound?.holesPlayed >= 18 ? lowRound.totalStrokes : '-'}</div>
                  <div className="text-[10px] text-slate-500 truncate">{lowRound?.holesPlayed >= 18 ? lowRound.name : 'In progress'}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">By Nine</div>
                  <div className="text-sm font-bold text-slate-800 leading-tight mt-0.5">
                    {front9Avg != null ? front9Avg.toFixed(1) : '-'} <span className="text-slate-400 font-normal">/</span> {back9Avg != null ? back9Avg.toFixed(1) : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500">Front / Back</div>
                </div>
              </div>

              {/* Scoring breakdown pills */}
              <div className="flex flex-wrap gap-1.5">
                {totals.eagles > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Eagles {totals.eagles}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Birdies {totals.birdies}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-400" /> Pars {totals.pars}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-orange-400" /> Bogeys {totals.bogeys}
                </span>
                {totals.doubles > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Doubles {totals.doubles}
                  </span>
                )}
                {totals.triples > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-200 text-red-900 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-800" /> Triple+ {totals.triples}
                  </span>
                )}
              </div>
            </div>

            {/* Hole-by-hole heat map */}
            <div className="px-3 py-3">
              {front9.length > 0 && renderHalfStats(front9, 'Front 9')}
              {back9.length > 0 && renderHalfStats(back9, 'Back 9')}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100">
                <span className="text-[9px] text-slate-400 font-semibold uppercase">Key:</span>
                <span className="text-[9px] text-slate-400 font-semibold uppercase"># = Difficulty Rank</span>
                <span className="text-[8px] text-red-500 font-black">H</span><span className="text-[9px] text-slate-500">Hardest</span>
                <span className="text-[8px] text-emerald-500 font-black">E</span><span className="text-[9px] text-slate-500">Easiest</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /><span className="text-[9px] text-slate-500">Eagle</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span className="text-[9px] text-slate-500">Birdie</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /><span className="text-[9px] text-slate-500">Par</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /><span className="text-[9px] text-slate-500">Bogey</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span className="text-[9px] text-slate-500">Dbl</span></div>
                <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-800" /><span className="text-[9px] text-slate-500">Trpl+</span></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Event Actions Banner - Owner only */}
      {currentProfile && event.ownerProfileId === currentProfile.id && !event.isCompleted && event.hubType !== 'group' && (
        <div className="mt-4 mx-4 sm:mx-0">
          {(() => {
            const eventStatus = event.status || 'setup';
            const allScoresComplete = event.scorecards?.every((sc: any) => 
              sc.scores?.every((s: any) => s.strokes != null)
            );
            const someScoresEntered = event.scorecards?.some((sc: any) => 
              sc.scores?.some((s: any) => s.strokes != null)
            );
            
            // Not started yet
            if (eventStatus !== 'started' && eventStatus !== 'completed') {
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">Start</span>
                      <div>
                        <div className="font-semibold text-blue-900 text-sm">Ready to Start?</div>
                        <p className="text-xs text-blue-700 mt-0.5">Lock in players and begin the round</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        useStore.getState().updateEvent(eventId, { status: 'started' });
                        useStore.getState().addToast('Event started! Good luck!', 'success');
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-800 shadow-md whitespace-nowrap"
                    >
                      Start
                    </button>
                  </div>
                </div>
              );
            }
            
            // Started but not complete
            if (eventStatus === 'started') {
              return (
                <div className={`${allScoresComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{allScoresComplete ? 'Done' : 'In Play'}</span>
                      <div>
                        <div className={`font-semibold text-sm ${allScoresComplete ? 'text-green-900' : 'text-amber-900'}`}>
                          {allScoresComplete ? 'All Scores Complete!' : 'Round In Progress'}
                        </div>
                        <p className={`text-xs mt-0.5 ${allScoresComplete ? 'text-green-700' : 'text-amber-700'}`}>
                          {allScoresComplete 
                            ? 'Ready to finalize and add to handicaps' 
                            : `${event.scorecards?.filter((sc: any) => sc.scores?.every((s: any) => s.strokes != null)).length || 0}/${event.scorecards?.length || 0} scorecards complete`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const confirmMsg = allScoresComplete 
                          ? 'Complete this event? This finalizes all scores and payouts.'
                          : 'WARNING: Not all scores are entered!\n\nComplete anyway? This finalizes all scores and payouts.';
                        if (!window.confirm(confirmMsg)) return;
                        
                        const success = useStore.getState().completeEvent(eventId);
                        if (success) {
                          useStore.getState().addToast('Event completed! Scores added to handicaps.', 'success');
                        } else {
                          useStore.getState().addToast('Could not complete event', 'error');
                        }
                      }}
                      disabled={!someScoresEntered}
                      className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap ${
                        allScoresComplete
                          ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-md'
                          : someScoresEntered
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              );
            }
            
            return null;
          })()}
        </div>
      )}

      {/* Team modal */}
      {teamModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTeamModal(null)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[calc(100dvh-2rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Team</div>
                  <div className="font-extrabold text-slate-900">{teamModal.name || 'Team'}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {teamModal.isNet ? 'Net' : 'Gross'} • Best {teamModal.bestCount === 1 ? 'Ball' : teamModal.bestCount}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModal(null)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black"
                  aria-label="Close"
                >
                  x
                </button>
              </div>
            </div>

            <div className="p-4 overflow-x-auto max-h-[calc(100dvh-8rem)] overflow-y-auto">
                {(() => {
                  const holeNumbers = holes.map((h: any) => h.number).sort((a: number, b: number) => a - b);
                  const front9 = holeNumbers.filter((h: number) => h <= 9);
                  const back9 = holeNumbers.filter((h: number) => h >= 10);
                  const isNet = teamModal.isNet;

                  const cloudTee = getTee(event.course.courseId, event.course.teeName);
                  const localCourse = courseMap[event.course.courseId];
                  const courseRating = cloudTee?.courseRating ?? 72;
                  const slopeRating = cloudTee?.slopeRating ?? 113;
                  const par = cloudTee?.par ?? localCourse?.holes?.reduce((sum: number, h: any) => sum + h.par, 0) ?? 72;

                  const golferScores = teamModal.golferIds.map((gid) => {
                    const scorecard = event.scorecards.find((sc: any) => sc.golferId === gid);
                    const eventGolfer = event.golfers.find((g: any) => g.profileId === gid || g.customName === gid);
                    const profile = profiles.find((p: any) => p.id === gid);
                    const handicapIndex = eventGolfer?.handicapOverride ?? eventGolfer?.handicapSnapshot ?? profile?.handicapIndex ?? 0;
                    const courseHcp = calculateCourseHandicap(handicapIndex, slopeRating, courseRating, par);
                    const strokeDist = isNet && event.course.courseId
                      ? distributeHandicapStrokes(courseHcp, event.course.courseId, event.course.teeName)
                      : {};

                    const scores: Record<number, { gross: number | null; net: number | null; strokes: number }> = {};
                    holeNumbers.forEach((h: number) => {
                      const s = scorecard?.scores?.find((x: any) => x.hole === h);
                      const gross = s?.strokes ?? null;
                      const handicapStrokes = strokeDist[h] || 0;
                      const net = gross != null ? gross - handicapStrokes : null;
                      scores[h] = { gross, net, strokes: handicapStrokes };
                    });

                    return {
                      id: gid,
                      name: resolveGolferName(gid),
                      scores,
                      courseHcp,
                    };
                  });

                  const usedScoresPerHole: Record<number, Set<string>> = {};
                  holeNumbers.forEach((h: number) => {
                    const scoresWithId = golferScores
                      .filter((g: any) => g.scores[h].gross != null)
                      .map((g: any) => ({
                        id: g.id,
                        score: isNet ? g.scores[h].net! : g.scores[h].gross!,
                      }))
                      .sort((a: any, b: any) => a.score - b.score);
                    const used = scoresWithId.slice(0, teamModal.bestCount);
                    usedScoresPerHole[h] = new Set(used.map((u: any) => u.id));
                  });

                  const renderHalfTable = (holeRange: number[], label: string) => (
                    <div className="mb-4">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">{label}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="px-2 py-1.5 text-left font-bold text-slate-600 sticky left-0 bg-slate-100 min-w-[80px]">Player</th>
                              {holeRange.map((h: number) => (
                                <th key={h} className="px-1.5 py-1.5 text-center font-bold text-slate-600 min-w-[28px]">{h}</th>
                              ))}
                              <th className="px-2 py-1.5 text-center font-bold text-slate-700 bg-slate-200 min-w-[36px]">Tot</th>
                            </tr>
                          </thead>
                          <tbody>
                            {golferScores.map((golfer: any) => {
                              const halfTotalNet = holeRange.reduce((sum: number, h: number) => sum + (golfer.scores[h].net || 0), 0);
                              const halfTotalGross = holeRange.reduce((sum: number, h: number) => sum + (golfer.scores[h].gross || 0), 0);
                              const hasAnyScore = holeRange.some((h: number) => golfer.scores[h].gross != null);
                              return (
                                <tr key={golfer.id} className="border-t border-slate-100">
                                  <td className="px-2 py-1.5 font-medium text-slate-900 sticky left-0 bg-white truncate max-w-[80px]">
                                    <div>{golfer.name.split(' ')[0]}</div>
                                    {isNet && <div className="text-[9px] text-purple-600 font-normal">CH {golfer.courseHcp}</div>}
                                  </td>
                                  {holeRange.map((h: number) => {
                                    const { gross, net, strokes } = golfer.scores[h];
                                    const isUsed = usedScoresPerHole[h]?.has(golfer.id);
                                    const displayScore = isNet ? net : gross;
                                    return (
                                      <td
                                        key={h}
                                        className={`px-0.5 py-1 text-center font-mono relative ${
                                          gross == null
                                            ? 'text-slate-300'
                                            : isUsed
                                              ? 'bg-green-100 text-green-800 font-bold'
                                              : 'text-slate-500'
                                        }`}
                                      >
                                        {isNet && strokes > 0 && (
                                          <div className="absolute top-0 left-0 right-0 flex justify-center gap-0.5 -mt-0.5">
                                            {Array.from({ length: Math.min(strokes, 3) }).map((_, i) => (
                                              <span key={i} className="w-1 h-1 rounded-full bg-purple-500" />
                                            ))}
                                          </div>
                                        )}
                                        <span className="text-[10px]">{displayScore ?? '-'}</span>
                                        {isNet && gross != null && net !== gross && (
                                          <div className="text-[8px] text-slate-400 leading-none">{gross}</div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-700 bg-slate-50">
                                    {hasAnyScore ? (isNet ? halfTotalNet : halfTotalGross) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-slate-300 bg-blue-50">
                              <td className="px-2 py-1.5 font-bold text-blue-800 sticky left-0 bg-blue-50">Team</td>
                              {holeRange.map((h: number) => {
                                const usedGolfers = Array.from(usedScoresPerHole[h] || []);
                                const teamScore = usedGolfers.reduce((sum: number, gid: string) => {
                                  const g = golferScores.find((gs: any) => gs.id === gid);
                                  const score = isNet ? g?.scores[h]?.net : g?.scores[h]?.gross;
                                  return sum + (score || 0);
                                }, 0);
                                const hasScore = usedGolfers.length > 0;
                                return (
                                  <td key={h} className="px-1.5 py-1.5 text-center font-mono font-bold text-blue-800">
                                    {hasScore ? teamScore : '-'}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 text-center font-mono font-bold text-blue-900 bg-blue-100">
                                {holeRange.reduce((sum: number, h: number) => {
                                  const usedGolfers = Array.from(usedScoresPerHole[h] || []);
                                  return sum + usedGolfers.reduce((s: number, gid: string) => {
                                    const g = golferScores.find((gs: any) => gs.id === gid);
                                    const score = isNet ? g?.scores[h]?.net : g?.scores[h]?.gross;
                                    return s + (score || 0);
                                  }, 0);
                                }, 0) || '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );

                  return (
                    <>
                      {front9.length > 0 && renderHalfTable(front9, 'Front 9')}
                      {back9.length > 0 && renderHalfTable(back9, 'Back 9')}
                      <div className="mt-3 space-y-2">
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                            <span className="text-green-800">Highlighted scores counted toward team total</span>
                          </div>
                        </div>
                        {isNet && (
                          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="flex gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                              </div>
                              <span className="text-purple-800">Dots = handicap strokes on that hole</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LeaderboardTab;


