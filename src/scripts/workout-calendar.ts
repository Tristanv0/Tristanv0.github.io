import { buildWorkoutCalendar, calendarDayClass, CALENDAR_TITLE_CLASS, CALENDAR_TITLE_FADE, WORKOUT_TIME_ZONE, type WorkoutCalendarEntry } from '../data/workout-calendar';

export function initWorkoutCalendars() {
  document.querySelectorAll<HTMLElement>('[data-gym-calendar]').forEach(calendar => {
    const heading = calendar.querySelector<HTMLElement>('[data-calendar-month]')!;
    const table = calendar.querySelector<HTMLTableElement>('[data-calendar-table]')!;
    const body = calendar.querySelector<HTMLTableSectionElement>('[data-calendar-days]')!;
    const note = calendar.querySelector<HTMLElement>('[data-calendar-note]')!;
    const section = calendar.closest<HTMLElement>('[data-hobbies]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
      if (document.hidden || calendar.dataset.dustActive === 'true') { updatePulse(); return; }
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
            const circle = document.createElement('span');
            circle.className = calendarDayClass(day);
            circle.dataset.calendarDay = day.date;
            circle.dataset.attended = String(day.attended);
            const date = document.createElement('time');
            date.dateTime = day.date;
            date.textContent = String(day.day);
            date.setAttribute('aria-label', day.label);
            if (day.today) date.setAttribute('aria-current', 'date');
            if (day.today) {
              circle.dataset.calendarTodayDot = '';
            }
            circle.append(date);
            cell.append(circle);
            if (day.title) {
              const label = document.createElement('span');
              label.className = CALENDAR_TITLE_CLASS;
              label.dataset.calendarWorkoutTitle = '';
              label.title = day.title;
              label.setAttribute('aria-hidden', 'true');
              if (Array.from(day.title).length > 10) label.style.cssText = CALENDAR_TITLE_FADE;
              const title = document.createElement('span');
              title.className = 'shrink-0';
              title.textContent = day.title;
              label.append(title);
              cell.append(label);
            }
          } else cell.setAttribute('aria-hidden', 'true');
          row.append(cell);
        });
        fragment.append(row);
      });
      body.replaceChildren(fragment);
      note.textContent = model.attendanceCount ? 'Blue circles mark training days.' : model.hasHistory ? 'No workouts logged this month.' : 'Workout dates coming soon.';
      updatePulse();
    }

    // The static build supplies a first render; the browser owns the current
    // day/month afterward, including midnight and month changes without builds.
    refresh();
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      updatePulse();
    });
    observer.observe(calendar);
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    reducedMotion.addEventListener('change', updatePulse);
    section?.addEventListener('hobby:change', refresh);
    section?.addEventListener('hobby:theme', refresh);
    calendar.addEventListener('gym:dust', refresh);
    document.addEventListener('astro:before-swap', () => {
      pulse?.cancel();
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      reducedMotion.removeEventListener('change', updatePulse);
      section?.removeEventListener('hobby:change', refresh);
      section?.removeEventListener('hobby:theme', refresh);
      calendar.removeEventListener('gym:dust', refresh);
    }, { once: true });
  });
}
