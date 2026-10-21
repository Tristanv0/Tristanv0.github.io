import { workoutDateKey, type WorkoutCalendarEntry } from './workout-calendar';

export interface WorkoutSet {
  index: number;
  type: string;
  reps: string;
  weight: string;
  weightUnit: string;
  duration: string;
  distance: string;
  rpe: string;
  personalRecords: string[];
  yearlyRecords: string[];
}

export interface WorkoutExercise {
  id: string;
  name: string;
  notes: string;
  muscles: string;
  equipment: string;
  rest: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  startedAt: string;
  dateLabel: string;
  title: string;
  description: string;
  photoUrls: string[];
  hevyUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  duration: string;
  volume: string;
  volumeUnit: string;
  includesWarmupSets: boolean | null;
  sets: number;
  exerciseCount: number;
  averageHeartRate: string;
  calories: string;
  recordCount: number;
  yearlyRecordCount: number;
  exercises: WorkoutExercise[];
}

export interface WorkoutSnapshot {
  workouts: Workout[];
  calendarEntries: WorkoutCalendarEntry[];
  scrapedAt: string | null;
  available: boolean;
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

function duration(value: unknown) {
  const data = object(value);
  const seconds = number(data.seconds);
  if (seconds === null) return text(data.display) || '—';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${Math.round(seconds)} s`;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

function formatNumber(value: unknown, decimals = 2) {
  const parsed = number(value);
  return parsed === null ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits: decimals }).format(parsed);
}

function httpUrl(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function dateTime(value: unknown): string | null {
  const input = text(value);
  return input.includes('T') && workoutDateKey(input) ? new Date(input).toISOString() : null;
}

const readable = (value: unknown) => text(value).replaceAll('_', ' ');
const recordNames = (value: unknown) => list(value).map(item => readable(typeof item === 'string' ? item : object(item).type)).filter(Boolean);

function interval(value: unknown) {
  const seconds = number(value);
  if (seconds === null) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const remainder = total % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', remainder || total === 0 ? `${remainder}s` : ''].filter(Boolean).join(' ');
}

function normalizeSet(value: unknown, index: number): WorkoutSet {
  const set = object(value);
  const weight = object(set.weight);
  const weightValue = number(weight.value) ?? number(set.weightKg);
  const meters = number(set.distanceMeters);
  return {
    index: number(set.index) ?? index + 1,
    type: readable(set.type) || 'normal',
    reps: formatNumber(set.reps, 0),
    weight: formatNumber(weightValue),
    weightUnit: weightValue === null ? '' : number(weight.value) !== null ? text(weight.unit) : 'kg',
    duration: interval(set.durationSeconds),
    distance: meters === null ? '—' : meters >= 1000 ? `${formatNumber(meters / 1000)} km` : `${formatNumber(meters)} m`,
    rpe: formatNumber(set.rpe),
    personalRecords: recordNames(set.personalRecords),
    yearlyRecords: recordNames(set.yearlyRecords),
  };
}

export function parseWorkoutSnapshot(payload: unknown, limit = 5): WorkoutSnapshot {
  const snapshot = object(payload);
  const records = Array.isArray(payload) ? payload : snapshot.workouts;
  if (!Array.isArray(records)) throw new Error('Invalid workout snapshot.');
  const entries = records.map(object).flatMap(record => {
    const date = workoutDateKey(text(record.date)) ?? workoutDateKey(text(record.startTime));
    return date ? [{ record, date }] : [];
  });
  const calendarEntries = entries.map(({ record, date }) => ({ date, title: text(record.title) || undefined }));
  // Date-only summaries mark attendance, but never become empty carousel cards.
  const full = entries.filter(({ record }) => record.detailLevel === 'full'
    || (record.detailLevel !== 'summary' && Array.isArray(record.exercises)));
  full.sort((a, b) => `${b.date} ${text(b.record.startTime)}`.localeCompare(`${a.date} ${text(a.record.startTime)}`));
  const workouts = full.slice(0, Math.max(0, Math.floor(limit))).map(({ record, date }): Workout => {
    const exercises: WorkoutExercise[] = list(record.exercises).map(object).filter(exercise => text(exercise.title)).map((exercise, index) => ({
      id: text(exercise.id) || `exercise-${index}`,
      name: text(exercise.title),
      notes: text(exercise.notes),
      muscles: [readable(exercise.primaryMuscle), ...list(exercise.otherMuscles).map(readable)].filter(Boolean).join(' · '),
      equipment: readable(exercise.equipment),
      rest: interval(exercise.restSeconds),
      sets: list(exercise.sets).filter(set => set !== null && typeof set === 'object').map(normalizeSet),
    }));
    const volume = object(record.volume);
    const volumeValue = number(volume.value) ?? number(record.volumeKg);
    const volumeUnit = number(volume.value) !== null ? text(volume.unit) : 'kg';
    return {
      id: text(record.id) || `${date}-${text(record.title)}`,
      startedAt: date,
      dateLabel: new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)),
      title: text(record.title) || 'Workout',
      description: text(record.description),
      photoUrls: [...new Set(list(record.photos).map(photo => httpUrl(object(photo).url)).filter((url): url is string => url !== null))],
      hevyUrl: httpUrl(record.url),
      startTime: dateTime(record.startTime),
      endTime: dateTime(record.endTime),
      duration: duration(record.duration),
      volume: volumeValue === null ? '—' : new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 }).format(volumeValue),
      volumeUnit: volumeValue === null ? '' : volumeUnit,
      includesWarmupSets: typeof volume.includesWarmupSets === 'boolean' ? volume.includesWarmupSets : null,
      sets: number(record.setCount) ?? exercises.reduce((total, exercise) => total + list(exercise.sets).length, 0),
      exerciseCount: number(record.exerciseCount) ?? exercises.length,
      averageHeartRate: formatNumber(record.averageHeartRateBpm, 0),
      calories: formatNumber(record.calories, 0),
      recordCount: number(record.recordCount) ?? list(record.records).length,
      yearlyRecordCount: list(record.yearlyRecords).length,
      exercises,
    };
  });
  const scrapedAt = text(snapshot.scrapedAt);
  return { workouts, calendarEntries, scrapedAt: scrapedAt && Number.isFinite(Date.parse(scrapedAt)) ? scrapedAt : null, available: true };
}

export async function getRecentWorkouts(apiOrigin: string, limit = 5): Promise<WorkoutSnapshot> {
  try {
    const response = await fetch(new URL('/api/workouts', apiOrigin), {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Workout API returned ${response.status}.`);
    return parseWorkoutSnapshot(await response.json(), limit);
  } catch {
    return { workouts: [], calendarEntries: [], scrapedAt: null, available: false };
  }
}
