/**
 * TournamentScoreHubTab - Combined scoring and live leaderboard
 * Mirrors the ScoreHubTab pattern from events
 */

import React, { useState, useMemo } from 'react';
import useStore from '../../../state/store';
import { getCourseById, getHole } from '../../../data/cloudCourses';
import type { TournamentRegistration, TournamentStanding, ScoreEntry } from '../../../state/types';

interface Props {
  tournamentId: string;
}

const TournamentScoreHubTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { currentProfile, profiles, updateTournamentScore, recalculateStandings } = useStore();
  const [selectedRound, setSelectedRound] = useState(1);
  const [activeView, setActiveView] = useState<'leaderboard' | 'scorecard'>('leaderboard');
  const [selectedGolferId, setSelectedGolferId] = useState<string | null>(null);
  
  if (!tournament) return null;
  
  const isOrganizer = currentProfile?.id === tournament.organizerId;
  const currentRound = tournament.roundsData.find(r => r.roundNumber === selectedRound);
  const course = tournament.courseId ? getCourseById(tournament.courseId) : null;
  
  // Get registration details
  const getRegistration = (id: string): TournamentRegistration | undefined => {
    return tournament.registrations.find(r => r.id === id);
  };
  
  const getProfile = (registration: TournamentRegistration | undefined) => {
    if (!registration?.profileId) return null;
    return profiles.find(p => p.id === registration.profileId);
  };
  
  // Leaderboard data from standings
  const leaderboard = useMemo(() => {
    return tournament.standings
      .map(standing => {
        const registration = getRegistration(standing.registrationId);
        const profile = getProfile(registration);
        return {
          ...standing,
          registration,
          profile,
          name: registration?.displayName || registration?.guestName || 'Unknown',
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [tournament.standings, tournament.registrations, profiles]);
  
  // Get scorecard for selected golfer
  const selectedScorecard = useMemo(() => {
    if (!selectedGolferId || !currentRound) return null;
    return currentRound.scorecards.find(sc => sc.registrationId === selectedGolferId);
  }, [selectedGolferId, currentRound]);
  
  const selectedRegistration = selectedGolferId ? getRegistration(selectedGolferId) : null;
  
  // Handle score entry
  const handleScoreChange = (hole: number, strokes: number | null) => {
    if (!selectedGolferId) return;
    updateTournamentScore(tournamentId, selectedRound, selectedGolferId, hole, strokes);
  };
  
  const formatPosition = (position: number, isTied: boolean) => {
    return isTied ? `T${position}` : `${position}`;
  };
  
  const formatToPar = (total: number) => {
    const par = course?.tees?.[0]?.par || 72;
    const toPar = total - par;
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };
  
  // Leaderboard View
  const LeaderboardView = () => (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div className="w-10">Pos</div>
          <div className="flex-1">Player</div>
          <div className="w-16 text-center">Thru</div>
          <div className="w-16 text-center">Total</div>
        </div>
        
        {leaderboard.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No scores yet. Start entering scores to see the leaderboard.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.registration?.profileId === currentProfile?.id;
              const bgColor = index < 3 
                ? index === 0 ? 'bg-yellow-50' : index === 1 ? 'bg-gray-50' : 'bg-orange-50'
                : isCurrentUser ? 'bg-primary-50' : '';
              
              return (
                <button
                  key={entry.registrationId}
                  onClick={() => {
                    setSelectedGolferId(entry.registrationId);
                    setActiveView('scorecard');
                  }}
                  className={`w-full flex items-center px-4 py-3 hover:bg-gray-50 transition-colors ${bgColor}`}
                >
                  <div className="w-10 font-bold text-gray-700">
                    {formatPosition(entry.position, entry.isTied)}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {entry.profile?.avatar ? (
                        <img src={entry.profile.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary-600 font-semibold text-sm">
                          {entry.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 text-sm">{entry.name}</div>
                      {entry.registration?.handicapSnapshot != null && (
                        <div className="text-xs text-gray-500">
                          HCP: {entry.registration.handicapSnapshot.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-16 text-center text-sm text-gray-600">
                    {entry.thru > 0 ? entry.thru : '-'}
                  </div>
                  <div className="w-16 text-center font-bold text-gray-900">
                    {entry.grossTotal > 0 ? formatToPar(entry.grossTotal) : '-'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Quick Add Score Button */}
      {(isOrganizer || tournament.registrations.some(r => r.profileId === currentProfile?.id)) && (
        <button
          onClick={() => {
            const myReg = tournament.registrations.find(r => r.profileId === currentProfile?.id);
            if (myReg) {
              setSelectedGolferId(myReg.id);
              setActiveView('scorecard');
            } else if (isOrganizer && tournament.registrations.length > 0) {
              setSelectedGolferId(tournament.registrations[0].id);
              setActiveView('scorecard');
            }
          }}
          className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Enter Scores
        </button>
      )}
    </div>
  );
  
  // Scorecard View
  const ScorecardView = () => {
    if (!selectedScorecard || !selectedRegistration) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">Select a player from the leaderboard to view their scorecard.</p>
          <button
            onClick={() => setActiveView('leaderboard')}
            className="mt-4 text-primary-600 font-medium hover:text-primary-700"
          >
            Back to Leaderboard
          </button>
        </div>
      );
    }
    
    const holes = Array.from({ length: 18 }, (_, i) => i + 1);
    const frontNine = holes.slice(0, 9);
    const backNine = holes.slice(9, 18);
    
    const getScore = (hole: number): number | null => {
      const entry = selectedScorecard.scores.find(s => s.hole === hole);
      return entry?.strokes ?? null;
    };
    
    const getHolePar = (hole: number): number => {
      if (!course) return 4;
      const holeData = getHole(tournament.courseId!, hole, tournament.roundsData[0]?.teeName);
      return holeData?.par || 4;
    };
    
    const calculateTotal = (holeRange: number[]): number => {
      return holeRange.reduce((sum, hole) => sum + (getScore(hole) || 0), 0);
    };
    
    const profile = getProfile(selectedRegistration);
    const name = selectedRegistration.displayName || selectedRegistration.guestName || 'Unknown';
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveView('leaderboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Leaderboard
          </button>
          
          {/* Player Selector */}
          <select
            value={selectedGolferId || ''}
            onChange={e => setSelectedGolferId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {tournament.registrations
              .filter(r => !r.waitingListPosition)
              .map(r => (
                <option key={r.id} value={r.id}>
                  {r.displayName || r.guestName || 'Unknown'}
                </option>
              ))
            }
          </select>
        </div>
        
        {/* Player Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-600 font-bold text-lg">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{name}</div>
            <div className="text-sm text-gray-500">
              Round {selectedRound} • {calculateTotal(holes) > 0 ? `${calculateTotal(holes)} (${formatToPar(calculateTotal(holes))})` : 'No scores'}
            </div>
          </div>
        </div>
        
        {/* Scorecard Grid */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Front Nine */}
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs font-semibold text-gray-500 mb-2">FRONT NINE</div>
            <div className="grid grid-cols-10 gap-1">
              {/* Headers */}
              {frontNine.map(hole => (
                <div key={hole} className="text-center">
                  <div className="text-xs text-gray-500">{hole}</div>
                  <div className="text-xs text-gray-400">{getHolePar(hole)}</div>
                </div>
              ))}
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold">OUT</div>
                <div className="text-xs text-gray-400">{frontNine.reduce((s, h) => s + getHolePar(h), 0)}</div>
              </div>
              
              {/* Scores */}
              {frontNine.map(hole => {
                const score = getScore(hole);
                const par = getHolePar(hole);
                const diff = score ? score - par : 0;
                const bgColor = !score ? '' : diff < 0 ? 'bg-red-100' : diff > 0 ? 'bg-blue-100' : 'bg-green-100';
                
                return (
                  <input
                    key={hole}
                    type="number"
                    min="1"
                    max="15"
                    value={score ?? ''}
                    onChange={e => handleScoreChange(hole, e.target.value ? parseInt(e.target.value, 10) : null)}
                    className={`w-full h-8 text-center text-sm font-semibold border border-gray-200 rounded ${bgColor} focus:ring-2 focus:ring-primary-500`}
                  />
                );
              })}
              <div className="flex items-center justify-center h-8 bg-gray-100 rounded font-bold text-sm">
                {calculateTotal(frontNine) || '-'}
              </div>
            </div>
          </div>
          
          {/* Back Nine */}
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">BACK NINE</div>
            <div className="grid grid-cols-10 gap-1">
              {/* Headers */}
              {backNine.map(hole => (
                <div key={hole} className="text-center">
                  <div className="text-xs text-gray-500">{hole}</div>
                  <div className="text-xs text-gray-400">{getHolePar(hole)}</div>
                </div>
              ))}
              <div className="text-center">
                <div className="text-xs text-gray-500 font-semibold">IN</div>
                <div className="text-xs text-gray-400">{backNine.reduce((s, h) => s + getHolePar(h), 0)}</div>
              </div>
              
              {/* Scores */}
              {backNine.map(hole => {
                const score = getScore(hole);
                const par = getHolePar(hole);
                const diff = score ? score - par : 0;
                const bgColor = !score ? '' : diff < 0 ? 'bg-red-100' : diff > 0 ? 'bg-blue-100' : 'bg-green-100';
                
                return (
                  <input
                    key={hole}
                    type="number"
                    min="1"
                    max="15"
                    value={score ?? ''}
                    onChange={e => handleScoreChange(hole, e.target.value ? parseInt(e.target.value, 10) : null)}
                    className={`w-full h-8 text-center text-sm font-semibold border border-gray-200 rounded ${bgColor} focus:ring-2 focus:ring-primary-500`}
                  />
                );
              })}
              <div className="flex items-center justify-center h-8 bg-gray-100 rounded font-bold text-sm">
                {calculateTotal(backNine) || '-'}
              </div>
            </div>
          </div>
          
          {/* Total */}
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex justify-between items-center">
            <span className="font-semibold text-gray-700">TOTAL</span>
            <span className="text-lg font-bold text-gray-900">
              {calculateTotal(holes) > 0 ? calculateTotal(holes) : '-'}
            </span>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Round Selector */}
      {tournament.rounds > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map(round => (
            <button
              key={round}
              onClick={() => setSelectedRound(round)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                selectedRound === round
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Round {round}
            </button>
          ))}
        </div>
      )}
      
      {activeView === 'leaderboard' ? <LeaderboardView /> : <ScorecardView />}
    </div>
  );
};

export default TournamentScoreHubTab;
