import type { CalendarActivity } from './activity-calendar';

export interface BadmintonDay {
  date: string;
  dateLabel: string;
  duration: string;
  calories: string;
  averageHeartRate: string;
  distance: string;
  rallies: string;
}

export interface BadmintonSnapshot {
  days: BadmintonDay[];
  calendarEntries: CalendarActivity[];
  available: boolean;
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const metric = (value: unknown, decimals = 0) => {
  const parsed = number(value);
  return parsed === null ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits: decimals }).format(parsed);
};

export function parseBadmintonSnapshot(payload: unknown, limit = 5): BadmintonSnapshot {
  const snapshot = object(payload);
  if (!Array.isArray(snapshot.days)) throw new Error('Invalid badminton snapshot.');
  const dates = new Set<string>();
  const history = snapshot.days.map(object).filter(day => {
    if (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) return false;
    const date = new Date(`${day.date}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day.date || dates.has(day.date)) return false;
    dates.add(day.date);
    return true;
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const calendarEntries = history.map((day): CalendarActivity => ({ id: String(day.date), date: String(day.date), hobby: 'badminton', title: 'Badminton' }));
  const days = history.slice(0, Math.max(0, Math.floor(limit))).map(day => {
      const seconds = number(day.durationSeconds);
      const minutes = seconds === null ? null : Math.floor(seconds / 60);
      const duration = seconds === null || minutes === null ? '—'
        : minutes === 0 ? `${Math.round(seconds)} s`
        : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
      return {
        date: String(day.date),
        // The API already provides the Toronto calendar date. Do not shift it
        // into the visitor's time zone when formatting a date-only value.
        dateLabel: new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`)),
        duration,
        calories: metric(day.activeEnergyKcal),
        averageHeartRate: metric(day.averageHeartRateBpm),
        distance: metric(day.walkingRunningDistanceKm, 2),
        rallies: metric(day.rallyCount),
      };
    });
  return { days, calendarEntries, available: true };
}

export async function getRecentBadminton(apiOrigin: string, limit = 5): Promise<BadmintonSnapshot> {
  try {
    const response = await fetch(new URL('/api/badminton', apiOrigin), {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Badminton API returned ${response.status}.`);
    return parseBadmintonSnapshot(await response.json(), limit);
  } catch {
    return { days: [], calendarEntries: [], available: false };
  }
}
