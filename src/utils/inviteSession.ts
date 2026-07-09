export const PENDING_JOIN_CODE_KEY = 'gimmies.pendingJoinCode.v1';
export const PENDING_EVENT_ID_KEY = 'gimmies.pendingEventId.v1';
export const PENDING_PROFILE_NAME_KEY = 'gimmies.pendingProfileName.v1';
export const PENDING_JOIN_FAILED_KEY = 'gimmies.pendingJoinFailed.v1';

export type InviteJoinFailure = {
  shareCode?: string;
  eventId?: string;
  error: string;
  eventName?: string;
};

export function stashPendingJoinCode(code: string) {
  try {
    sessionStorage.setItem(PENDING_JOIN_CODE_KEY, String(code).trim().toUpperCase());
  } catch {
    // ignore
  }
}

export function stashPendingEventId(eventId: string) {
  try {
    sessionStorage.setItem(PENDING_EVENT_ID_KEY, String(eventId).trim());
  } catch {
    // ignore
  }
}

export function stashPendingInviteTargets(shareCode?: string, eventId?: string) {
  if (shareCode) stashPendingJoinCode(shareCode);
  if (eventId) stashPendingEventId(eventId);
}

export function readPendingJoinTargets(): { code: string | null; eventId: string | null } {
  let code: string | null = null;
  let eventId: string | null = null;
  try {
    code = sessionStorage.getItem(PENDING_JOIN_CODE_KEY);
    eventId = sessionStorage.getItem(PENDING_EVENT_ID_KEY);
  } catch {
    // ignore
  }
  return { code, eventId };
}

export function clearPendingJoinTargets() {
  try {
    sessionStorage.removeItem(PENDING_JOIN_CODE_KEY);
    sessionStorage.removeItem(PENDING_EVENT_ID_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingInviteTarget(): boolean {
  const { code, eventId } = readPendingJoinTargets();
  return !!(code || eventId);
}

export function saveJoinFailure(failure: InviteJoinFailure) {
  try {
    sessionStorage.setItem(PENDING_JOIN_FAILED_KEY, JSON.stringify(failure));
  } catch {
    // ignore
  }
}

export function readJoinFailure(): InviteJoinFailure | null {
  try {
    const raw = sessionStorage.getItem(PENDING_JOIN_FAILED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InviteJoinFailure;
  } catch {
    return null;
  }
}

export function clearJoinFailure() {
  try {
    sessionStorage.removeItem(PENDING_JOIN_FAILED_KEY);
  } catch {
    // ignore
  }
}
