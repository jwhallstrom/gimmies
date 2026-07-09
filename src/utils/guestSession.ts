import { nanoid } from 'nanoid/non-secure';

const GUEST_SESSION_KEY = 'gimmies.guestSession.v1';

export interface GuestSession {
  guestId: string;
  displayName: string;
  createdAt: string;
  joinedEventIds: string[];
}

export function getGuestSession(): GuestSession | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createGuestSession(displayName: string): GuestSession {
  const session: GuestSession = {
    guestId: `guest_${nanoid(10)}`,
    displayName: displayName.trim(),
    createdAt: new Date().toISOString(),
    joinedEventIds: [],
  };
  try {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export function addEventToGuestSession(eventId: string): void {
  const session = getGuestSession();
  if (!session) return;
  if (!session.joinedEventIds.includes(eventId)) {
    session.joinedEventIds.push(eventId);
  }
  try {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function clearGuestSession(): void {
  try {
    localStorage.removeItem(GUEST_SESSION_KEY);
  } catch {}
}

export function isGuestUser(): boolean {
  return !!getGuestSession();
}
