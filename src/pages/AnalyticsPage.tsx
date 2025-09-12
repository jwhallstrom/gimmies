import React from 'react';
import useStore from '../state/store';

const AnalyticsPage: React.FC = () => {
  const { currentProfile } = useStore();

  if (!currentProfile) {
    return <div>Please log in to view analytics.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <h1 className="text-2xl font-bold text-primary-800">Analytics</h1>
        <p className="text-gray-600 mt-1">Your golf performance insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h3 className="text-lg font-semibold text-primary-800">Rounds Played</h3>
          <div className="text-3xl font-bold text-primary-600 mt-2">{currentProfile.stats.roundsPlayed}</div>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h3 className="text-lg font-semibold text-primary-800">Average Score</h3>
          <div className="text-3xl font-bold text-primary-600 mt-2">
            {currentProfile.stats.averageScore > 0 ? currentProfile.stats.averageScore.toFixed(1) : 'N/A'}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h3 className="text-lg font-semibold text-primary-800">Best Score</h3>
          <div className="text-3xl font-bold text-primary-600 mt-2">
            {currentProfile.stats.bestScore > 0 ? currentProfile.stats.bestScore : 'N/A'}
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <h3 className="text-lg font-semibold text-primary-800">Recent Activity</h3>
        <p className="text-gray-600 mt-2">Coming soon: Detailed round history and trends.</p>
      </div>
    </div>
  );
};

export default AnalyticsPage;