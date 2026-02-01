import React from 'react';
import { Link } from 'react-router-dom';

export const CreateTournament: React.FC = () => {
  return (
    <div className="pb-20">
      <div className="bg-white/5 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-4">Create Tournament</h1>
        <p className="text-slate-400 mb-6">
          Set up a new golf tournament with custom formats, divisions, and entry fees.
        </p>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-300 text-sm">
            ℹ️ The tournament creation wizard is being migrated from the main app. 
            Full functionality coming soon!
          </p>
        </div>
        
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
        >
          ← Back to tournaments
        </Link>
      </div>
    </div>
  );
};
