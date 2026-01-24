/**
 * AdminNotificationCenter - Communication hub for tournament admins
 * 
 * Features:
 * - Send push notifications, SMS, and emails
 * - Pre-built message templates (tee times, weather, welcome)
 * - Recipient selection (all, specific divisions, individuals)
 * - Message history/log
 * 
 * Designed for non-tech-savvy admins: big buttons, clear labels, templates ready to go
 */

import React, { useState, useMemo } from 'react';
import type { Tournament, TournamentRegistration } from '../../state/types';

interface Props {
  tournament: Tournament;
  onSendMessage: (message: MessagePayload) => Promise<void>;
}

export interface MessagePayload {
  id: string;
  type: 'push' | 'sms' | 'email' | 'all';
  recipients: 'all' | 'division' | 'individual';
  recipientIds?: string[]; // profile IDs or division IDs
  subject?: string;
  message: string;
  sentAt: string;
  sentBy: string;
}

type MessageChannel = 'push' | 'sms' | 'email';
type RecipientType = 'all' | 'division' | 'individual';

interface MessageTemplate {
  id: string;
  name: string;
  icon: string;
  subject?: string;
  message: string;
  channels: MessageChannel[];
}

const AdminNotificationCenter: React.FC<Props> = ({ tournament, onSendMessage }) => {
  const [selectedChannels, setSelectedChannels] = useState<Set<MessageChannel>>(new Set(['push']));
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [sentSuccess, setSentSuccess] = useState(false);
  
  // Message templates - admin-friendly pre-written messages
  const templates: MessageTemplate[] = useMemo(() => [
    {
      id: 'welcome',
      name: 'Welcome Message',
      icon: '👋',
      subject: `Welcome to ${tournament.name}!`,
      message: `Welcome to ${tournament.name}! We're excited to have you. Check your tee times in the app and arrive 30 minutes early for check-in. Good luck!`,
      channels: ['push', 'email'],
    },
    {
      id: 'tee_times',
      name: 'Tee Times Announcement',
      icon: '⛳',
      subject: `Your Tee Time for ${tournament.name}`,
      message: `Tee times are now posted for ${tournament.name}! Open the app to see your tee time and playing partners. See you on the course!`,
      channels: ['push', 'sms', 'email'],
    },
    {
      id: 'weather',
      name: 'Weather Update',
      icon: '🌤️',
      subject: `Weather Update - ${tournament.name}`,
      message: `Weather update for ${tournament.name}: [EDIT THIS] Looks like a great day for golf! Remember to bring sunscreen and stay hydrated.`,
      channels: ['push', 'sms'],
    },
    {
      id: 'delay',
      name: 'Delay / Schedule Change',
      icon: '⏰',
      subject: `Schedule Update - ${tournament.name}`,
      message: `SCHEDULE UPDATE: [EDIT THIS] Due to [reason], we are delaying the start by [time]. New first tee time is [time]. Thank you for your patience!`,
      channels: ['push', 'sms', 'email'],
    },
    {
      id: 'reminder',
      name: 'Day Before Reminder',
      icon: '📅',
      subject: `Reminder: ${tournament.name} Tomorrow!`,
      message: `Reminder: ${tournament.name} is TOMORROW! Don't forget to check your tee time in the app. Arrive 30 minutes early for check-in. See you there!`,
      channels: ['push', 'sms', 'email'],
    },
    {
      id: 'results',
      name: 'Results Posted',
      icon: '🏆',
      subject: `Results Posted - ${tournament.name}`,
      message: `The results for ${tournament.name} are now posted! Check the app for final standings and payouts. Thanks for playing!`,
      channels: ['push', 'email'],
    },
    {
      id: 'custom',
      name: 'Custom Message',
      icon: '✏️',
      message: '',
      channels: ['push', 'sms', 'email'],
    },
  ], [tournament.name]);
  
  const toggleChannel = (channel: MessageChannel) => {
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
  
  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const selectTemplate = (template: MessageTemplate) => {
    setSubject(template.subject || '');
    setMessage(template.message);
    setSelectedChannels(new Set(template.channels));
    setShowTemplates(false);
  };
  
  const recipientCount = useMemo(() => {
    if (recipientType === 'all') {
      return tournament.registrations.length;
    } else if (recipientType === 'division') {
      return tournament.registrations.filter(r => 
        r.divisionId && selectedRecipients.has(r.divisionId)
      ).length;
    }
    return selectedRecipients.size;
  }, [recipientType, selectedRecipients, tournament.registrations]);
  
  const canSend = selectedChannels.size > 0 && message.trim().length > 0 && recipientCount > 0;
  
  const handleSend = async () => {
    if (!canSend) return;
    
    setIsSending(true);
    try {
      await onSendMessage({
        id: `msg_${Date.now()}`,
        type: selectedChannels.size === 3 ? 'all' : Array.from(selectedChannels)[0],
        recipients: recipientType,
        recipientIds: recipientType !== 'all' ? Array.from(selectedRecipients) : undefined,
        subject,
        message,
        sentAt: new Date().toISOString(),
        sentBy: 'admin', // Will be replaced with actual admin ID
      });
      
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        setMessage('');
        setSubject('');
        setShowTemplates(true);
      }, 2000);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // Show success state
  if (sentSuccess) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
          <p className="text-gray-600">
            Your message has been sent to {recipientCount} {recipientCount === 1 ? 'golfer' : 'golfers'}.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Send Message to Golfers</h3>
            <p className="text-sm text-gray-500">{tournament.registrations.length} registered golfers</p>
          </div>
        </div>
      </div>
      
      {/* Templates */}
      {showTemplates && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Quick Templates</h4>
          <p className="text-sm text-gray-500 mb-4">Tap a template to start, or write your own message</p>
          <div className="grid grid-cols-2 gap-2">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                className="p-3 text-left rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
              >
                <div className="text-2xl mb-1">{template.icon}</div>
                <div className="text-sm font-medium text-gray-900">{template.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Message Composer */}
      {!showTemplates && (
        <>
          {/* Back to templates */}
          <button
            onClick={() => setShowTemplates(true)}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to templates
          </button>
          
          {/* Channel Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-3">How do you want to send this?</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'push' as MessageChannel, label: 'Push Notification', icon: '🔔', desc: 'App notification' },
                { id: 'sms' as MessageChannel, label: 'Text Message', icon: '📱', desc: 'SMS to phone' },
                { id: 'email' as MessageChannel, label: 'Email', icon: '📧', desc: 'Email message' },
              ].map(channel => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.id)}
                  className={`flex-1 min-w-[100px] p-3 rounded-xl border-2 text-center transition-all ${
                    selectedChannels.has(channel.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{channel.icon}</div>
                  <div className="text-sm font-medium text-gray-900">{channel.label}</div>
                  <div className="text-xs text-gray-500">{channel.desc}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Recipients */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Who should receive this?</h4>
            <div className="space-y-2">
              <button
                onClick={() => { setRecipientType('all'); setSelectedRecipients(new Set()); }}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  recipientType === 'all'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Everyone</div>
                    <div className="text-sm text-gray-500">All {tournament.registrations.length} registered golfers</div>
                  </div>
                  {recipientType === 'all' && (
                    <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              
              {tournament.divisions.length > 0 && (
                <button
                  onClick={() => setRecipientType('division')}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    recipientType === 'division'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">By Division</div>
                      <div className="text-sm text-gray-500">Select specific flights</div>
                    </div>
                    {recipientType === 'division' && (
                      <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              )}
              
              <button
                onClick={() => setRecipientType('individual')}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  recipientType === 'individual'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Specific Golfers</div>
                    <div className="text-sm text-gray-500">Choose individuals</div>
                  </div>
                  {recipientType === 'individual' && (
                    <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            </div>
            
            {/* Division picker */}
            {recipientType === 'division' && tournament.divisions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600 mb-2">Select divisions:</div>
                <div className="flex flex-wrap gap-2">
                  {tournament.divisions.map(div => (
                    <button
                      key={div.id}
                      onClick={() => toggleRecipient(div.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedRecipients.has(div.id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {div.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Individual picker */}
            {recipientType === 'individual' && (
              <div className="mt-3 pt-3 border-t border-gray-100 max-h-48 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-2">Select golfers:</div>
                <div className="space-y-1">
                  {tournament.registrations.map(reg => {
                    const recipientKey = reg.profileId || reg.id;
                    const displayName = reg.displayName || reg.guestName || 'Unknown';
                    return (
                      <button
                        key={reg.id}
                        onClick={() => toggleRecipient(recipientKey)}
                        className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors flex items-center justify-between ${
                          selectedRecipients.has(recipientKey)
                            ? 'bg-primary-100 text-primary-900'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span>{displayName}</span>
                        {selectedRecipients.has(recipientKey) && (
                          <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Message Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Your Message</h4>
            
            {selectedChannels.has('email') && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{message.length} characters</span>
                {selectedChannels.has('sms') && message.length > 160 && (
                  <span className="text-xs text-orange-600">
                    SMS will be split ({Math.ceil(message.length / 160)} messages)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!canSend || isSending}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-colors ${
              canSend && !isSending
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                Send to {recipientCount} {recipientCount === 1 ? 'Golfer' : 'Golfers'}
              </>
            )}
          </button>
          
          {/* Preview what they'll receive */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Preview</h5>
            <div className="space-y-2 text-sm">
              {selectedChannels.has('push') && (
                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-200">
                  <span className="text-lg">🔔</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{tournament.name}</div>
                    <div className="text-gray-600 line-clamp-2">{message || 'Your message here...'}</div>
                  </div>
                </div>
              )}
              {selectedChannels.has('sms') && (
                <div className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-200">
                  <span className="text-lg">📱</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-600 line-clamp-3">{message || 'Your message here...'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminNotificationCenter;
