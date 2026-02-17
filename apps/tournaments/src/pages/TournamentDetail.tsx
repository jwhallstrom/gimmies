import React from 'react';
import { useParams } from 'react-router-dom';

export const TournamentDetail: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="pb-20">
      <div className="bg-white/5 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-4">Tournament Details</h1>
        <p className="text-slate-400">Tournament ID: {id}</p>
        <p className="text-slate-400 mt-4">
          This page will display full tournament info, leaderboard, tee times, and registration.
        </p>
        <p className="text-blue-300 mt-4">
          ℹ️ Tournament components are being migrated from the main app.
        </p>
      </div>
    </div>
  );
};
