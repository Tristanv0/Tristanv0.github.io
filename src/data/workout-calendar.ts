export const WORKOUT_TIME_ZONE = 'America/Toronto';
export const CALENDAR_DAY_CLASS = 'relative mx-auto flex size-6 items-center justify-center rounded-full text-[11px] tabular-nums tablet:size-7 tablet:text-[12px]';
export const CALENDAR_BACK_CIRCLE_CLASS = 'absolute inset-0 translate-x-1 -translate-y-1 rounded-full bg-[#1E6FFF]';
export const CALENDAR_FRONT_CIRCLE_CLASS = 'absolute inset-0 rounded-full border border-white bg-[#1E6FFF]';
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const CALENDAR_TITLE_CLASS = 'relative mx-auto mt-1 flex h-3 w-[10ch] max-w-full items-center justify-center overflow-hidden whitespace-nowrap text-[9px] leading-3 text-muted';
export const CALENDAR_TITLE_FADE = 'mask-image:linear-gradient(to right,transparent,#000 20%,#000 80%,transparent)';

export interface WorkoutCalendarEntry { date: string; title?: string }

export interface CalendarDay {
  date: string;
  day: number;
  today: boolean;
  attended: boolean;
  workoutCount: number;
  workoutTitles: string[];
  label: string;
  title: string;
}

function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function workoutDateKey(value: string, timeZone = WORKOUT_TIME_ZONE): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }
  // Full timestamps must include a zone, so visitor/server local time cannot
  // shift a session to a different day. Date-only values are Toronto dates.
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? dateKey(parsed, timeZone) : null;
}

export function calendarDayClass(day: CalendarDay) {
  return `${CALENDAR_DAY_CLASS} ${day.workoutCount > 1 ? 'text-white' : day.today || day.attended ? 'bg-[#1E6FFF] text-white' : 'text-ink'}`;
}

export function buildWorkoutCalendar(now: Date, workoutDates: readonly (string | WorkoutCalendarEntry)[], timeZone = WORKOUT_TIME_ZONE) {
  const today = dateKey(now, timeZone);
  const [year, month] = today.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 12));
  const count = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const attended = new Map<string, { titles: string[]; count: number }>();
  for (const entry of workoutDates) {
    const date = workoutDateKey(typeof entry === 'string' ? entry : entry.date, timeZone);
    if (!date) continue;
    const sessions = attended.get(date) ?? { titles: [], count: 0 };
    sessions.count++;
    const title = typeof entry === 'string' ? '' : entry.title?.trim();
    sessions.titles.push(title || 'Workout');
    attended.set(date, sessions);
  }
  const monthLabel = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
  const cells: (CalendarDay | null)[] = Array.from({ length: start.getUTCDay() }, () => null);
  for (let day = 1; day <= count; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = date === today;
    const hasWorkout = attended.has(date);
    const sessions = attended.get(date);
    const workoutCount = sessions?.count ?? 0;
    const workoutTitles = sessions?.titles ?? [];
    const title = [...new Set(workoutTitles)].join(' · ');
    cells.push({ date, day, today: isToday, attended: hasWorkout, workoutCount, workoutTitles, title, label: `${monthLabel.split(' ')[0]} ${day}, ${year}${isToday ? ', today' : ''}${workoutCount > 1 ? `, ${workoutCount} workouts` : ''}${hasWorkout ? `, ${title || 'gym workout'}` : ''}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return { today, monthLabel, weeks, attendanceCount: cells.filter(day => day?.attended).length, hasHistory: attended.size > 0 };
}
