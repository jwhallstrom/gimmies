/**
 * TeeTimeNotifier - Send personalized tee time notifications to all golfers
 * 
 * KILLER FEATURE: One-tap sends personalized messages to each golfer with:
 * - Their specific tee time
 * - Who they're playing with
 * - Course and date info
 * - Custom welcome message
 * 
 * "Welcome to the Gimmies AM! Weather looks great. You're teeing off at 8:30 AM
 * on Saturday with John Smith, Mike Johnson, and Bob Williams. See you there!"
 */

import React, { useState, useMemo } from 'react';
import type { Tournament, TournamentTeeTime } from '../../state/types';

interface Props {
  tournament: Tournament;
  teeTimes: TournamentTeeTime[];
  onSendTeeTimeNotifications: (options: TeeTimeNotificationOptions) => Promise<SendResult>;
}

export interface TeeTimeNotificationOptions {
  channels: ('push' | 'sms' | 'email')[];
  includeWeather: boolean;
  customIntro: string;
  customOutro: string;
  roundNumber: number;
}

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors?: string[];
}

const TeeTimeNotifier: React.FC<Props> = ({ tournament, teeTimes, onSendTeeTimeNotifications }) => {
  const [selectedChannels, setSelectedChannels] = useState<Set<'push' | 'sms' | 'email'>>(new Set(['sms', 'push']));
  const [includeWeather, setIncludeWeather] = useState(true);
  const [customIntro, setCustomIntro] = useState(`Welcome to ${tournament.name}!`);
  const [customOutro, setCustomOutro] = useState('Good luck and have fun!');
  const [selectedRound, setSelectedRound] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  
  // Get tee times for selected round
  const roundTeeTimes = useMemo(() => {
    return teeTimes.filter(tt => tt.roundNumber === selectedRound);
  }, [teeTimes, selectedRound]);
  
  // Count golfers with tee times
  const golfersWithTeeTimes = useMemo(() => {
    const golferIds = new Set<string>();
    roundTeeTimes.forEach(tt => {
      tt.golferIds.forEach((id: string) => golferIds.add(id));
    });
    return golferIds.size;
  }, [roundTeeTimes]);
  
  // Generate preview message for first golfer
  const previewMessage = useMemo(() => {
    if (roundTeeTimes.length === 0) return null;
    
    const firstTeeTime = roundTeeTimes[0];
    const registrationId = firstTeeTime.golferIds[0];
    const player = tournament.registrations.find(r => r.id === registrationId);
    
    if (!player) return null;
    
    const otherPlayers = firstTeeTime.golferIds
      .filter((id: string) => id !== registrationId)
      .map((id: string) => tournament.registrations.find(r => r.id === id)?.displayName)
      .filter(Boolean);
    
    const teeTimeStr = new Date(`2000-01-01T${firstTeeTime.time}`).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    
    // Use tournament dates for the round
    const roundDate = tournament.dates[selectedRound - 1] || tournament.dates[0];
    const dateStr = new Date(roundDate).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    
    let message = customIntro + '\n\n';
    
    if (includeWeather) {
      message += '☀️ Weather looks great for golf today!\n\n';
    }
    
    message += `⛳ Your tee time: ${teeTimeStr} on ${dateStr}\n`;
    message += `📍 ${tournament.courseName || 'Course TBD'}\n`;
    
    if (otherPlayers.length > 0) {
      message += `\n👥 Playing with: ${otherPlayers.join(', ')}\n`;
    }
    
    if (customOutro) {
      message += `\n${customOutro}`;
    }
    
    return {
      recipientName: player.displayName,
      message,
    };
  }, [roundTeeTimes, tournament, customIntro, customOutro, includeWeather]);
  
  const toggleChannel = (channel: 'push' | 'sms' | 'email') => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };
  
  const handleSend = async () => {
    if (selectedChannels.size === 0 || golfersWithTeeTimes === 0) return;
    
    setIsSending(true);
    setResult(null);
    
    try {
      const sendResult = await onSendTeeTimeNotifications({
        channels: Array.from(selectedChannels),
        includeWeather,
        customIntro,
        customOutro,
        roundNumber: selectedRound,
      });
      
      setResult(sendResult);
    } catch (error) {
      console.error('Failed to send tee time notifications:', error);
      setResult({
        success: false,
        sentCount: 0,
        failedCount: golfersWithTeeTimes,
        errors: ['Failed to send notifications. Please try again.'],
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // Show success state
  if (result?.success) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Tee Times Sent!</h3>
          <p className="text-gray-600 mb-4">
            Successfully sent to {result.sentCount} {result.sentCount === 1 ? 'golfer' : 'golfers'}
          </p>
          
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            {selectedChannels.has('sms') && <span>📱 SMS</span>}
            {selectedChannels.has('push') && <span>🔔 Push</span>}
            {selectedChannels.has('email') && <span>📧 Email</span>}
          </div>
          
          <button
            onClick={() => setResult(null)}
            className="mt-6 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Send Another
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-4 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-2xl">⛳</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">Send Tee Times</h3>
            <p className="text-primary-100 text-sm">
              One tap sends personalized tee times to all golfers
            </p>
          </div>
        </div>
        
        {golfersWithTeeTimes === 0 ? (
          <div className="bg-white/10 rounded-lg p-3 mt-3">
            <p className="text-sm">⚠️ No tee times assigned yet. Create pairings first.</p>
          </div>
        ) : (
          <div className="bg-white/10 rounded-lg p-3 mt-3 flex items-center justify-between">
            <span className="text-sm">Ready to notify</span>
            <span className="font-bold text-lg">{golfersWithTeeTimes} golfers</span>
          </div>
        )}
      </div>
      
      {/* Round Selection (if multi-round) */}
      {tournament.rounds > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Which round?</h4>
          <div className="flex gap-2">
            {Array.from({ length: tournament.rounds }, (_, i) => i + 1).map(round => (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  selectedRound === round
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Round {round}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Channel Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">How should we send it?</h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'sms' as const, label: 'Text', icon: '📱', desc: 'SMS message' },
            { id: 'push' as const, label: 'Push', icon: '🔔', desc: 'App notification' },
            { id: 'email' as const, label: 'Email', icon: '📧', desc: 'Email message' },
          ].map(channel => (
            <button
              key={channel.id}
              onClick={() => toggleChannel(channel.id)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                selectedChannels.has(channel.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{channel.icon}</div>
              <div className="text-sm font-medium text-gray-900">{channel.label}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Select one or more channels. We recommend SMS + Push for best reach.
        </p>
      </div>
      
      {/* Message Customization */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Customize Message</h4>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Welcome Line
            </label>
            <input
              type="text"
              value={customIntro}
              onChange={e => setCustomIntro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Welcome to the tournament!"
            />
          </div>
          
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={includeWeather}
              onChange={e => setIncludeWeather(e.target.checked)}
              className="h-5 w-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <div>
              <div className="font-medium text-gray-900">Include weather note</div>
              <div className="text-sm text-gray-500">☀️ "Weather looks great for golf today!"</div>
            </div>
          </label>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Closing Line
            </label>
            <input
              type="text"
              value={customOutro}
              onChange={e => setCustomOutro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Good luck!"
            />
          </div>
        </div>
      </div>
      
      {/* Preview */}
      {previewMessage && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Preview</h4>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showPreview ? 'Hide' : 'Show'} preview
            </button>
          </div>
          
          {showPreview && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-500 mb-2">
                To: {previewMessage.recipientName}
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {previewMessage.message}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Each golfer receives their own personalized message
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Error Display */}
      {result && !result.success && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium text-red-800">Failed to send</div>
              {result.errors?.map((err, i) => (
                <p key={i} className="text-sm text-red-600">{err}</p>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={isSending || selectedChannels.size === 0 || golfersWithTeeTimes === 0}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors ${
          isSending || selectedChannels.size === 0 || golfersWithTeeTimes === 0
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
        }`}
      >
        {isSending ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Sending to {golfersWithTeeTimes} golfers...
          </>
        ) : (
          <>
            <span className="text-2xl">🚀</span>
            Send Tee Times to {golfersWithTeeTimes} Golfers
          </>
        )}
      </button>
      
      {/* Channel badges */}
      {selectedChannels.size > 0 && !isSending && (
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
          <span>Sending via:</span>
          {selectedChannels.has('sms') && (
            <span className="px-2 py-1 bg-gray-100 rounded-full">📱 SMS</span>
          )}
          {selectedChannels.has('push') && (
            <span className="px-2 py-1 bg-gray-100 rounded-full">🔔 Push</span>
          )}
          {selectedChannels.has('email') && (
            <span className="px-2 py-1 bg-gray-100 rounded-full">📧 Email</span>
          )}
        </div>
      )}
    </div>
  );
};

export default TeeTimeNotifier;
