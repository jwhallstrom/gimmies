import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChatTab from '../tabs/ChatTab';
import { getChatTargetId, markChatAsRead } from '../../utils/chatUnread';
import useStore from '../../state/store';

interface EventChatSheetProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenFullChat?: () => void;
  unreadCount?: number;
}

const EventChatSheet: React.FC<EventChatSheetProps> = ({
  eventId,
  isOpen,
  onClose,
  onOpenFullChat,
  unreadCount = 0,
}) => {
  const event = useStore((s) =>
    s.events.find((e) => e.id === eventId) || s.completedEvents.find((e) => e.id === eventId)
  );

  useEffect(() => {
    if (!isOpen || !event) return;
    const targetId = getChatTargetId(event);
    markChatAsRead(targetId);
  }, [isOpen, event?.id, event?.parentGroupId]);

  if (!isOpen) return null;

  const handleOpenFull = () => {
    onClose();
    onOpenFullChat?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close chat"
        onClick={onClose}
      />
      <div
        className="relative mx-auto w-full max-w-lg flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up"
        style={{ maxHeight: 'min(72vh, 640px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg" aria-hidden>💬</span>
            <div className="min-w-0">
              <div className="font-bold text-sm text-gray-900 dark:text-white">Event Chat</div>
              {event?.parentGroupId && (
                <div className="text-[10px] text-primary-600 dark:text-primary-400 truncate">Group thread</div>
              )}
            </div>
            {unreadCount > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenFullChat && (
              <button
                type="button"
                onClick={handleOpenFull}
                className="text-xs font-semibold text-primary-700 dark:text-primary-300 hover:text-primary-800 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30"
              >
                Full chat →
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-500"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: '280px' }}>
          <ChatTab
            eventId={eventId}
            isActive={isOpen}
            hidePinnedBanners
            embedded
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EventChatSheet;
