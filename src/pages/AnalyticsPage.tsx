import React from 'react';
import useStore from '../state/store';

const AnalyticsPage: React.FC = () => {
  const { currentProfile, completedRounds } = useStore();

  if (!currentProfile) {
    return <div>Please log in to view analytics.</div>;
  }

  // Filter completed rounds for current profile
  const myCompletedRounds = completedRounds.filter(round => round.golferId === currentProfile.id);

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
        <h3 className="text-lg font-semibold text-primary-800 mb-4">Completed Rounds</h3>
        {myCompletedRounds.length === 0 ? (
          <p className="text-gray-600">No completed rounds yet. Complete an event to see your round history here.</p>
        ) : (
          <div className="space-y-4">
            {myCompletedRounds.map((round) => (
              <div key={round.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-primary-800">{round.eventName}</h4>
                    <p className="text-sm text-gray-600">
                      {new Date(round.datePlayed).toLocaleDateString()} • {round.courseName}
                      {round.teeName && ` • ${round.teeName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">{round.finalScore}</div>
                    <div className={`text-sm font-medium ${round.scoreToPar < 0 ? 'text-green-600' : round.scoreToPar > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {round.scoreToPar > 0 ? '+' : ''}{round.scoreToPar}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Birdies:</span>
                    <span className="font-medium ml-1">{round.stats.birdies}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pars:</span>
                    <span className="font-medium ml-1">{round.stats.pars}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Bogeys:</span>
                    <span className="font-medium ml-1">{round.stats.bogeys}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Holes:</span>
                    <span className="font-medium ml-1">{round.holesPlayed}</span>
                  </div>
                </div>

                {(round.gameResults.nassau || round.gameResults.skins) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">Game Results:</div>
                    <div className="flex gap-4">
                      {round.gameResults.nassau && (
                        <div className="text-sm">
                          <span className="text-gray-600">Nassau:</span>
                          <span className={`font-medium ml-1 ${round.gameResults.nassau.winnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {round.gameResults.nassau.winnings >= 0 ? '+' : ''}${round.gameResults.nassau.winnings.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {round.gameResults.skins && (
                        <div className="text-sm">
                          <span className="text-gray-600">Skins:</span>
                          <span className={`font-medium ml-1 ${round.gameResults.skins.winnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {round.gameResults.skins.winnings >= 0 ? '+' : ''}${round.gameResults.skins.winnings.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;