/**
 * TournamentResultsTab - Final standings and results
 */

import React, { useMemo } from 'react';
import useStore from '../../../state/store';
import { getCourseById } from '../../../data/cloudCourses';
import type { TournamentRegistration } from '../../../state/types';

interface Props {
  tournamentId: string;
}

const TournamentResultsTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { profiles } = useStore();
  
  if (!tournament) return null;
  
  const course = tournament.courseId ? getCourseById(tournament.courseId) : null;
  const totalPar = (course?.tees?.[0]?.par || 72) * tournament.rounds;
  
  const getRegistration = (id: string): TournamentRegistration | undefined => {
    return tournament.registrations.find(r => r.id === id);
  };
  
  const getProfile = (registration: TournamentRegistration | undefined) => {
    if (!registration?.profileId) return null;
    return profiles.find(p => p.id === registration.profileId);
  };
  
  // Build results with round-by-round scores
  const results = useMemo(() => {
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
  
  const formatPosition = (position: number, isTied: boolean) => {
    return isTied ? `T${position}` : `${position}`;
  };
  
  const formatToPar = (total: number, parTotal: number) => {
    const diff = total - parTotal;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };
  
  // Winner info
  const winner = results[0];
  const runnerUp = results[1];
  const third = results[2];
  
  if (tournament.status !== 'completed') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Results Pending</h3>
        <p className="text-sm text-gray-500">
          Final results will be available once the tournament is complete.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Winner Podium */}
      {winner && (
        <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-xl p-6 text-white text-center">
          <div className="text-sm font-semibold opacity-90 mb-2">CHAMPION</div>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden">
            {winner.profile?.avatar ? (
              <img src={winner.profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold">{winner.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-1">{winner.name}</h2>
          <div className="text-4xl font-black mb-1">
            {winner.grossTotal} ({formatToPar(winner.grossTotal, totalPar)})
          </div>
          <div className="text-sm opacity-90">
            {tournament.rounds} round{tournament.rounds !== 1 ? 's' : ''}
          </div>
        </div>
      )}
      
      {/* Runner-ups */}
      {(runnerUp || third) && (
        <div className="grid grid-cols-2 gap-3">
          {runnerUp && (
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-gray-500 mb-2">2ND PLACE</div>
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden">
                {runnerUp.profile?.avatar ? (
                  <img src={runnerUp.profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-gray-600">{runnerUp.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="font-semibold text-gray-900 text-sm truncate">{runnerUp.name}</div>
              <div className="text-lg font-bold text-gray-700">{runnerUp.grossTotal}</div>
            </div>
          )}
          {third && (
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-orange-600 mb-2">3RD PLACE</div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden">
                {third.profile?.avatar ? (
                  <img src={third.profile.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-orange-600">{third.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="font-semibold text-gray-900 text-sm truncate">{third.name}</div>
              <div className="text-lg font-bold text-gray-700">{third.grossTotal}</div>
            </div>
          )}
        </div>
      )}
      
      {/* Full Results Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Final Standings</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left w-12">Pos</th>
                <th className="px-4 py-2 text-left">Player</th>
                {tournament.rounds > 1 && Array.from({ length: tournament.rounds }, (_, i) => (
                  <th key={i} className="px-3 py-2 text-center">R{i + 1}</th>
                ))}
                <th className="px-4 py-2 text-center">Total</th>
                <th className="px-4 py-2 text-center">To Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((result, index) => (
                <tr 
                  key={result.registrationId}
                  className={index < 3 ? 'bg-yellow-50/50' : ''}
                >
                  <td className="px-4 py-3 font-bold text-gray-700">
                    {formatPosition(result.position, result.isTied)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {result.profile?.avatar ? (
                          <img src={result.profile.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary-600 font-semibold text-sm">
                            {result.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{result.name}</div>
                        {result.registration?.handicapSnapshot != null && (
                          <div className="text-xs text-gray-500">
                            HCP: {result.registration.handicapSnapshot.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {tournament.rounds > 1 && result.roundTotals.map((rt, i) => (
                    <td key={i} className="px-3 py-3 text-center text-sm text-gray-600">
                      {rt.gross || '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold text-gray-900">
                    {result.grossTotal}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    <span className={
                      result.grossTotal - totalPar < 0 ? 'text-red-600' :
                      result.grossTotal - totalPar > 0 ? 'text-blue-600' :
                      'text-gray-600'
                    }>
                      {formatToPar(result.grossTotal, totalPar)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Tournament Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Tournament Stats</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Participants</div>
            <div className="font-semibold text-gray-900">{results.length}</div>
          </div>
          <div>
            <div className="text-gray-500">Rounds Played</div>
            <div className="font-semibold text-gray-900">{tournament.rounds}</div>
          </div>
          <div>
            <div className="text-gray-500">Lowest Round</div>
            <div className="font-semibold text-gray-900">
              {results.length > 0 
                ? Math.min(...results.flatMap(r => r.roundTotals.map(rt => rt.gross).filter(g => g > 0)))
                : '-'
              }
            </div>
          </div>
          <div>
            <div className="text-gray-500">Average Score</div>
            <div className="font-semibold text-gray-900">
              {results.length > 0
                ? (results.reduce((s, r) => s + r.grossTotal, 0) / results.length / tournament.rounds).toFixed(1)
                : '-'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentResultsTab;
