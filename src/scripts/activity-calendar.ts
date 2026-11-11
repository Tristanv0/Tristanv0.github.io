import { buildActivityCalendar, activityColor, circlePose, preferredActivity, type CalendarActivity } from '../data/activity-calendar';
import { CALENDAR_DAY_CLASS, CALENDAR_TITLE_CLASS, CALENDAR_TITLE_FADE, WORKOUT_TIME_ZONE } from '../data/workout-calendar';
import { createCalendarStack, type CalendarStack } from './calendar-stack';
import { createActivityCalendarHover } from './activity-calendar-hover';
import type { HobbyChangeDetail } from './hobby-tabs';

export function initActivityCalendars() {
  document.querySelectorAll<HTMLElement>('[data-activity-calendar]').forEach(calendar => {
    const heading = calendar.querySelector<HTMLElement>('[data-calendar-month]')!;
    const table = calendar.querySelector<HTMLTableElement>('[data-calendar-table]')!;
    const body = calendar.querySelector<HTMLTableSectionElement>('[data-calendar-days]')!;
    const section = calendar.closest<HTMLElement>('[data-hobbies]');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const stacks = new Map<HTMLElement, CalendarStack>();
    const hover = createActivityCalendarHover(calendar, body, motion, stacks);
    const timeZone = calendar.dataset.timeZone || WORKOUT_TIME_ZONE;
    let activeHobby = section?.querySelector<HTMLElement>('[data-hobby-tab][aria-selected="true"]')?.dataset.hobbyTab ?? 'running';
    let fingerprint = '', visible = false, suspended = false;
    let pulse: Animation | null = null;
    function updatePulse() {
      if (!visible || document.hidden || motion.matches) { pulse?.cancel(); pulse = null; return; }
      if (pulse) return;
      const dot = calendar.querySelector<HTMLElement>('[data-calendar-today-dot]');
      if (dot) pulse = dot.animate([{ opacity: 1 }, { opacity: .35 }, { opacity: 1 }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' });
    }
    function refresh() {
      if (document.hidden) { suspended = true; hover.stop(); stacks.forEach(stack => stack.cancel()); updatePulse(); return; }
      if (suspended) { stacks.forEach(stack => { void stack.reset(); }); suspended = false; }
      const source = calendar.dataset.calendarActivities || '[]';
      let entries: CalendarActivity[] = [];
      try { const parsed = JSON.parse(source); if (Array.isArray(parsed)) entries = parsed; } catch { /* Render an empty calendar for an invalid source. */ }
      const model = buildActivityCalendar(new Date(), entries, timeZone);
      const nextFingerprint = `${model.today}:${source}`;
      if (fingerprint === nextFingerprint) { updatePulse(); return; }
      fingerprint = nextFingerprint;
      hover.stop(); stacks.forEach(stack => stack.dispose()); stacks.clear();
      pulse?.cancel(); pulse = null;
      heading.textContent = model.monthLabel;
      table.setAttribute('aria-label', `${model.monthLabel} hobby activities`);
      const fragment = document.createDocumentFragment();
      model.weeks.forEach(week => {
        const row = document.createElement('tr');
        week.forEach(day => {
          const cell = document.createElement('td');
          cell.className = 'h-11 p-0 align-top tablet:h-12';
          if (!day) { cell.setAttribute('aria-hidden', 'true'); row.append(cell); return; }
          const entries = day.activities;
          const front = preferredActivity(entries, activeHobby);
          if (entries.length) {
            cell.tabIndex = 0;
            cell.dataset.calendarEntry = '';
            cell.dataset.calendarItems = JSON.stringify(entries);
          }
          const circle = document.createElement('span');
          circle.className = `${CALENDAR_DAY_CLASS} ${entries.length || day.today ? 'text-white' : 'text-ink'}`;
          circle.dataset.calendarDay = day.date;
          if (day.today) circle.dataset.calendarTodayDot = '';
          entries.forEach((entry, index) => {
            const layer = document.createElement('span');
            layer.className = 'absolute inset-0 rounded-full border';
            layer.dataset.calendarCircle = String(index);
            layer.dataset.calendarHobby = entry.hobby;
            layer.setAttribute('aria-hidden', 'true');
            Object.assign(layer.style, { backgroundColor: activityColor(entry.hobby), ...circlePose(index, front, entries.length) });
            circle.append(layer);
          });
          if (day.today && !entries.length) {
            const today = document.createElement('span');
            today.className = 'absolute inset-0 rounded-full bg-[var(--hobby-color)] transition-colors duration-200';
            today.setAttribute('aria-hidden', 'true'); circle.append(today);
          }
          const date = document.createElement('time');
          date.className = 'pointer-events-none relative z-[100]';
          date.dateTime = day.date; date.textContent = String(day.day); date.setAttribute('aria-label', day.label);
          if (day.today) date.setAttribute('aria-current', 'date');
          circle.append(date); cell.append(circle);
          if (entries.length) {
            const label = document.createElement('span'), title = document.createElement('span');
            label.className = CALENDAR_TITLE_CLASS; label.dataset.calendarWorkoutTitle = ''; label.setAttribute('aria-hidden', 'true');
            title.className = 'shrink-0'; title.textContent = entries[front].title;
            if (Array.from(entries[front].title).length > 10) label.style.cssText = CALENDAR_TITLE_FADE;
            label.append(title); cell.append(label);
            stacks.set(cell, createCalendarStack(cell, entries, motion, activeHobby));
          }
          row.append(cell);
        });
        fragment.append(row);
      });
      body.replaceChildren(fragment); updatePulse();
    }
    const onHobbyChange = (event: Event) => {
      activeHobby = (event as CustomEvent<HobbyChangeDetail>).detail.hobby;
      hover.stop();
      stacks.forEach(stack => { void stack.prefer(activeHobby); });
    };
    const onMotionChange = () => { stacks.forEach(stack => { void stack.prefer(activeHobby); }); hover.restart(); updatePulse(); };
    refresh();
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) { hover.stop(); stacks.forEach(stack => stack.cancel()); }
      else stacks.forEach(stack => { void stack.reset(); });
      updatePulse();
    });
    observer.observe(calendar);
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    motion.addEventListener('change', onMotionChange);
    section?.addEventListener('hobby:change', onHobbyChange);
    document.addEventListener('astro:before-swap', () => {
      pulse?.cancel(); hover.dispose(); stacks.forEach(stack => stack.dispose()); observer.disconnect(); clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      motion.removeEventListener('change', onMotionChange);
      section?.removeEventListener('hobby:change', onHobbyChange);
    }, { once: true });
  });
}
