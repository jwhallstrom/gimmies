import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * EventsPage - Now redirects to Home
 * 
 * Events are now unified into the Dashboard (Home) page.
 * This component handles redirects and deep-link support.
 */
const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Preserve query params for deep-linking (e.g., ?create=true)
    const search = location.search;
    
    // If there's a create param, redirect to home where the FAB can handle it
    // Otherwise just go to home
    navigate(`/${search}`, { replace: true });
  }, [navigate, location.search]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecting...</p>
      </div>
    </div>
  );
};

export default EventsPage;