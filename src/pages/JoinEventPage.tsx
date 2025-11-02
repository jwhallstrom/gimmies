import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../state/store';

const JoinEventPage: React.FC = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { joinEventByCode, events } = useStore();
  const [message, setMessage] = useState('Joining event...');
  const [eventJoined, setEventJoined] = useState<any>(null);

  useEffect(() => {
    const handleJoin = async () => {
      if (code) {
        // Check if user has a profile, if not redirect to dashboard to create one
        const currentProfile = useStore.getState().currentProfile;
        if (!currentProfile) {
          setMessage('Please create a profile first to join events.');
          setTimeout(() => {
            navigate('/');
          }, 2000);
          return;
        }

        const result = await joinEventByCode(code.toUpperCase());
        if (result.success) {
          // Find the event that was just joined
          const joinedEvent = events.find(e => e.shareCode === code.toUpperCase());
          setEventJoined(joinedEvent);
          setMessage('Successfully joined the event!');
          // Redirect to the event after a short delay
          setTimeout(() => {
            if (joinedEvent) {
              navigate(`/event/${joinedEvent.id}`);
            }
          }, 2000);
        } else {
          setMessage(result.error || 'Invalid or expired share code.');
        }
      }
    };

    handleJoin();
  }, [code, joinEventByCode, events, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            {eventJoined ? '✓' : '!'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {eventJoined ? 'Joined Event!' : 'Join Event'}
          </h1>
          <p className="text-gray-600 mb-6">{message}</p>

          {eventJoined && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h2 className="font-semibold text-gray-900">{eventJoined.name || 'Untitled Event'}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {eventJoined.date} • {eventJoined.golfers.length} players
              </p>
            </div>
          )}

          <div className="space-y-3">
            {!eventJoined && (
              <button
                onClick={() => navigate('/')}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded hover:bg-primary-700 transition"
              >
                {message.includes('log in') ? 'Go to Login' : 'Go to Events'}
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition"
            >
              {eventJoined ? 'Continue to Event' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinEventPage;
