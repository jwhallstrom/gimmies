import React, { useState } from 'react';
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';

type Props = {
  eventId: string;
  onEnterScores?: (golferId: string) => void;
};

const LeaderboardTab: React.FC<Props> = ({ eventId, onEnterScores }) => {
  const { profiles, currentProfile, canEditScore } = useStore() as any;
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [teamModal, setTeamModal] = useState<null | { id: string; name: string; golferIds: string[] }>(null);

  if (!event) return null;

  // Debug logging
  console.log('🏆 LeaderboardTab: Event golfers:', event.golfers);
  console.log('🏆 LeaderboardTab: Available profiles:', profiles);
  console.log('🏆 LeaderboardTab: Event scorecards:', event.scorecards);

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

  const nassauTeams: Array<{ id: string; name: string; golferIds: string[] }> = (event.games?.nassau || [])
    .flatMap((n: any) => (n?.teams || []) as any[])
    .filter((t: any) => t && Array.isArray(t.golferIds));

  const teamByGolferId = new Map<string, { id: string; name: string; golferIds: string[] }>();
  for (const t of nassauTeams) {
    for (const gid of t.golferIds || []) {
      // First match wins (keeps UI simple if multiple Nassau configs exist)
      if (!teamByGolferId.has(gid)) teamByGolferId.set(gid, t);
    }
  }

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
      return '⛄';
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
      return '🔥';
    }

    // Bird emoji for 2+ current consecutive birdies - disappears when streak breaks
    if (currentBirdieStreak >= 2) {
      return '🐦';
    }

    // Check for permanent achievements within last 2 holes
    const recentHoles = scores.filter((s: any) => s.hole > latestHoleNumber - 2);
    
    // Check for hole in one (ace) in last 2 holes
    if (recentHoles.some((s: any) => {
      const par = holeParByNumber[s.hole];
      return s.strokes === 1 && typeof par === 'number' && par > 1;
    })) {
      return '💎';
    }

    // Check for eagle (2 under par) in last 2 holes
    if (recentHoles.some((s: any) => {
      const par = holeParByNumber[s.hole];
      return typeof par === 'number' && s.strokes <= par - 2;
    })) {
      return '🦅';
    }

    return '';
  };

  // Calculate scores for each golfer
  const leaderboardData = event.golfers.map((eventGolfer: any) => {
    const profile = eventGolfer.profileId ? profiles.find((p: any) => p.id === eventGolfer.profileId) : null;
    // ✅ Use displayName snapshot if profile not found locally
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

    return {
      id: golferId,
      name: displayName,
      totalStrokes,
      toPar,
      outStrokes: front9Holes > 0 ? front9Strokes : null,
      inStrokes: back9Holes > 0 ? back9Strokes : null,
      holesPlayed,
      front9Holes,
      back9Holes,
      emoji: getPlayerEmoji(scorecard),
      scorecard: scorecard
    };
  });

  // Sort by score to par (ascending), then by holes played (descending)
  const playersWithScores = leaderboardData
    .filter((player: any) => player.holesPlayed > 0)
    .sort((a: any, b: any) => {
      // If both have toPar, sort by toPar (lower is better)
      if (a.toPar !== null && b.toPar !== null) {
        if (a.toPar !== b.toPar) {
          return a.toPar - b.toPar;
        }
        // If tied on toPar, prefer more holes played
        return b.holesPlayed - a.holesPlayed;
      }
      // If only one has toPar, that one goes first
      if (a.toPar !== null) return -1;
      if (b.toPar !== null) return 1;
      // If neither has toPar, sort by holes played
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
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <p className="text-sm opacity-90">{event.name} - {selectedCourse?.name || 'Course'} (Par {totalPar ?? '—'})</p>
          <p className="text-xs opacity-75 mt-1">
            Tap a <span className="font-bold underline underline-offset-2">player name</span> to enter scores. Tap a <span className="font-bold underline underline-offset-2">team</span> to open the roster.
          </p>
          {coursesLoading && event.course.courseId && !teeWithHoles?.holes?.length && (
            <p className="text-xs opacity-75 mt-1">Loading course pars…</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-700">Pos</th>
                <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-700">Player</th>
                <th className="px-2 sm:px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">To Par</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Out</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">In</th>
                <th className="px-2 sm:px-4 py-3 text-center font-semibold text-slate-700">Thru</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((player, index) => (
                <React.Fragment key={player.id}>
                  <tr 
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                      player.position && player.position <= 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''
                    } ${expandedPlayer === player.id ? 'bg-blue-50' : ''}`}
                    onClick={() => togglePlayerExpanded(player.id)}
                  >
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
                            className="truncate max-w-[120px] sm:max-w-none text-left font-extrabold text-primary-700 hover:text-primary-900 hover:underline underline-offset-2 disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                            title={event.isCompleted ? 'Read-only' : (canEditScore?.(eventId, player.id) ? 'Enter scores' : 'You cannot edit this golfer')}
                          >
                            {player.name}
                          </button>
                        ) : (
                          <span className="truncate max-w-[120px] sm:max-w-none">{player.name}</span>
                        )}
                        {player.emoji && <span className="text-lg">{player.emoji}</span>}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      {(() => {
                        const team = teamByGolferId.get(String(player.id));
                        if (!team) return <span className="text-slate-400">—</span>;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTeamModal(team);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold bg-primary-50 text-primary-800 border border-primary-200 hover:bg-primary-100"
                            title="View team roster"
                          >
                            <span className="w-2 h-2 rounded-full bg-primary-600" aria-hidden="true" />
                            <span className="truncate max-w-[90px]">{team.name || 'Team'}</span>
                          </button>
                        );
                      })()}
                    </td>
                    <td className={`px-2 sm:px-4 py-3 text-center font-mono font-bold text-lg ${getToParColor(player.toPar)}`}>
                      {formatToPar(player.toPar)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center font-mono text-slate-700">
                      {player.outStrokes !== null ? (
                        <span>{player.outStrokes}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center font-mono text-slate-700">
                      {player.inStrokes !== null ? (
                        <span>{player.inStrokes}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center text-slate-600 font-medium">
                      {player.holesPlayed}
                    </td>
                  </tr>
                  {expandedPlayer === player.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="space-y-3">
                          {/* Primary CTA: enter/edit scores (when allowed) */}
                          {typeof onEnterScores === 'function' && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-600">
                                {event.isCompleted
                                  ? 'Event completed (read-only)'
                                  : (canEditScore?.(eventId, player.id) ? 'You can edit this player’s scores.' : 'You can only edit your own (or your team).')}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onEnterScores(player.id);
                                }}
                                disabled={event.isCompleted || !canEditScore?.(eventId, player.id)}
                                className="px-3 py-2 rounded-lg text-xs font-extrabold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={event.isCompleted ? 'Read-only' : 'Enter scores'}
                              >
                                Enter score
                              </button>
                            </div>
                          )}

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
                                    {typeof hole.par === 'number' ? hole.par : '—'}
                                  </div>
                                ))}
                                <div className="text-xs text-slate-600 py-1 text-center bg-slate-200 rounded w-10 shrink-0 ml-1 font-semibold">
                                  {parsKnown
                                    ? holes.slice(0, 9).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '—'}
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
                                      toPar < 0 ? 'text-green-600 bg-green-50 font-semibold' :
                                      toPar === 0 ? 'text-slate-700 bg-white' :
                                      toPar === 1 ? 'text-orange-600 bg-orange-50 font-semibold' :
                                      'text-red-600 bg-red-50 font-semibold'
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
                                    {typeof hole.par === 'number' ? hole.par : '—'}
                                  </div>
                                ))}
                                <div className="text-xs text-slate-600 py-1 text-center bg-slate-200 rounded w-10 shrink-0 ml-1 font-semibold">
                                  {parsKnown
                                    ? holes.slice(9, 18).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '—'}
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
                                      toPar < 0 ? 'text-green-600 bg-green-50 font-semibold' :
                                      toPar === 0 ? 'text-slate-700 bg-white' :
                                      toPar === 1 ? 'text-orange-600 bg-orange-50 font-semibold' :
                                      'text-red-600 bg-red-50 font-semibold'
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

      {/* Team roster modal */}
      {teamModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setTeamModal(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Team</div>
                  <div className="font-extrabold text-slate-900">{teamModal.name || 'Team'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamModal(null)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {(teamModal.golferIds || []).map((gid) => {
                const name = resolveGolferName(gid);
                const canEnter = typeof onEnterScores === 'function' && !event.isCompleted && canEditScore?.(eventId, gid);
                return (
                  <button
                    key={gid}
                    type="button"
                    onClick={() => {
                      if (canEnter && onEnterScores) onEnterScores(gid);
                    }}
                    disabled={!canEnter}
                    className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={event.isCompleted ? 'Read-only' : (canEnter ? 'Enter scores' : 'You cannot edit this golfer')}
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 truncate">{name}</div>
                      {!canEnter && <div className="text-[10px] text-slate-500">Read-only</div>}
                    </div>
                    <div className="text-xs font-extrabold text-primary-700">Enter →</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
