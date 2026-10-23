export interface Run {
  id: string;
  title: string;
  sportType: string;
  day: string;
  dateLabel: string;
  dateTime: string | null;
  distance: string;
  time: string;
  pace: string;
  averageHeartRate: string;
  calories: string;
  elevationGain: string;
  relativeEffort: string;
  stravaUrl: string | null;
  photoUrl: string | null;
  routeImage: { src: string; width: number; height: number } | null;
  mapImage: { src: string; width: number; height: number } | null;
}

export interface RunSnapshot {
  runs: Run[];
  scrapedAt: string | null;
  available: boolean;
}

interface StrevyRun {
  id: string;
  name: string;
  sportType?: string | null;
  startTime?: string | null;
  dateLabel?: string | null;
  distance?: { value?: number | null; unit?: string | null } | null;
  distanceMeters?: number | null;
  movingTime?: { display?: string | null; seconds?: number | null } | null;
  averagePacePerKm?: { display?: string | null; secondsPerKm?: number | null } | null;
  averageHeartRateBpm?: number | null;
  calories?: number | null;
  elevationGainMeters?: number | null;
  elevationGain?: { value?: number | null; unit?: string | null } | null;
  relativeEffort?: number | null;
  url?: string | null;
  photos?: Array<{ url?: string | null } | null> | null;
  routeImage?: { url?: string | null; width?: number; height?: number } | null;
  mapImage?: { url?: string | null; path?: string | null; width?: number; height?: number } | null;
}

const dateOptions = { timeZone: 'America/Toronto' };
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  ...dateOptions, month: 'short', day: 'numeric', year: 'numeric',
});
const dayFormatter = new Intl.DateTimeFormat('en-CA', { ...dateOptions, weekday: 'long' });

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validDate(value: unknown): Date | null {
  const input = text(value);
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function httpUrl(value: unknown, apiOrigin: string): string | null {
  const input = text(value);
  if (!input) return null;
  try {
    const url = new URL(input, apiOrigin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function duration(seconds: unknown): string {
  if (!nonNegativeNumber(seconds)) return '—';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = String(total % 60).padStart(2, '0');
  return minutes >= 60
    ? String(Math.floor(minutes / 60)) + ':' + String(minutes % 60).padStart(2, '0') + ':' + remainder
    : String(minutes) + ':' + remainder;
}

function normalizeRun(run: StrevyRun, apiOrigin: string): Run {
  const date = validDate(run.startTime);
  const displayedDistance = run.distance?.value;
  let kilometers: number | null = null;
  if (nonNegativeNumber(run.distanceMeters)) {
    kilometers = run.distanceMeters / 1000;
  } else if (nonNegativeNumber(displayedDistance)) {
    const unit = text(run.distance?.unit)?.toLowerCase();
    if (unit === 'km') kilometers = displayedDistance;
    if (unit === 'mi') kilometers = displayedDistance * 1.609344;
  }
  const distance = kilometers === null ? '—' : kilometers.toFixed(2);
  const time = text(run.movingTime?.display) ?? duration(run.movingTime?.seconds);
  const pace = text(run.averagePacePerKm?.display)?.replace(/\s*\/\s*km\s*$/i, '')
    ?? duration(run.averagePacePerKm?.secondsPerKm);
  const imageSrc = httpUrl(run.routeImage?.url, apiOrigin);
  const imageWidth = run.routeImage?.width;
  const imageHeight = run.routeImage?.height;
  // Use Strava's static map URL directly. Older snapshots may still store an
  // API-relative image URL or a saved path relative to the runs endpoint.
  const mapSrc = httpUrl(run.mapImage?.url, apiOrigin)
    ?? httpUrl(run.mapImage?.path, new URL('/api/runs/', apiOrigin).href);
  const mapWidth = run.mapImage?.width;
  const mapHeight = run.mapImage?.height;
  const photoUrl = Array.isArray(run.photos)
    ? run.photos.map(photo => httpUrl(photo?.url, apiOrigin)).find((url): url is string => url !== null) ?? null
    : null;
  let elevationMeters = nonNegativeNumber(run.elevationGainMeters) ? run.elevationGainMeters : null;
  if (elevationMeters === null && nonNegativeNumber(run.elevationGain?.value)) {
    const unit = text(run.elevationGain?.unit)?.toLowerCase();
    if (unit === 'm') elevationMeters = run.elevationGain.value;
    if (unit === 'ft') elevationMeters = run.elevationGain.value * 0.3048;
  }

  return {
    id: run.id,
    title: run.name.trim(),
    sportType: text(run.sportType) ?? 'Activity',
    day: date ? dayFormatter.format(date) : 'Recent run',
    dateLabel: date ? dateFormatter.format(date) : text(run.dateLabel) ?? 'Date unavailable',
    dateTime: date?.toISOString() ?? null,
    distance,
    time,
    pace,
    averageHeartRate: nonNegativeNumber(run.averageHeartRateBpm) && run.averageHeartRateBpm > 0
      ? String(Math.round(run.averageHeartRateBpm)) : '—',
    calories: nonNegativeNumber(run.calories)
      ? new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(run.calories) : '—',
    elevationGain: elevationMeters === null ? '—' : String(Math.round(elevationMeters)),
    relativeEffort: nonNegativeNumber(run.relativeEffort) ? String(Math.round(run.relativeEffort)) : '—',
    stravaUrl: httpUrl(run.url, apiOrigin),
    photoUrl,
    routeImage: imageSrc ? {
      src: imageSrc,
      width: nonNegativeNumber(imageWidth) && imageWidth > 0 ? imageWidth : 768,
      height: nonNegativeNumber(imageHeight) && imageHeight > 0 ? imageHeight : 768,
    } : null,
    mapImage: mapSrc ? {
      src: mapSrc,
      width: nonNegativeNumber(mapWidth) && mapWidth > 0 ? mapWidth : 784,
      height: nonNegativeNumber(mapHeight) && mapHeight > 0 ? mapHeight : 451,
    } : null,
  };
}

export function parseStrevySnapshot(payload: unknown, apiOrigin: string, limit = 5): RunSnapshot {
  if (!payload || typeof payload !== 'object' || !('runs' in payload) || !Array.isArray(payload.runs)) {
    throw new Error('Invalid Strevy response');
  }

  const runs = payload.runs
    .filter((run): run is StrevyRun => Boolean(
      run && typeof run === 'object' && text(run.id) && text(run.name),
    ))
    .map(run => normalizeRun(run, apiOrigin))
    .sort((a, b) => (b.dateTime ? Date.parse(b.dateTime) : 0) - (a.dateTime ? Date.parse(a.dateTime) : 0))
    .slice(0, Math.max(0, limit));

  if (payload.runs.length > 0 && runs.length === 0 && limit > 0) {
    throw new Error('Strevy did not return valid runs');
  }

  return {
    runs,
    scrapedAt: 'scrapedAt' in payload ? validDate(payload.scrapedAt)?.toISOString() ?? null : null,
    available: true,
  };
}

export async function getRecentRuns(apiOrigin: string, limit = 5): Promise<RunSnapshot> {
  try {
    const response = await fetch(new URL('/api/runs', apiOrigin), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Strevy returned ' + response.status);
    return parseStrevySnapshot(await response.json(), apiOrigin, limit);
  } catch {
    // An offline API should not prevent the rest of the portfolio from rendering.
    return { runs: [], scrapedAt: null, available: false };
  }
}
