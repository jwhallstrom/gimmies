import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import { LoginPage } from './components/LoginPage';
import { TournamentList } from './pages/TournamentList';
import { TournamentDetail } from './pages/TournamentDetail';
import { CreateTournament } from './pages/CreateTournament';
import { UserMenu } from './components/UserMenu';

const App: React.FC = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authUser = await getCurrentUser();
        setUser(authUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-blue-200">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-900/90 backdrop-blur border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">🏆</span>
            </div>
            <span className="text-xl font-bold text-white">Tournaments</span>
          </Link>
          <div className="flex items-center gap-4">
            <a 
              href="https://app.golfwithgimmies.com" 
              className="text-sm text-blue-300 hover:text-blue-200"
            >
              ← Back to Gimmies
            </a>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<TournamentList />} />
          <Route path="/create" element={<CreateTournament />} />
          <Route path="/:id/*" element={<TournamentDetail />} />
        </Routes>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-white/10 z-40">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-around py-2">
          <Link
            to="/"
            className={`flex flex-col items-center p-2 rounded-lg ${
              location.pathname === '/' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs mt-1">Browse</span>
          </Link>
          
          <Link
            to="/my-tournaments"
            className={`flex flex-col items-center p-2 rounded-lg ${
              location.pathname === '/my-tournaments' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs mt-1">My Events</span>
          </Link>
          
          <Link
            to="/create"
            className="flex flex-col items-center p-2 rounded-lg bg-blue-600 text-white -mt-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs mt-1">Create</span>
          </Link>
          
          <Link
            to="/leaderboards"
            className={`flex flex-col items-center p-2 rounded-lg ${
              location.pathname === '/leaderboards' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs mt-1">Live</span>
          </Link>
          
          <Link
            to="/settings"
            className={`flex flex-col items-center p-2 rounded-lg ${
              location.pathname === '/settings' ? 'text-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default App;
