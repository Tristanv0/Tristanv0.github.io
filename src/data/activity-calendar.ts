import { HOBBIES, type HobbyId } from './hobbies.ts';
import { buildWorkoutCalendar, workoutDateKey, WORKOUT_TIME_ZONE } from './workout-calendar.ts';

export interface CalendarActivity { id: string; date: string; hobby: HobbyId; title: string }
export interface ActivityCalendarDay {
  date: string;
  day: number;
  today: boolean;
  activities: CalendarActivity[];
  label: string;
}

export function activityColor(hobby: string) {
  return HOBBIES.find(item => item.id === hobby)?.color ?? HOBBIES[0].color;
}
export function preferredActivity(activities: CalendarActivity[], hobby: string, fallback = 0) {
  const index = activities.findIndex(activity => activity.hobby === hobby);
  return index < 0 ? fallback : index;
}
export function circlePose(index: number, front: number, count: number) {
  const depth = (index - front + count) % count;
  const offset = count > 1 ? depth * Math.min(4, 10 / (count - 1)) : 0;
  return { transform: `translate(${offset}px, ${-offset}px)`, zIndex: count - depth, borderColor: depth === 0 && count > 1 ? '#ffffff' : 'transparent' };
}

export function buildActivityCalendar(now: Date, input: readonly CalendarActivity[], timeZone = WORKOUT_TIME_ZONE) {
  const seen = new Set<string>();
  const activities = input.flatMap(activity => {
    if (!activity || !HOBBIES.some(hobby => hobby.id === activity.hobby)) return [];
    const date = workoutDateKey(activity.date, timeZone);
    const key = `${activity.hobby}:${activity.id}`;
    if (!date || seen.has(key)) return [];
    seen.add(key);
    return [{ ...activity, date, title: (typeof activity.title === 'string' ? activity.title.trim() : '') || HOBBIES.find(hobby => hobby.id === activity.hobby)!.label }];
  });
  const calendar = buildWorkoutCalendar(now, activities, timeZone);
  const byDate = new Map<string, CalendarActivity[]>();
  activities.forEach(activity => byDate.set(activity.date, [...byDate.get(activity.date) ?? [], activity]));
  const weeks = calendar.weeks.map(week => week.map((day): ActivityCalendarDay | null => {
    if (!day) return null;
    const entries = byDate.get(day.date) ?? [];
    const titles = entries.map(entry => `${HOBBIES.find(hobby => hobby.id === entry.hobby)!.label}: ${entry.title}`);
    return { date: day.date, day: day.day, today: day.today, activities: entries,
      label: `${calendar.monthLabel}, ${day.day}${day.today ? ', today' : ''}${titles.length ? `, ${titles.join('; ')}` : ''}` };
  }));
  return { ...calendar, weeks };
}
