import { buildWorkoutCalendar, calendarDayClass, CALENDAR_BACK_CIRCLE_CLASS, CALENDAR_FRONT_CIRCLE_CLASS, CALENDAR_TITLE_CLASS, CALENDAR_TITLE_FADE, WORKOUT_TIME_ZONE, type WorkoutCalendarEntry } from '../data/workout-calendar';
import { createCalendarHover } from './calendar-hover';

export function initWorkoutCalendars() {
  document.querySelectorAll<HTMLElement>('[data-gym-calendar]').forEach(calendar => {
    const heading = calendar.querySelector<HTMLElement>('[data-calendar-month]')!;
    const table = calendar.querySelector<HTMLTableElement>('[data-calendar-table]')!;
    const body = calendar.querySelector<HTMLTableSectionElement>('[data-calendar-days]')!;
    const note = calendar.querySelector<HTMLElement>('[data-calendar-note]')!;
    const section = calendar.closest<HTMLElement>('[data-hobbies]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = createCalendarHover(calendar, body, reducedMotion);
    const timeZone = calendar.dataset.timeZone || WORKOUT_TIME_ZONE;
    let fingerprint = '';
    let visible = false;
    let pulse: Animation | null = null;

    function updatePulse() {
      const shouldPulse = visible && !document.hidden && !calendar.classList.contains('invisible') && calendar.dataset.dustActive !== 'true' && !reducedMotion.matches;
      if (!shouldPulse) { pulse?.cancel(); pulse = null; return; }
      if (pulse) return;
      const dot = calendar.querySelector<HTMLElement>('[data-calendar-today-dot]');
      if (dot && typeof dot.animate === 'function') {
        pulse = dot.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
      }
    }

    function refresh() {
      if (document.hidden || calendar.dataset.dustActive === 'true') { hover.stop(); updatePulse(); return; }
      const source = calendar.dataset.workoutDates || '[]';
      let dates: (string | WorkoutCalendarEntry)[] = [];
      try {
        const parsed: unknown = JSON.parse(source);
        if (Array.isArray(parsed)) dates = parsed.flatMap<string | WorkoutCalendarEntry>(value => {
          if (typeof value === 'string') return [value];
          if (value && typeof value === 'object' && typeof value.date === 'string') {
            return [{ date: value.date, title: typeof value.title === 'string' ? value.title : undefined }];
          }
          return [];
        });
      } catch { /* An invalid snapshot leaves attendance unmarked. */ }
      const model = buildWorkoutCalendar(new Date(), dates, timeZone);
      const nextFingerprint = `${model.today}:${source}`;
      if (nextFingerprint === fingerprint) { updatePulse(); return; }
      fingerprint = nextFingerprint;
      hover.stop();
      pulse?.cancel(); pulse = null;
      heading.textContent = model.monthLabel;
      table.setAttribute('aria-label', `${model.monthLabel} gym attendance`);
      const fragment = document.createDocumentFragment();
      model.weeks.forEach(week => {
        const row = document.createElement('tr');
        week.forEach(day => {
          const cell = document.createElement('td');
          cell.className = 'h-11 p-0 align-top tablet:h-12';
          if (day) {
            if (day.attended) {
              cell.tabIndex = 0;
              cell.dataset.calendarEntry = '';
              cell.dataset.workoutTitles = JSON.stringify(day.workoutTitles);
            }
            const circle = document.createElement('span');
            circle.className = calendarDayClass(day);
            circle.dataset.calendarDay = day.date;
            circle.dataset.attended = String(day.attended);
            circle.dataset.workoutCount = String(day.workoutCount);
            if (day.workoutCount > 1) {
              const back = document.createElement('span');
              back.className = CALENDAR_BACK_CIRCLE_CLASS;
              back.setAttribute('aria-hidden', 'true');
              back.dataset.calendarBackCircle = '';
              circle.append(back);
              const front = document.createElement('span');
              front.className = CALENDAR_FRONT_CIRCLE_CLASS;
              front.setAttribute('aria-hidden', 'true');
              front.dataset.calendarFrontCircle = '';
              circle.append(front);
            }
            const date = document.createElement('time');
            date.className = 'relative z-10';
            date.dateTime = day.date;
            date.textContent = String(day.day);
            date.setAttribute('aria-label', day.label);
            if (day.today) date.setAttribute('aria-current', 'date');
            if (day.today) {
              circle.dataset.calendarTodayDot = '';
            }
            circle.append(date);
            cell.append(circle);
            if (day.attended) {
              const label = document.createElement('span');
              label.className = CALENDAR_TITLE_CLASS;
              label.dataset.calendarWorkoutTitle = '';
              label.setAttribute('aria-hidden', 'true');
              if (Array.from(day.workoutTitles[0]).length > 10) label.style.cssText = CALENDAR_TITLE_FADE;
              const title = document.createElement('span');
              title.className = 'shrink-0';
              title.textContent = day.workoutTitles[0];
              label.append(title);
              cell.append(label);
            }
          } else cell.setAttribute('aria-hidden', 'true');
          row.append(cell);
        });
        fragment.append(row);
      });
      body.replaceChildren(fragment);
      note.textContent = model.attendanceCount ? 'Blue circles mark training days. Stacked circles mark multiple workouts.' : model.hasHistory ? 'No workouts logged this month.' : 'Workout dates coming soon.';
      updatePulse();
    }

    // The static build supplies a first render; the browser owns the current
    // day/month afterward, including midnight and month changes without builds.
    refresh();
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) hover.stop();
      updatePulse();
    });
    observer.observe(calendar);
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    reducedMotion.addEventListener('change', updatePulse);
    const onHobbyChange = () => { hover.stop(); refresh(); };
    section?.addEventListener('hobby:change', onHobbyChange);
    section?.addEventListener('hobby:theme', refresh);
    calendar.addEventListener('gym:dust', refresh);
    document.addEventListener('astro:before-swap', () => {
      pulse?.cancel();
      hover.dispose();
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      reducedMotion.removeEventListener('change', updatePulse);
      section?.removeEventListener('hobby:change', onHobbyChange);
      section?.removeEventListener('hobby:theme', refresh);
      calendar.removeEventListener('gym:dust', refresh);
    }, { once: true });
  });
}
