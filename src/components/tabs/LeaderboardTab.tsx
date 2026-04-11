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
        {/* Gross / Net toggle */}
        {hasHandicapData && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leaderboard</span>
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
          </div>
        )}
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


