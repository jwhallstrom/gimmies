const CANONICAL_APP_ORIGIN = 'https://app.golfwithgimmies.com';

function isLocalHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export function getInviteBaseUrl(): string {
  if (typeof window === 'undefined') return CANONICAL_APP_ORIGIN;
  if (isLocalHost(window.location.hostname)) return window.location.origin;
  return CANONICAL_APP_ORIGIN;
}

export function buildJoinInviteUrl(shareCode?: string): string {
  if (!shareCode) return '';
  return `${getInviteBaseUrl()}/join/${encodeURIComponent(String(shareCode).trim())}`;
}
