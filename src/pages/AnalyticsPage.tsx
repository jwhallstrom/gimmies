import React from 'react';
import { Link } from 'react-router-dom';
import useStore from '../state/store';
import CircularChart from '../components/CircularChart';

const AnalyticsPage: React.FC = () => {
  const { currentProfile, completedRounds, getProfileRounds } = useStore();

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please create a profile to view analytics.</p>
      </div>
    );
  }

  // Filter completed rounds for current profile
  const myCompletedRounds = completedRounds.filter(round => round.golferId === currentProfile.id);
  
  // Get all rounds (individual + event rounds)
  const allRounds = getProfileRounds(currentProfile.id);
  
  // Filter out individual rounds that are already represented by completed rounds
  // Handle missing type field - if it has grossScore and scores array, treat as individual
  const uniqueIndividualRounds = allRounds.filter(r => 
    (r.type === 'individual' || (!r.type && r.grossScore !== undefined && r.scores)) && !r.completedRoundId
  );
  
  // Calculate comprehensive scoring statistics
  const calculateScoringStats = () => {
    const stats = {
      eagles: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubleBogeys: 0,
      triplesOrWorse: 0,
      totalHoles: 0
    };

    console.log('🔍 Analytics Debug - Starting calculation');
    console.log('  myCompletedRounds count:', myCompletedRounds.length);
    console.log('  uniqueIndividualRounds count:', uniqueIndividualRounds.length);

    // Add stats from completed event rounds
    myCompletedRounds.forEach(round => {
      stats.eagles += round.stats.eagles || 0;
      stats.birdies += round.stats.birdies || 0;
      stats.pars += round.stats.pars || 0;
      stats.bogeys += round.stats.bogeys || 0;
      stats.doubleBogeys += round.stats.doubleBogeys || 0;
      stats.triplesOrWorse += round.stats.triplesOrWorse || 0;
      stats.totalHoles += round.holesPlayed || 0;
    });

    // Add stats from manual individual rounds
    uniqueIndividualRounds.forEach(round => {
      round.scores.forEach(score => {
        if (score.strokes !== null && score.strokes !== undefined) {
          const toPar = score.strokes - score.par;
          stats.totalHoles++;
          
          if (toPar <= -2) stats.eagles++;
          else if (toPar === -1) stats.birdies++;
          else if (toPar === 0) stats.pars++;
          else if (toPar === 1) stats.bogeys++;
          else if (toPar === 2) stats.doubleBogeys++;
          else if (toPar >= 3) stats.triplesOrWorse++;
        }
      });
    });

    return stats;
  };

  const scoringStats = calculateScoringStats();
  
  // Calculate summary stats combining both sources
  const roundsPlayed = myCompletedRounds.length + uniqueIndividualRounds.length;
  
  const totalScoreSum = 
    myCompletedRounds.reduce((sum, r) => sum + r.finalScore, 0) +
    uniqueIndividualRounds.reduce((sum, r) => sum + r.grossScore, 0);
    
  const averageScore = roundsPlayed > 0 ? totalScoreSum / roundsPlayed : 0;
  
  const bestScore = roundsPlayed > 0
    ? Math.min(
        ...myCompletedRounds.map(r => r.finalScore),
        ...uniqueIndividualRounds.map(r => r.grossScore)
      )
    : 0;
  
  // Prepare chart data
  const chartData = [
    { label: 'Eagles', value: scoringStats.eagles, color: '#7c3aed', textColor: 'text-purple-700' },
    { label: 'Birdies', value: scoringStats.birdies, color: '#059669', textColor: 'text-green-700' },
    { label: 'Pars', value: scoringStats.pars, color: '#0284c7', textColor: 'text-blue-700' },
    { label: 'Bogeys', value: scoringStats.bogeys, color: '#ea580c', textColor: 'text-orange-700' },
    { label: 'Doubles', value: scoringStats.doubleBogeys, color: '#dc2626', textColor: 'text-red-700' },
    { label: 'Triples+', value: scoringStats.triplesOrWorse, color: '#991b1b', textColor: 'text-red-800' }
  ].filter(item => item.value > 0); // Only show categories with data

  // Calculate additional metrics
  const totalScoredHoles = scoringStats.totalHoles;
  const subParPercentage = totalScoredHoles > 0 
    ? ((scoringStats.eagles + scoringStats.birdies) / totalScoredHoles * 100).toFixed(1)
    : '0.0';
  const parOrBetterPercentage = totalScoredHoles > 0 
    ? ((scoringStats.eagles + scoringStats.birdies + scoringStats.pars) / totalScoredHoles * 100).toFixed(1)
    : '0.0';
  const overParPercentage = totalScoredHoles > 0 
    ? ((scoringStats.bogeys + scoringStats.doubleBogeys + scoringStats.triplesOrWorse) / totalScoredHoles * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <h1 className="text-2xl font-bold text-primary-800">Analytics</h1>
        <p className="text-gray-600 mt-1">Your golf performance insights</p>
      </div>

      {/* Key Stats - Compact Layout */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-4 border border-primary-900/5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{roundsPlayed}</div>
            <div className="text-sm text-gray-600">Rounds</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {averageScore > 0 ? averageScore.toFixed(1) : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {bestScore > 0 ? bestScore : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Best Score</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {currentProfile.handicapIndex !== undefined ? currentProfile.handicapIndex.toFixed(1) : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Handicap</div>
          </div>
        </div>
      </div>

      {/* Scoring Performance */}
      {totalScoredHoles > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scoring Breakdown Chart */}
          <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
            <h3 className="text-lg font-semibold text-primary-800 mb-4">Scoring Breakdown</h3>
            <div className="flex justify-center">
              <CircularChart
                data={chartData}
                size={240}
                strokeWidth={24}
                centerText={totalScoredHoles.toString()}
                centerSubtext="Total Holes"
              />
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
            <h3 className="text-lg font-semibold text-primary-800 mb-4">Performance Metrics</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-green-800 font-medium">Sub-Par Rate</span>
                <span className="text-2xl font-bold text-green-600">{subParPercentage}%</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-800 font-medium">Par or Better</span>
                <span className="text-2xl font-bold text-blue-600">{parOrBetterPercentage}%</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-orange-800 font-medium">Over Par Rate</span>
                <span className="text-2xl font-bold text-orange-600">{overParPercentage}%</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{scoringStats.eagles}</div>
                  <div className="text-sm text-gray-600">Total Eagles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{scoringStats.birdies}</div>
                  <div className="text-sm text-gray-600">Total Birdies</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-8 border border-primary-900/5 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Scoring Data Yet</h3>
          <p className="text-gray-500">Add some individual rounds or complete events to see your scoring analytics.</p>
        </div>
      )}

      {/* Recent Performance Trends */}
      {allRounds.length > 0 && (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h3 className="text-lg font-semibold text-primary-800 mb-4">Recent Rounds</h3>
          <div className="space-y-3">
            {allRounds.slice(0, 5).map((round) => {
              const totalPar = round.scores?.reduce((sum, score) => sum + score.par, 0) || 72;
              const toPar = round.grossScore - totalPar;
              const linkTo = round.eventId ? `/event/${round.eventId}` : `/handicap/round/${round.id}`;
              
              return (
                <Link 
                  key={round.id} 
                  to={linkTo}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        round.type === 'event' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {round.type === 'event' ? 'Event' : 'Individual'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-primary-700">{round.courseName}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(round.date).toLocaleDateString()} • {round.teeName}
                          {round.eventName && ` • ${round.eventName}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary-600">{round.grossScore}</div>
                      <div className={`text-sm font-medium ${toPar < 0 ? 'text-green-600' : toPar > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {toPar > 0 ? '+' : ''}{toPar}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {allRounds.length > 5 && (
            <div className="text-center mt-4">
              <p className="text-sm text-gray-500">Showing 5 most recent rounds</p>
            </div>
          )}
        </div>
      )}

      {/* Completed Event Rounds Detail */}
      {myCompletedRounds.length > 0 && (
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
          <h3 className="text-lg font-semibold text-primary-800 mb-4">Event Results & Winnings</h3>
          <div className="space-y-4">
            {myCompletedRounds.map((round) => (
              <Link 
                key={round.id} 
                to={`/event/${round.eventId}`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-colors group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold text-primary-800 group-hover:text-primary-600">{round.eventName}</h4>
                    <p className="text-sm text-gray-600">
                      {new Date(round.datePlayed).toLocaleDateString()} • {round.courseName}
                      {round.teeName && ` • ${round.teeName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-600">{round.finalScore}</div>
                      <div className={`text-sm font-medium ${round.scoreToPar < 0 ? 'text-green-600' : round.scoreToPar > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {round.scoreToPar > 0 ? '+' : ''}{round.scoreToPar}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-purple-600">Eagles:</span>
                    <span className="font-medium ml-1">{round.stats.eagles}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Birdies:</span>
                    <span className="font-medium ml-1">{round.stats.birdies}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Pars:</span>
                    <span className="font-medium ml-1">{round.stats.pars}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Bogeys:</span>
                    <span className="font-medium ml-1">{round.stats.bogeys}</span>
                  </div>
                  <div>
                    <span className="text-red-600">Doubles+:</span>
                    <span className="font-medium ml-1">{round.stats.doubleBogeys + round.stats.triplesOrWorse}</span>
                  </div>
                </div>

                {(round.gameResults.nassau || round.gameResults.skins) && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Game Results:</div>
                    <div className="flex gap-6">
                      {round.gameResults.nassau && (
                        <div className="text-sm">
                          <span className="text-gray-600">Nassau:</span>
                          <span className={`font-bold ml-2 ${round.gameResults.nassau.winnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {round.gameResults.nassau.winnings >= 0 ? '+' : ''}${round.gameResults.nassau.winnings.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {round.gameResults.skins && (
                        <div className="text-sm">
                          <span className="text-gray-600">Skins:</span>
                          <span className={`font-bold ml-2 ${round.gameResults.skins.winnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {round.gameResults.skins.winnings >= 0 ? '+' : ''}${round.gameResults.skins.winnings.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;