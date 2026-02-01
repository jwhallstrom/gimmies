import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadPublicTournaments } from '@gimmies/shared/sync';
import type { Tournament } from '@gimmies/shared/types';
import { formatDateRange, formatCurrency } from '@gimmies/shared/utils';

export const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live'>('all');

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const data = await loadPublicTournaments();
        setTournaments(data);
      } catch (error) {
        console.error('Failed to load tournaments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'upcoming') return t.status === 'registration_open';
    if (filter === 'live') return t.status === 'in_progress';
    return true;
  });

  const getStatusBadge = (status: Tournament['status']) => {
    const styles: Record<string, string> = {
      registration_open: 'bg-green-500/20 text-green-400 border-green-500/30',
      in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    const labels: Record<string, string> = {
      registration_open: 'Registration Open',
      in_progress: 'Live',
      completed: 'Completed',
      draft: 'Draft',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Golf Tournaments</h1>
        <p className="text-slate-400">Find and join tournaments near you</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'upcoming', 'live'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Live Now'}
          </button>
        ))}
      </div>

      {/* Tournament Grid */}
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl">
          <div className="text-4xl mb-4">🏌️</div>
          <p className="text-slate-400 mb-4">No tournaments found</p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <span>Create Tournament</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              to={`/${tournament.id}`}
              className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-blue-500/50 transition-colors"
            >
              {/* Banner */}
              <div className="h-32 bg-gradient-to-br from-blue-600 to-blue-800 relative">
                {tournament.bannerImage && (
                  <img
                    src={tournament.bannerImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(tournament.status)}
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-white text-lg mb-1 line-clamp-1">
                  {tournament.name}
                </h3>
                
                {tournament.courseName && (
                  <p className="text-slate-400 text-sm mb-2 line-clamp-1">
                    📍 {tournament.courseName}
                  </p>
                )}
                
                <p className="text-blue-300 text-sm mb-3">
                  📅 {formatDateRange(tournament.dates)}
                </p>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {tournament.registrations.length}/{tournament.maxPlayers} players
                  </span>
                  {tournament.entryFeeEnabled && tournament.entryFeeCents > 0 && (
                    <span className="text-green-400 font-medium">
                      {formatCurrency(tournament.entryFeeCents)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
