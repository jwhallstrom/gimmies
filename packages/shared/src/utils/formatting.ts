/**
 * Formatting Utilities
 */

/**
 * Format currency in dollars
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date range
 */
export function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return formatDate(dates[0]);
  
  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  
  if (first.getFullYear() === last.getFullYear()) {
    if (first.getMonth() === last.getMonth()) {
      return `${first.toLocaleDateString('en-US', { month: 'short' })} ${first.getDate()}-${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${first.getFullYear()}`;
  }
  
  return `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`;
}

/**
 * Format handicap index
 */
export function formatHandicap(handicap: number | undefined): string {
  if (handicap === undefined || handicap === null) return 'N/A';
  return handicap >= 0 ? `+${handicap.toFixed(1)}` : handicap.toFixed(1);
}

/**
 * Format score relative to par
 */
export function formatScoreToPar(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
