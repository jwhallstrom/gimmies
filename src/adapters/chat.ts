import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import useStore from '../state/store';
import type { ChatMessage, Event, GolferProfile, ChatPollOption } from '../state/types';
import { nanoid } from 'nanoid/non-secure';

// ============================================================================
// Typing indicator - lightweight local-only implementation
// ============================================================================
const TYPING_TIMEOUT = 3000; // ms before "typing" clears

// ============================================================================
// Chat mute settings (localStorage)
// ============================================================================
const MUTE_KEY = 'gimmies.chatMute.v1';

function getMuteSettings(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MUTE_KEY) || '{}');
  } catch { return {}; }
}

function setMuteForEvent(eventId: string, mutedUntil: string | null) {
  try {
    const settings = getMuteSettings();
    if (mutedUntil) {
      settings[eventId] = mutedUntil;
    } else {
      delete settings[eventId];
    }
    localStorage.setItem(MUTE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function isEventMuted(eventId: string): boolean {
  const settings = getMuteSettings();
  const mutedUntil = settings[eventId];
  if (!mutedUntil) return false;
  if (mutedUntil === 'forever') return true;
  return new Date(mutedUntil).getTime() > Date.now();
}

/**
 * Event chat adapter (event-level chat).
 *
 * Backed by Zustand today; can be reimplemented against BE/services later.
 *
 * **Phase 2 – Unified Group Chat:**
 * When an event has a `parentGroupId`, all chat operations (read & write)
 * are routed to the parent group's `chat[]`. This means every child event
 * of a group shares a single, persistent conversation.
 * Standalone events (no `parentGroupId`) continue to use their own `chat[]`.
 */
export function useEventChatAdapter(eventId: string) {
  const event = useStore(
    (s) => (s.events.find((e) => e.id === eventId) || s.completedEvents.find((e) => e.id === eventId)) as
      | Event
      | undefined
  );

  // Resolve parent group for unified chat routing
  const parentGroupId = event?.parentGroupId;
  const parentGroup = useStore(
    (s) => parentGroupId
      ? (s.events.find((e) => e.id === parentGroupId) as Event | undefined)
      : undefined
  );

  // Chat target: parent group (if child event) or the event itself
  const chatTargetId = parentGroupId || eventId;
  const chatTargetEvent = parentGroup || event;

  const currentProfile = useStore((s) => s.currentProfile) as GolferProfile | null;
  const profiles = useStore((s) => s.profiles) as GolferProfile[];

  const addChatMessage = useStore((s) => s.addChatMessage);
  const clearChat = useStore((s) => s.clearChat) as (eventId: string) => void;
  const toggleReaction = useStore((s) => s.toggleReaction);
  const deleteMessage = useStore((s) => s.deleteMessage);
  const votePoll = useStore((s) => s.votePoll);

  // Read messages from the chat target (parent group or own event)
  const messages: ChatMessage[] = chatTargetEvent?.chat || [];

  const profilesById = useMemo(() => {
    const map = new Map<string, GolferProfile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  // Typing indicator state
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const reportTyping = useCallback(() => {
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_TIMEOUT);
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Reply-to state
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  // Mute state — keyed on the chat target (group or event)
  const [muted, setMutedState] = useState(() => isEventMuted(chatTargetId));

  const toggleMute = useCallback((duration: 'forever' | '1h' | '8h' | '24h' | 'unmute') => {
    if (duration === 'unmute') {
      setMuteForEvent(chatTargetId, null);
      setMutedState(false);
    } else if (duration === 'forever') {
      setMuteForEvent(chatTargetId, 'forever');
      setMutedState(true);
    } else {
      const hours = duration === '1h' ? 1 : duration === '8h' ? 8 : 24;
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      setMuteForEvent(chatTargetId, until);
      setMutedState(true);
    }
  }, [chatTargetId]);

  // Send message with optional reply/type — routed to chat target
  const send = useCallback(async (text: string, options?: { replyTo?: string; type?: string; metadata?: Record<string, any>; pollQuestion?: string; pollOptions?: ChatPollOption[] }) => {
    setIsTyping(false);
    setReplyTo(null);
    await addChatMessage(chatTargetId, text, options);
  }, [chatTargetId, addChatMessage]);

  // Create a poll — routed to chat target
  const createPoll = useCallback(async (question: string, optionTexts: string[]) => {
    const options: ChatPollOption[] = optionTexts.map(t => ({
      id: nanoid(6),
      text: t,
      votes: [],
    }));
    await addChatMessage(chatTargetId, question, {
      type: 'poll',
      pollQuestion: question,
      pollOptions: options,
    });
  }, [chatTargetId, addChatMessage]);

  // Share join code to chat — shares the current event's code to the chat target
  const shareJoinCode = useCallback(async () => {
    const code = event?.shareCode;
    if (!code) return;
    await addChatMessage(chatTargetId, `Join code: ${code}`, {
      type: 'invite',
      metadata: { shareCode: code, eventName: event?.name },
    });
  }, [chatTargetId, event?.shareCode, event?.name, addChatMessage]);

  return {
    event,
    currentProfile,
    messages,
    profilesById,
    send,
    clear: () => clearChat(chatTargetId),
    toggleReaction: (messageId: string, emoji: string) => toggleReaction(chatTargetId, messageId, emoji),
    deleteMessage: (messageId: string) => deleteMessage(chatTargetId, messageId),
    votePoll: (messageId: string, optionId: string) => votePoll(chatTargetId, messageId, optionId),
    createPoll,
    shareJoinCode,
    // Typing
    isTyping,
    reportTyping,
    // Reply
    replyTo,
    setReplyTo,
    // Mute
    muted,
    toggleMute,
    // Group chat context (Phase 2)
    isGroupChat: Boolean(parentGroupId),
    parentGroupName: parentGroup?.name,
    chatTargetId,
  };
}
