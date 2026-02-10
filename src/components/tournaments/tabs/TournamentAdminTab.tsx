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

import React, { useState, useMemo } from 'react';
import useStore from '../../../state/store';
import AdminNotificationCenter, { MessagePayload } from '../AdminNotificationCenter';
import AdminPlayerManagement from '../AdminPlayerManagement';
import TournamentChat, { ChatMessage, ChatMode } from '../TournamentChat';
import TeeTimeNotifier, { TeeTimeNotificationOptions } from '../TeeTimeNotifier';

interface Props {
  tournamentId: string;
}

type AdminSection = 'communications' | 'players' | 'chat' | 'email_list' | 'export';

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
  
  // ─── Email List (auto-built from registrations) ───
  const emailList = useMemo(() => {
    return tournament.registrations
      .filter(r => r.email && r.marketingConsent !== false)
      .map(r => ({
        name: r.displayName || r.guestName || 'Unknown',
        email: r.email!,
        phone: r.phone,
        paymentStatus: r.paymentStatus,
        registeredAt: r.createdAt,
      }));
  }, [tournament.registrations]);

  const [blastSubject, setBlastSubject] = useState('');
  const [blastBody, setBlastBody] = useState('');
  const [blastSending, setBlastSending] = useState(false);
  const [blastSent, setBlastSent] = useState(false);
  
  const handleSendBlast = async () => {
    if (!blastSubject.trim() || !blastBody.trim() || emailList.length === 0) return;
    setBlastSending(true);
    // In production: POST to backend email service
    console.log('Sending email blast to', emailList.length, 'recipients:', {
      subject: blastSubject,
      body: blastBody,
      recipients: emailList.map(c => c.email),
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    setBlastSending(false);
    setBlastSent(true);
    setBlastSubject('');
    setBlastBody('');
    setTimeout(() => setBlastSent(false), 4000);
  };
  
  // ─── CSV Export ───
  const handleExportCSV = (type: 'players' | 'payments' | 'scores') => {
    let csv = '';
    const now = new Date().toISOString().split('T')[0];
    let filename = '';
    
    if (type === 'players') {
      csv = 'Name,Email,Phone,Handicap,Division,Payment Status,Registered At,Marketing Consent\n';
      tournament.registrations.forEach(r => {
        const div = r.divisionId ? tournament.divisions.find(d => d.id === r.divisionId)?.name || '' : '';
        csv += `"${r.displayName || r.guestName || ''}","${r.email || ''}","${r.phone || ''}","${r.handicapSnapshot ?? ''}","${div}","${r.paymentStatus}","${r.createdAt}","${r.marketingConsent ? 'Yes' : 'No'}"\n`;
      });
      filename = `${tournament.name.replace(/[^a-zA-Z0-9]/g, '_')}_players_${now}.csv`;
    } else if (type === 'payments') {
      const totalCollected = tournament.registrations
        .filter(r => r.paymentStatus === 'paid')
        .length * tournament.entryFeeCents;
      csv = 'Name,Email,Payment Status,Entry Fee,Registered At\n';
      tournament.registrations.forEach(r => {
        const fee = r.paymentStatus === 'paid' ? (tournament.entryFeeCents / 100).toFixed(2) : '0.00';
        csv += `"${r.displayName || r.guestName || ''}","${r.email || ''}","${r.paymentStatus}","$${fee}","${r.createdAt}"\n`;
      });
      csv += `\nTotal Collected,,"","$${(totalCollected / 100).toFixed(2)}"\n`;
      filename = `${tournament.name.replace(/[^a-zA-Z0-9]/g, '_')}_payments_${now}.csv`;
    } else if (type === 'scores') {
      // Build header: Name, R1 H1..H18, R1 Total, R2 H1..H18, R2 Total, ...
      const headers = ['Name'];
      tournament.roundsData.forEach(round => {
        for (let h = 1; h <= 18; h++) headers.push(`R${round.roundNumber} H${h}`);
        headers.push(`R${round.roundNumber} Total`);
      });
      headers.push('Grand Total');
      csv = headers.join(',') + '\n';
      
      tournament.registrations.forEach(reg => {
        const row: string[] = [reg.displayName || reg.guestName || ''];
        let grandTotal = 0;
        tournament.roundsData.forEach(round => {
          const sc = round.scorecards.find(s => s.registrationId === reg.id);
          let roundTotal = 0;
          for (let h = 1; h <= 18; h++) {
            const score = sc?.scores.find((s: any) => s.hole === h);
            const val = score?.strokes ?? '';
            row.push(String(val));
            if (typeof val === 'number') roundTotal += val;
          }
          row.push(String(roundTotal || ''));
          grandTotal += roundTotal;
        });
        row.push(String(grandTotal || ''));
        csv += row.map(v => `"${v}"`).join(',') + '\n';
      });
      filename = `${tournament.name.replace(/[^a-zA-Z0-9]/g, '_')}_scores_${now}.csv`;
    }
    
    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
          { id: 'email_list' as AdminSection, label: 'Email List', icon: '📧', badge: emailList.length || undefined },
          { id: 'export' as AdminSection, label: 'Export', icon: '📥' },
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
            {'badge' in section && (section as any).badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeSection === section.id ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
              }`}>
                {(section as any).badge}
              </span>
            )}
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
      
      {/* Email List Section */}
      {activeSection === 'email_list' && (
        <div className="space-y-4">
          {/* Email List Header */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900">Email List</div>
                <p className="text-sm text-gray-600 mt-0.5">
                  Auto-built from registrations with marketing consent. {emailList.length} contact{emailList.length !== 1 ? 's' : ''} opted in.
                </p>
              </div>
            </div>
          </div>
          
          {/* Contact Table */}
          {emailList.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Name</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-700">Email</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-700 hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {emailList.map((contact, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{contact.name}</td>
                        <td className="px-4 py-2.5 text-gray-600 truncate max-w-[180px]">{contact.email}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            contact.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {contact.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">No contacts yet. They'll appear as players register and opt in.</p>
            </div>
          )}
          
          {/* Quick Blast Email */}
          {emailList.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send to {emailList.length} Contact{emailList.length !== 1 ? 's' : ''}
              </h4>
              
              <input
                type="text"
                placeholder="Subject line — e.g. 'Next Tournament: Spring Open'"
                value={blastSubject}
                onChange={e => setBlastSubject(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <textarea
                placeholder="Message body..."
                value={blastBody}
                onChange={e => setBlastBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
              
              {blastSent && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sent to {emailList.length} recipient{emailList.length !== 1 ? 's' : ''}!
                </div>
              )}
              
              <button
                onClick={handleSendBlast}
                disabled={blastSending || !blastSubject.trim() || !blastBody.trim()}
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {blastSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Email Blast
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Export Email List */}
          {emailList.length > 0 && (
            <button
              onClick={() => {
                let csv = 'Name,Email,Phone,Payment Status,Registered At\n';
                emailList.forEach(c => {
                  csv += `"${c.name}","${c.email}","${c.phone || ''}","${c.paymentStatus}","${c.registeredAt}"\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${tournament.name.replace(/[^a-zA-Z0-9]/g, '_')}_email_list.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Email List CSV
            </button>
          )}
        </div>
      )}
      
      {/* Export Section */}
      {activeSection === 'export' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-gray-900">Export Reports</div>
                <p className="text-sm text-gray-600 mt-0.5">
                  Download CSV files for record-keeping, GHIN upload, or accounting.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Players Export */}
            <button
              onClick={() => handleExportCSV('players')}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Player Roster</div>
                <div className="text-sm text-gray-500">
                  {tournament.registrations.length} player{tournament.registrations.length !== 1 ? 's' : ''} — name, email, handicap, division, payment
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            
            {/* Payments Export */}
            <button
              onClick={() => handleExportCSV('payments')}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Payment Report</div>
                <div className="text-sm text-gray-500">
                  ${((tournament.registrations.filter(r => r.paymentStatus === 'paid').length * tournament.entryFeeCents) / 100).toFixed(2)} collected — entry fees, payment status
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            
            {/* Scores Export */}
            <button
              onClick={() => handleExportCSV('scores')}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">Scorecards</div>
                <div className="text-sm text-gray-500">
                  {tournament.roundsData.length} round{tournament.roundsData.length !== 1 ? 's' : ''} — hole-by-hole scores, ready for GHIN upload
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
          
          {/* Quick Summary */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Quick Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-2xl font-bold text-gray-900">{tournament.registrations.length}</div>
                <div className="text-gray-500">Total Players</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-2xl font-bold text-green-600">
                  ${((tournament.registrations.filter(r => r.paymentStatus === 'paid').length * tournament.entryFeeCents) / 100).toFixed(2)}
                </div>
                <div className="text-gray-500">Revenue</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-2xl font-bold text-amber-600">
                  {tournament.registrations.filter(r => r.paymentStatus === 'pending').length}
                </div>
                <div className="text-gray-500">Pending Payment</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-2xl font-bold text-indigo-600">{emailList.length}</div>
                <div className="text-gray-500">Email Opt-ins</div>
              </div>
            </div>
          </div>
        </div>
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
