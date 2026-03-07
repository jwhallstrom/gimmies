export function parseLocalDate(value: string): Date {
  if (!value) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function formatLocalDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US'
): string {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, options);
}

export function isSameOrAfterToday(value: string): boolean {
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}
