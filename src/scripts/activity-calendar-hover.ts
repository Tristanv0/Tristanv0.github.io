import type { CalendarStack } from './calendar-stack';

export function createActivityCalendarHover(calendar: HTMLElement, body: HTMLElement, motion: MediaQueryList, stacks: Map<HTMLElement, CalendarStack>) {
  let hovered: HTMLElement | null = null, focused: HTMLElement | null = null;
  let playback: { cell: HTMLElement; cancel: () => void } | null = null;
  function stop() { playback?.cancel(); playback = null; }
  function start(cell: HTMLElement) {
    const stack = stacks.get(cell);
    const label = cell.querySelector<HTMLElement>('[data-calendar-workout-title]');
    const text = label?.firstElementChild as HTMLElement | null;
    if (!stack || !label || !text) return;
    let cancelled = false;
    const animations = new Set<Animation>();
    const clear = () => { animations.forEach(animation => animation.cancel()); animations.clear(); };
    playback = { cell, cancel() { cancelled = true; clear(); void stack.reset(); } };
    if (motion.matches) {
      text.textContent = stack.entries.map(entry => entry.title).join(' · ');
      Object.assign(label.style, { maskImage: 'none', height: 'auto', width: '100%', overflow: 'visible', whiteSpace: 'normal' });
      Object.assign(text.style, { width: '100%', overflowWrap: 'anywhere' });
      return;
    }
    async function play(frames: Keyframe[], duration: number, easing = 'ease-in-out') {
      if (cancelled) return false;
      const animation = text!.animate(frames, { duration, easing, fill: 'forwards' });
      animations.add(animation);
      try { await animation.finished; return !cancelled; } catch { return false; }
    }
    async function loop() {
      while (!cancelled) {
        const width = label!.clientWidth;
        const travel = text!.scrollWidth > width ? Math.max(0, text!.scrollWidth - width * .6) : 0;
        label!.style.maskImage = travel ? 'linear-gradient(to right,transparent,#000 20%,#000 80%,transparent)' : 'none';
        const first = `translateX(${travel / 2}px)`, last = `translateX(${-travel / 2}px)`;
        const at = (transform: string, opacity = 1) => ({ transform, opacity });
        if (!travel && stack!.entries.length === 1) return;
        if (!await play([at(first, 0), at(first)], 160)) return;
        if (!await play([at(first), at(first)], travel ? 450 : 1400)) return;
        if (travel) {
          if (!await play([at(first), at(last)], Math.max(1600, travel / 24 * 1000), 'linear')) return;
          if (!await play([at(last), at(last)], 650)) return;
        }
        if (!await play([at(last), at(last, 0)], 160)) return;
        if (stack!.entries.length > 1 && !await stack!.promote((stack!.front + 1) % stack!.entries.length)) return;
        if (cancelled) return;
        clear();
      }
    }
    void loop();
  }
  function sync() {
    const target = hovered ?? focused;
    const available = !document.hidden && !calendar.inert;
    if (available && target === playback?.cell) return;
    stop();
    if (available && target) start(target);
  }
  function entry(target: EventTarget | null) {
    const cell = target instanceof Element ? target.closest<HTMLElement>('[data-calendar-entry]') : null;
    return cell && body.contains(cell) ? cell : null;
  }
  function onOver(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    const cell = entry(event.target);
    if (cell === hovered) return;
    hovered = cell; sync();
  }
  function onOut(event: PointerEvent) {
    if (event.relatedTarget instanceof Node && hovered?.contains(event.relatedTarget)) return;
    hovered = null; sync();
  }
  function onFocus(event: FocusEvent) {
    const cell = entry(event.target);
    focused = cell?.matches(':focus-visible') ? cell : null; sync();
  }
  function onBlur(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && focused?.contains(event.relatedTarget)) return;
    focused = null; sync();
  }
  function restart() { stop(); sync(); }
  function reset() { hovered = focused = null; stop(); }
  body.addEventListener('pointerover', onOver);
  body.addEventListener('pointerout', onOut);
  body.addEventListener('focusin', onFocus);
  body.addEventListener('focusout', onBlur);
  window.addEventListener('resize', restart, { passive: true });
  motion.addEventListener('change', restart);
  return {
    stop: reset,
    restart,
    dispose() {
      reset();
      body.removeEventListener('pointerover', onOver);
      body.removeEventListener('pointerout', onOut);
      body.removeEventListener('focusin', onFocus);
      body.removeEventListener('focusout', onBlur);
      window.removeEventListener('resize', restart);
      motion.removeEventListener('change', restart);
    },
  };
}
