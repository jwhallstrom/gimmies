const STORAGE_KEY = 'gimmies.leaderboardInsightsExpanded.v1';

export function getLeaderboardInsightsExpanded(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    // ignore
  }
  return true;
}

export function setLeaderboardInsightsExpanded(expanded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, expanded ? 'true' : 'false');
  } catch {
    // ignore
  }
}
