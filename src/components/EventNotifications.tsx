/**
 * EventNotifications - Simplified notification center for Events
 * 
 * Features:
 * - Send tee time alerts
 * - Round recap notifications
 * - Quick message templates
 * 
 * Simpler than tournament admin - focused on essentials
 */

import React, { useState, useMemo } from 'react';
import type { Event } from '../state/types';
import { generateRoundRecap, generateRecapPushMessage } from '../utils/roundRecap';

interface Props {
  event: Event;
  onClose: () => void;
}

type NotificationType = 'tee_time' | 'reminder' | 'recap' | 'custom';

const EventNotifications: React.FC<Props> = ({ event, onClose }) => {
  const [selectedType, setSelectedType] = useState<NotificationType | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [teeTime, setTeeTime] = useState('08:00');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  
  const golferCount = event.golfers.length;
  
  // Generate round recap
  const recap = useMemo(() => generateRoundRecap(event), [event]);
  const recapPush = useMemo(() => generateRecapPushMessage(recap), [recap]);
  
  // Check if round has scores
  const hasScores = event.scorecards.some(sc => sc.scores.length > 0);
  
  // Helper to get golfer name
  const getGolferName = (golfer: typeof event.golfers[0]) => {
    return golfer.displayName || golfer.customName || 'Unknown';
  };
  
  // Get course name - blank for now, could be looked up by courseId
  const courseName = '';
  
  const handleSend = async () => {
    if (!selectedType) return;
    
    setIsSending(true);
    
    // Simulate sending (in production, call notification service)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Sending notification:', {
      type: selectedType,
      eventId: event.id,
      golferCount,
      teeTime: selectedType === 'tee_time' ? teeTime : undefined,
      message: selectedType === 'custom' ? customMessage : undefined,
      recap: selectedType === 'recap' ? recap : undefined,
    });
    
    setIsSending(false);
    setSent(true);
  };
  
  // Success state
  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full sm:max-w-md rounded-xl shadow-2xl p-6 animate-slide-up">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sent!</h3>
            <p className="text-gray-600 mb-6">
              Notification sent to {golferCount} golfer{golferCount !== 1 ? 's' : ''}
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-primary-600 px-4 py-4 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Notify Group</h2>
            <p className="text-sm text-primary-100">{golferCount} golfers</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Notification Type Selection */}
          {!selectedType && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                What would you like to send?
              </p>
              
              {/* Tee Time */}
              <button
                onClick={() => setSelectedType('tee_time')}
                className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">⛳</div>
                  <div>
                    <div className="font-semibold text-gray-900">Tee Time Alert</div>
                    <div className="text-sm text-gray-500">
                      Send your tee time with playing partners
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Reminder */}
              <button
                onClick={() => setSelectedType('reminder')}
                className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">📅</div>
                  <div>
                    <div className="font-semibold text-gray-900">Game Reminder</div>
                    <div className="text-sm text-gray-500">
                      Remind everyone about the upcoming round
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Round Recap (only if scores exist) */}
              {hasScores && (
                <button
                  onClick={() => setSelectedType('recap')}
                  className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">🏁</div>
                    <div>
                      <div className="font-semibold text-gray-900">Round Recap</div>
                      <div className="text-sm text-gray-500">
                        Share highlights: low score, birdies, skins & more
                      </div>
                    </div>
                  </div>
                </button>
              )}
              
              {/* Custom Message */}
              <button
                onClick={() => setSelectedType('custom')}
                className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">✏️</div>
                  <div>
                    <div className="font-semibold text-gray-900">Custom Message</div>
                    <div className="text-sm text-gray-500">
                      Write your own message
                    </div>
                  </div>
                </div>
              </button>
            </>
          )}
          
          {/* Tee Time Form */}
          {selectedType === 'tee_time' && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">⛳</div>
                <h3 className="text-lg font-bold text-gray-900">Tee Time Alert</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tee Time
                </label>
                <input
                  type="time"
                  value={teeTime}
                  onChange={e => setTeeTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-2">Preview</div>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">⛳ {event.name}</div>
                  <div className="text-gray-600 mt-1">
                    Tee time: {new Date(`2000-01-01T${teeTime}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    <br />
                    {courseName || 'Course'} • {new Date(event.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    <br />
                    <br />
                    Playing: {event.golfers.slice(0, 3).map(g => getGolferName(g)).join(', ')}
                    {event.golfers.length > 3 && ` +${event.golfers.length - 3} more`}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Reminder Form */}
          {selectedType === 'reminder' && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📅</div>
                <h3 className="text-lg font-bold text-gray-900">Game Reminder</h3>
              </div>
              
              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-xs text-gray-500 mb-2">Message Preview</div>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">📅 Reminder: {event.name}</div>
                  <div className="text-gray-600 mt-1">
                    Don't forget! We're playing {new Date(event.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    {courseName && ` at ${courseName}`}.
                    <br /><br />
                    See you on the course! ⛳
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Round Recap Preview */}
          {selectedType === 'recap' && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">🏁</div>
                <h3 className="text-lg font-bold text-gray-900">Round Recap</h3>
              </div>
              
              {/* Highlights Preview */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <div className="text-xs text-gray-500 mb-2">Highlights to Share</div>
                
                {recap.highlights.length === 0 ? (
                  <p className="text-sm text-gray-500">No highlights yet - need more scores!</p>
                ) : (
                  recap.highlights.slice(0, 5).map((highlight, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-lg">{highlight.emoji}</span>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{highlight.title}</div>
                        <div className="text-xs text-gray-600">{highlight.description}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Push Preview */}
              <div className="bg-gray-900 rounded-xl p-4 text-white">
                <div className="text-xs text-gray-400 mb-2">Push Notification</div>
                <div className="font-semibold text-sm">{recapPush.title}</div>
                <div className="text-sm text-gray-300 mt-1">{recapPush.body}</div>
              </div>
            </div>
          )}
          
          {/* Custom Message Form */}
          {selectedType === 'custom' && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">✏️</div>
                <h3 className="text-lg font-bold text-gray-900">Custom Message</h3>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Message
                </label>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {customMessage.length} characters
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        {selectedType && (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button
              onClick={handleSend}
              disabled={isSending || (selectedType === 'custom' && !customMessage.trim()) || (selectedType === 'recap' && recap.highlights.length === 0)}
              className={`w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
                isSending || (selectedType === 'custom' && !customMessage.trim()) || (selectedType === 'recap' && recap.highlights.length === 0)
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
              }`}
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send to {golferCount} Golfers
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventNotifications;
