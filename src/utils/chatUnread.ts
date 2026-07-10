import type { ChatMessage } from '../state/types';
import { isEventMuted } from '../adapters/chat';

export const CHAT_LAST_READ_KEY = 'gimmies.chatLastRead.v1';

export function getLastReadTimestamps(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_LAST_READ_KEY) || '{}');
  } catch {
    return {};
  }
}

export function markChatAsRead(chatTargetId: string) {
  try {
    const current = getLastReadTimestamps();
    current[chatTargetId] = new Date().toISOString();
    localStorage.setItem(CHAT_LAST_READ_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getChatTargetId(event: { id: string; parentGroupId?: string | null }): string {
  return event.parentGroupId || event.id;
}

export function getChatUnreadCount(
  messages: ChatMessage[] | undefined,
  chatTargetId: string,
  currentProfileId: string | undefined
): number {
  if (!currentProfileId) return 0;
  if (isEventMuted(chatTargetId)) return 0;

  const chat = (messages || []).filter((m) => !m.isDeleted);
  if (chat.length === 0) return 0;

  const lastRead = getLastReadTimestamps()[chatTargetId];
  if (!lastRead) {
    return chat.filter((m) => m.profileId !== currentProfileId).length;
  }

  return chat.filter(
    (m) => m.createdAt > lastRead && m.profileId !== currentProfileId
  ).length;
}
