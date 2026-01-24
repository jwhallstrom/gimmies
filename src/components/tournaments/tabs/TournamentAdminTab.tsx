/**
 * TournamentAdminTab - Comprehensive admin control center
 * 
 * Sections:
 * - Communications (notifications, tee times, announcements)
 * - Player Management (registrations, payments, refunds)
 * - Chat/Announcements
 * 
 * Designed for non-tech-savvy admins: big buttons, clear labels, grouped logically
 */

import React, { useState } from 'react';
import useStore from '../../../state/store';
import AdminNotificationCenter, { MessagePayload } from '../AdminNotificationCenter';
import AdminPlayerManagement from '../AdminPlayerManagement';
import TournamentChat, { ChatMessage, ChatMode } from '../TournamentChat';
import TeeTimeNotifier, { TeeTimeNotificationOptions } from '../TeeTimeNotifier';

interface Props {
  tournamentId: string;
}

type AdminSection = 'communications' | 'players' | 'chat';

const TournamentAdminTab: React.FC<Props> = ({ tournamentId }) => {
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const currentProfile = useStore(s => s.currentProfile);
  const { 
    removeFromTournament,
    updateRegistrationPaymentStatus,
  } = useStore();
  
  const [activeSection, setActiveSection] = useState<AdminSection>('communications');
  const [commSubSection, setCommSubSection] = useState<'notify' | 'teetimes'>('notify');
  
  // Mock chat state (in production, would be from backend)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>('announcements_only');
  
  if (!tournament || !currentProfile) return null;
  
  const isOrganizer = currentProfile.id === tournament.organizerId;
  if (!isOrganizer) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-4xl mb-3">🔒</div>
        <p>Admin access required</p>
      </div>
    );
  }
  
  // Handlers
  const handleSendMessage = async (payload: MessagePayload): Promise<void> => {
    // In production: send to backend notification service
    console.log('Sending message:', payload);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add to local message log if it's a chat message
    if (payload.recipients === 'all') {
      setChatMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        tournamentId,
        authorId: currentProfile.id,
        authorName: currentProfile.name || 'Organizer',
        authorRole: 'organizer',
        content: payload.message,
        type: 'announcement',
        timestamp: new Date().toISOString(),
      }]);
    }
  };
  
  const handleSendTeeTimeNotifications = async (options: TeeTimeNotificationOptions) => {
    // In production: call backend to send personalized tee time messages
    console.log('Sending tee time notifications:', options);
    
    // Get golfers with tee times
    const roundTeeTimes = tournament.teeTimes.filter(tt => tt.roundNumber === options.roundNumber);
    const golferIds = new Set<string>();
    roundTeeTimes.forEach(tt => tt.golferIds.forEach((id: string) => golferIds.add(id)));
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      sentCount: golferIds.size,
      failedCount: 0,
    };
  };
  
  const handleRemovePlayer = (registrationId: string, reason?: string) => {
    console.log('Removing player:', registrationId, reason);
    removeFromTournament(tournamentId, registrationId);
  };
  
  const handleRefundPlayer = async (registrationId: string, amountCents: number, reason: string) => {
    // In production: process refund through payment provider
    console.log('Processing refund:', registrationId, amountCents, reason);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update payment status
    updateRegistrationPaymentStatus(tournamentId, registrationId, 'refunded');
    
    return { success: true, refundId: `refund_${Date.now()}` };
  };
  
  const handleUpdatePaymentStatus = (registrationId: string, status: 'paid' | 'pending' | 'refunded') => {
    updateRegistrationPaymentStatus(tournamentId, registrationId, status);
  };
  
  const handleSendChatMessage = (content: string, type: 'announcement' | 'message') => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      tournamentId,
      authorId: currentProfile.id,
      authorName: currentProfile.name || 'Organizer',
      authorRole: 'organizer',
      content,
      type,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, newMessage]);
  };
  
  const handleDeleteChatMessage = (messageId: string) => {
    setChatMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, isDeleted: true } : m
    ));
  };
  
  const handlePinChatMessage = (messageId: string, pinned: boolean) => {
    setChatMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, isPinned: pinned } : m
    ));
  };
  
  return (
    <div className="space-y-4">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-lg">Admin Control Center</h2>
            <p className="text-gray-400 text-sm">Manage communications, players & settings</p>
          </div>
        </div>
      </div>
      
      {/* Section Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'communications' as AdminSection, label: 'Communications', icon: '📣' },
          { id: 'players' as AdminSection, label: 'Players', icon: '👥' },
          { id: 'chat' as AdminSection, label: 'Chat Board', icon: '💬' },
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-colors ${
              activeSection === section.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{section.icon}</span>
            {section.label}
          </button>
        ))}
      </div>
      
      {/* Communications Section */}
      {activeSection === 'communications' && (
        <div className="space-y-4">
          {/* Sub-section toggle */}
          <div className="bg-gray-100 p-1 rounded-xl flex">
            <button
              onClick={() => setCommSubSection('notify')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                commSubSection === 'notify'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔔 Send Notification
            </button>
            <button
              onClick={() => setCommSubSection('teetimes')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                commSubSection === 'teetimes'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⛳ Tee Times
            </button>
          </div>
          
          {commSubSection === 'notify' ? (
            <AdminNotificationCenter
              tournament={tournament}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <TeeTimeNotifier
              tournament={tournament}
              teeTimes={tournament.teeTimes}
              onSendTeeTimeNotifications={handleSendTeeTimeNotifications}
            />
          )}
        </div>
      )}
      
      {/* Players Section */}
      {activeSection === 'players' && (
        <AdminPlayerManagement
          tournament={tournament}
          onRemovePlayer={handleRemovePlayer}
          onRefundPlayer={handleRefundPlayer}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
        />
      )}
      
      {/* Chat Section */}
      {activeSection === 'chat' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <div className="font-semibold text-blue-900">About Tournament Chat</div>
                <p className="text-sm text-blue-700 mt-1">
                  Use this to post updates and announcements that all participants can see in the app.
                  You control who can post: just you (announcements only) or everyone (open discussion).
                </p>
              </div>
            </div>
          </div>
          
          <TournamentChat
            tournament={tournament}
            currentUserId={currentProfile.id}
            currentUserName={currentProfile.name || 'Organizer'}
            isOrganizer={isOrganizer}
            messages={chatMessages}
            chatMode={chatMode}
            onSendMessage={handleSendChatMessage}
            onDeleteMessage={handleDeleteChatMessage}
            onPinMessage={handlePinChatMessage}
            onChangeChatMode={setChatMode}
          />
        </div>
      )}
      
      {/* Quick Stats Footer */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{tournament.registrations.length}</div>
            <div className="text-xs text-gray-500">Registered</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {tournament.registrations.filter(r => r.paymentStatus === 'paid').length}
            </div>
            <div className="text-xs text-gray-500">Paid</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-600">{tournament.teeTimes.length}</div>
            <div className="text-xs text-gray-500">Tee Times</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentAdminTab;
