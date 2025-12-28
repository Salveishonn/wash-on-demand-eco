/**
 * Date utilities for handling timezone-safe date operations.
 * All dates should be handled in local time (America/Argentina/Buenos_Aires).
 */

/**
 * Formats a Date object to YYYY-MM-DD string using LOCAL time (not UTC).
 * This prevents the off-by-one-day bug caused by timezone conversion.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string to a Date object in LOCAL time.
 * Avoids the UTC parsing issue of new Date("YYYY-MM-DD").
 */
export function parseDateKey(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Gets today's date at midnight in local time.
 */
export function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Compares two date strings (YYYY-MM-DD format).
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Checks if a date string is before today.
 */
export function isDatePast(dateStr: string): boolean {
  return dateStr < formatDateKey(new Date());
}

/**
 * Checks if a date string is today.
 */
export function isDateToday(dateStr: string): boolean {
  return dateStr === formatDateKey(new Date());
}
