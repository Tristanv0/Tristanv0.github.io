import { circlePose, preferredActivity, type CalendarActivity } from '../data/activity-calendar';
import { CALENDAR_TITLE_FADE } from '../data/workout-calendar';

export function createCalendarStack(cell: HTMLElement, entries: CalendarActivity[], motion: MediaQueryList, hobby: string) {
  const circles = [...cell.querySelectorAll<HTMLElement>('[data-calendar-circle]')];
  const label = cell.querySelector<HTMLElement>('[data-calendar-workout-title]')!;
  const text = label.firstElementChild as HTMLElement;
  let front = preferredActivity(entries, hobby);
  let preferred = front;
  let version = 0;
  let animations: Animation[] = [];
  function caption() {
    text.textContent = entries[front].title;
    text.style.cssText = '';
    label.style.cssText = Array.from(entries[front].title).length > 10 ? CALENDAR_TITLE_FADE : '';
    cell.dataset.calendarFrontHobby = entries[front].hobby;
    cell.dataset.calendarFrontId = entries[front].id;
  }
  function render() {
    circles.forEach((circle, index) => Object.assign(circle.style, circlePose(index, front, entries.length)));
    caption();
  }
  function cancel() {
    version++;
    animations.forEach(animation => animation.cancel());
    animations = [];
    render();
  }
  async function promote(target: number, animate = true) {
    cancel();
    if (target === front) return true;
    const currentVersion = version;
    if (!animate || motion.matches || document.hidden || typeof circles[0]?.animate !== 'function') {
      front = target; render(); return true;
    }
    animations = circles.map((circle, index) => {
      const from = circlePose(index, front, entries.length), to = circlePose(index, target, entries.length);
      const middle = index === front ? 'translate(-7px, 6px) scale(.94)'
        : index === target ? 'translate(12px, -10px) scale(.94)' : from.transform;
      return circle.animate([
        from,
        { ...from, transform: middle, offset: .45 },
        { ...to, transform: middle, offset: .55 },
        to,
      ], { duration: 620, easing: 'ease-in-out', fill: 'forwards' });
    });
    await Promise.allSettled(animations.map(animation => animation.finished));
    if (version !== currentVersion) return false;
    front = target;
    animations.forEach(animation => animation.cancel());
    animations = [];
    render();
    return true;
  }
  render();
  return {
    entries,
    get front() { return front; },
    promote,
    prefer(hobby: string) {
      preferred = entries[front].hobby === hobby ? front : preferredActivity(entries, hobby, preferred);
      return promote(preferred);
    },
    reset() { return promote(preferred, false); },
    cancel,
    dispose: cancel,
  };
}
export type CalendarStack = ReturnType<typeof createCalendarStack>;
