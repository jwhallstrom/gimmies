import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900">
      <Routes>
        <Route path="/" element={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center space-y-6 p-8">
              <div className="text-6xl mb-4">🏌️</div>
              <h1 className="text-4xl font-bold text-white mb-2">Gimmies Club</h1>
              <p className="text-xl text-slate-300 mb-8">
                Tournament Management for Golf Clubs
              </p>
              <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-auto">
                <h2 className="text-lg font-semibold text-white mb-2">Coming Soon</h2>
                <p className="text-slate-400 text-sm">
                  Club dashboard features are being migrated to this standalone app.
                  For now, access club features at:
                </p>
                <a 
                  href="https://app.golfwithgimmies.com/club"
                  className="mt-4 inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Go to Main App
                </a>
              </div>
            </div>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
