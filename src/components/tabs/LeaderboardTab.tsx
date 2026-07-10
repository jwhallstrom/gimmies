import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';
import { courseHandicap, strokesForHole } from '../../games/handicap';
import { distributeHandicapStrokes, calculateCourseHandicap } from '../../utils/handicap';
import { getTee } from '../../data/cloudCourses';
import { courseMap } from '../../data/courses';
import { formatSignedMoney } from '../../hooks/useMyEventPayout';

type Props = {
  eventId: string;
  onEnterScores?: (golferId: string) => void;
  chatUnread?: number;
  onOpenChat?: () => void;
  showMoneyChip?: boolean;
  myNet?: number | null;
  onOpenPayouts?: () => void;
  showStatsChip?: boolean;
  onOpenStats?: () => void;
  showHighlightsChip?: boolean;
  onOpenHighlights?: () => void;
  insightsExpanded?: boolean;
  onToggleInsights?: () => void;
};

const LeaderboardTab: React.FC<Props> = ({
  eventId,
  onEnterScores,
  chatUnread = 0,
  onOpenChat,
  showMoneyChip = false,
  myNet = null,
  onOpenPayouts,
  showStatsChip = false,
  onOpenStats,
  showHighlightsChip = false,
  onOpenHighlights,
  insightsExpanded = true,
  onToggleInsights,
}) => {
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

  const hasInsightsRail =
    onOpenChat ||
    (showMoneyChip && onOpenPayouts) ||
    (showStatsChip && onOpenStats) ||
    (showHighlightsChip && onOpenHighlights);

  const collapsedBadgeCount =
    (chatUnread > 0 ? 1 : 0) +
    (showHighlightsChip ? 1 : 0) +
    (showStatsChip ? 1 : 0) +
    (showMoneyChip && myNet != null ? 1 : 0);

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
    if (position === 1) return 'text-slate-900 dark:text-slate-100 font-bold';
    if (position === 2) return 'text-slate-700 dark:text-slate-300 font-semibold';
    if (position === 3) return 'text-slate-600 dark:text-slate-400 font-semibold';
    return 'text-slate-500 dark:text-slate-500';
  };

  // PGA/Masters convention: Red = under par, Black = even/over
  const getToParColor = (toPar: number | null) => {
    if (toPar === null) return 'text-gray-400 dark:text-slate-500';
    if (toPar < 0) return 'text-red-600 dark:text-red-400';
    if (toPar === 0) return 'text-slate-800 dark:text-slate-100';
    return 'text-slate-800 dark:text-slate-100';
  };

  const getHoleScoreCellClass = (strokes: number | null | undefined, toPar: number | null) => {
    if (strokes == null) return 'text-slate-400 dark:text-slate-500';
    if (toPar === null) return 'text-slate-800 dark:text-slate-100';
    if (toPar <= -2) return 'text-green-700 dark:text-green-400 font-bold bg-green-100 dark:bg-green-950/60';
    if (toPar === -1) return 'text-red-700 dark:text-red-400 font-semibold bg-red-100 dark:bg-red-950/60';
    if (toPar === 0) return 'text-slate-800 dark:text-slate-100';
    if (toPar === 1) return 'text-blue-700 dark:text-blue-300 font-semibold bg-blue-100 dark:bg-blue-950/60';
    return 'text-blue-900 dark:text-blue-200 font-semibold bg-blue-200 dark:bg-blue-900/70';
  };

  const nineTotalClass =
    'text-xs py-1 text-center font-mono font-bold w-10 shrink-0 ml-1 rounded bg-slate-200 text-slate-900 dark:bg-slate-600 dark:text-white';

  // Check if any golfer has handicap data (to show Gross/Net toggle)
  const hasHandicapData = useMemo(() => {
    return event.golfers.some((g: any) => {
      const ch = courseHandicap(event, g.profileId || g.customName, profiles);
      return ch != null && ch !== 0;
    });
  }, [event, profiles]);

  return (
    <div className="w-full">
      <div className="bg-slate-50 dark:bg-slate-800/95 sm:rounded-lg border-y sm:border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
        {/* Header bar with toggles */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-slate-800 dark:bg-slate-950 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Leaderboard</span>
          {hasHandicapData && (
            <div className="flex gap-0.5 text-[11px] font-semibold rounded-md overflow-hidden border border-slate-600 bg-slate-900">
              <button
                onClick={() => setScoreMode('gross')}
                className={`px-3 py-1.5 transition-colors ${scoreMode === 'gross' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Gross
              </button>
              <button
                onClick={() => setScoreMode('net')}
                className={`px-3 py-1.5 transition-colors ${scoreMode === 'net' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Net
              </button>
            </div>
          )}
        </div>

        {hasInsightsRail && (
          <div className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/95">
            {insightsExpanded ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  {onToggleInsights && (
                    <button
                      type="button"
                      onClick={onToggleInsights}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700 flex-shrink-0"
                      aria-label="Collapse insights"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                      </svg>
                      Insights
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={onOpenChat}
                      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                    >
                      <span aria-hidden>💬</span>
                      <span>Chat</span>
                      {chatUnread > 0 && (
                        <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {chatUnread > 9 ? '9+' : chatUnread}
                        </span>
                      )}
                    </button>
                  )}
                  {showHighlightsChip && onOpenHighlights && (
                    <button
                      type="button"
                      onClick={onOpenHighlights}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                    >
                      <span aria-hidden>⭐</span>
                      <span>Highlights</span>
                    </button>
                  )}
                  {showStatsChip && onOpenStats && (
                    <button
                      type="button"
                      onClick={onOpenStats}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                    >
                      <span aria-hidden>📊</span>
                      <span>Holes</span>
                    </button>
                  )}
                  {showMoneyChip && onOpenPayouts && myNet != null && (
                    <button
                      type="button"
                      onClick={onOpenPayouts}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors flex-shrink-0 ${
                        myNet > 0
                          ? 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-green-700 dark:text-green-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                          : myNet < 0
                            ? 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span aria-hidden>💰</span>
                      <span className="tabular-nums">{formatSignedMoney(myNet)}</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onToggleInsights}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                aria-label="Expand insights"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Insights</span>
                <div className="flex items-center gap-1.5 ml-1">
                  {chatUnread > 0 && (
                    <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-full">
                      💬 {chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                  {showHighlightsChip && <span className="text-xs" aria-hidden>⭐</span>}
                  {showStatsChip && <span className="text-xs" aria-hidden>📊</span>}
                  {showMoneyChip && myNet != null && (
                    <span className="text-[10px] font-bold text-slate-600 tabular-nums">{formatSignedMoney(myNet)}</span>
                  )}
                </div>
                {collapsedBadgeCount === 0 && (
                  <span className="text-[10px] text-slate-400 ml-auto">Standings only</span>
                )}
              </button>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/90 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-600">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">Pos</th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">Player</th>
                {hasTeams && <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">Team</th>}
                <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">
                  {scoreMode === 'net' ? 'Net' : 'Score'}
                </th>
                <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">Thru</th>
                <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wide">Tot</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((player, index) => (
                <React.Fragment key={player.id}>
                  <tr 
                    className={`border-b border-slate-100 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-700/40 cursor-pointer transition-colors ${
                      player.position === 1 ? 'bg-white/60 dark:bg-slate-700/25' : ''
                    } ${expandedPlayer === player.id ? 'bg-white dark:bg-slate-900/80' : ''}`}
                    onClick={() => togglePlayerExpanded(player.id)}
                  >
                    <td className={`px-3 py-3 font-mono text-center ${getPositionColor(player.position || 0)}`}>
                      {player.position ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-sm font-bold ${
                          player.position === 1 ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' :
                          player.position === 2 ? 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100' :
                          player.position === 3 ? 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {player.position}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
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
                            className="truncate max-w-[140px] sm:max-w-none text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 disabled:text-slate-400 disabled:cursor-not-allowed"
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
                    <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                      {player.holesPlayed >= 18 ? (
                        <span className="text-green-600 dark:text-green-400 font-semibold">F</span>
                      ) : (
                        player.holesPlayed || '-'
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500 dark:text-slate-400 font-mono text-sm">
                      {player.holesPlayed > 0 ? (scoreMode === 'net' ? player.netStrokes : player.totalStrokes) : '-'}
                    </td>
                  </tr>
                  {expandedPlayer === player.id && (
                    <tr>
                      <td colSpan={hasTeams ? 6 : 5} className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{player.name}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {event.isCompleted ? 'Final scorecard' : 'Scorecard preview'}
                                {typeof onEnterScores === 'function' && !event.isCompleted && canEditScore?.(eventId, player.id) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEnterScores(player.id);
                                    }}
                                    className="ml-2 text-primary-600 dark:text-primary-400 font-semibold hover:underline"
                                  >
                                    Edit scores
                                  </button>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setExpandedPlayer(null)}
                              className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label="Close scorecard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Front 9 */}
                          <div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Front Nine</div>
                            <div className="flex flex-col gap-1">
                              {/* Hole numbers 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-12 shrink-0">Hole</div>
                                {holes.slice(0, 9).map((hole) => (
                                  <div key={`hole-${hole.number}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-8 shrink-0">
                                    {hole.number}
                                  </div>
                                ))}
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-10 shrink-0 ml-1">Out</div>
                              </div>
                              
                              {/* Par 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-12 shrink-0">Par</div>
                                {holes.slice(0, 9).map((hole) => (
                                  <div key={`par-${hole.number}`} className="text-xs text-slate-600 dark:text-slate-300 py-1 text-center w-8 shrink-0">
                                    {typeof hole.par === 'number' ? hole.par : '-'}
                                  </div>
                                ))}
                                <div className={`${nineTotalClass} font-semibold`}>
                                  {parsKnown
                                    ? holes.slice(0, 9).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '-'}
                                </div>
                              </div>
                              
                              {/* Player scores 1-9 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 py-1 text-center w-12 shrink-0">Score</div>
                                {holes.slice(0, 9).map((hole) => {
                                  const playerScores = getPlayerScorecard(player.id);
                                  const scoreForHole = playerScores.find((s: any) => s.hole === hole.number);
                                  const strokes = scoreForHole?.strokes;
                                  const par = holeParByNumber[hole.number];
                                  const toPar = strokes != null && typeof par === 'number' ? strokes - par : null;
                                  
                                  return (
                                    <div key={`score-${hole.number}`} className={`text-xs py-1 text-center font-mono rounded w-8 shrink-0 ${getHoleScoreCellClass(strokes, toPar)}`}>
                                      {strokes ?? '-'}
                                    </div>
                                  );
                                })}
                                <div className={nineTotalClass}>
                                  {player.outStrokes || '-'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Back 9 */}
                          <div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Back Nine</div>
                            <div className="flex flex-col gap-1">
                              {/* Hole numbers 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-12 shrink-0">Hole</div>
                                {holes.slice(9, 18).map((hole) => (
                                  <div key={`hole-${hole.number}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-8 shrink-0">
                                    {hole.number}
                                  </div>
                                ))}
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-10 shrink-0 ml-1">In</div>
                              </div>
                              
                              {/* Par 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 py-1 text-center w-12 shrink-0">Par</div>
                                {holes.slice(9, 18).map((hole) => (
                                  <div key={`par-${hole.number}`} className="text-xs text-slate-600 dark:text-slate-300 py-1 text-center w-8 shrink-0">
                                    {typeof hole.par === 'number' ? hole.par : '-'}
                                  </div>
                                ))}
                                <div className={`${nineTotalClass} font-semibold`}>
                                  {parsKnown
                                    ? holes.slice(9, 18).reduce((sum: number, h: any) => sum + (h.par as number), 0)
                                    : '-'}
                                </div>
                              </div>
                              
                              {/* Player scores 10-18 */}
                              <div className="flex gap-1">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 py-1 text-center w-12 shrink-0">Score</div>
                                {holes.slice(9, 18).map((hole) => {
                                  const playerScores = getPlayerScorecard(player.id);
                                  const scoreForHole = playerScores.find((s: any) => s.hole === hole.number);
                                  const strokes = scoreForHole?.strokes;
                                  const par = holeParByNumber[hole.number];
                                  const toPar = strokes != null && typeof par === 'number' ? strokes - par : null;
                                  
                                  return (
                                    <div key={`score-${hole.number}`} className={`text-xs py-1 text-center font-mono rounded w-8 shrink-0 ${getHoleScoreCellClass(strokes, toPar)}`}>
                                      {strokes ?? '-'}
                                    </div>
                                  );
                                })}
                                <div className={nineTotalClass}>
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


