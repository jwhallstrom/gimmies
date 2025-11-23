import React, { useState } from 'react';
import { useParams, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../state/store';
import { useEventSync } from '../hooks/useEventSync';
import SetupTab from '../components/tabs/SetupTab';
import ScorecardTab from '../components/tabs/ScorecardTab';
import GamesTab from '../components/tabs/GamesTab';
import OverviewTab from '../components/tabs/OverviewTab';
import LeaderboardTab from '../components/tabs/LeaderboardTab';
import ChatTab from '../components/tabs/ChatTab';
import ShareModal from '../components/ShareModal';
import { getCourseById } from '../data/cloudCourses';

const EventPage: React.FC = () => {
  const { id } = useParams();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const location = useLocation();
  
  // Auto-sync event from cloud every 30 seconds
  useEventSync(id, 30000);
  
  const event = useStore(s => 
    s.events.find(e => e.id === id) || 
    s.completedEvents.find(e => e.id === id)
  );
  const { deleteEvent, currentProfile } = useStore();
  const navigate = useNavigate();
  if (!event) return <div>Event not found.</div>;

  // Define tabs (Removed Setup and Chat)
  const tabs = [
    { 
      path: 'scorecard', 
      label: 'Score',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      path: 'leaderboard',
      label: 'Leaders',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="12" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="10.5" y="8" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.8" />
          <rect x="17" y="14" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.4" />
          <rect x="3" y="20" width="18" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
        </svg>
      )
    },
    { 
      path: 'games', 
      label: 'Games',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    },
    { 
      path: 'overview', 
      label: 'Payout',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    }
  ];

  // Determine if we are on a "hidden" tab (Setup or Chat) to highlight the header icon
  const isSetupActive = location.pathname.endsWith('/settings') || location.pathname.endsWith('/settings/');
  const isChatActive = location.pathname.endsWith('/chat') || location.pathname.endsWith('/chat/');

  const courseName = event.course.courseId ? getCourseById(event.course.courseId)?.name : null;

  return (
    <div className="space-y-4">
      <div className="sticky sticky-header-top z-30 bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 -mx-4 -mt-6 px-4 pt-6 pb-2 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 mr-2 min-w-0">
            <h1 className="text-lg font-semibold tracking-wide text-white drop-shadow-sm truncate">{event.name || 'Untitled Event'}</h1>
            {courseName && (
              <div className="text-xs text-primary-200 truncate font-medium">{courseName}</div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Share Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="p-2 rounded-full text-primary-100 hover:bg-primary-700/50 transition-colors"
              title="Invite Players"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>

            {/* Chat Button */}
            <NavLink
              to="chat"
              className={`p-2 rounded-full transition-colors ${isChatActive ? 'bg-white text-primary-800' : 'text-primary-100 hover:bg-primary-700/50'}`}
              title="Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </NavLink>

            {/* Settings/Setup Button */}
            <NavLink
              to="settings"
              className={`p-2 rounded-full transition-colors ${isSetupActive ? 'bg-white text-primary-800' : 'text-primary-100 hover:bg-primary-700/50'}`}
              title="Event Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </NavLink>
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
          {tabs.map(t => (
            <NavLink
              key={t.path}
              to={t.path}
              end={t.path === ''}
              title={t.label}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors shadow-sm min-w-[60px] ${isActive ? 'bg-white text-primary-800' : 'bg-primary-700/40 text-primary-100 hover:bg-primary-600/60'}`
              }
            >
              {t.icon}
              <span className="text-xs text-center leading-tight">{t.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      
      <Routes>
        {/* Default route is now Scorecard */}
        <Route index element={<ScorecardTab eventId={event.id} />} />
        <Route path="scorecard" element={<ScorecardTab eventId={event.id} />} />
        <Route path="settings" element={<SetupTab eventId={event.id} />} />
        <Route path="leaderboard" element={<LeaderboardTab eventId={event.id} />} />
        <Route path="games" element={<GamesTab eventId={event.id} />} />
        <Route path="overview" element={<OverviewTab eventId={event.id} />} />
        <Route path="chat" element={<ChatTab eventId={event.id} />} />
      </Routes>

      <ShareModal 
        eventId={event.id} 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
      />
    </div>
  );
};

export default EventPage;
