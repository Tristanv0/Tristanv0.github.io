// Playback runs only for the hovered or keyboard-focused training day.
// Cancelling it restores the resting layout before a calendar dust snapshot.
export function createCalendarHover(calendar: HTMLElement, body: HTMLElement, reducedMotion: MediaQueryList) {
  let hovered: HTMLElement | null = null;
  let focused: HTMLElement | null = null;
  let playback: { cell: HTMLElement; cancel: () => void } | null = null;

  function stop() {
    playback?.cancel();
    playback = null;
  }

  function start(cell: HTMLElement) {
    const label = cell.querySelector<HTMLElement>('[data-calendar-workout-title]');
    const text = label?.firstElementChild as HTMLElement | null;
    if (!label || !text) return;
    let titles: string[];
    try { titles = JSON.parse(cell.dataset.workoutTitles || '[]'); } catch { return; }
    if (!titles.length) return;
    const restingText = text.textContent;
    const restingStyle = label.style.cssText;
    const animations = new Set<Animation>();
    let cancelled = false;
    const clearAnimations = () => {
      animations.forEach(animation => animation.cancel());
      animations.clear();
    };
    playback = { cell, cancel() {
      cancelled = true;
      clearAnimations();
      text.textContent = restingText;
      label.style.cssText = restingStyle;
      text.style.cssText = '';
    } };

    // Give reduced-motion users the complete names without marquee/orbit motion.
    if (reducedMotion.matches) {
      text.textContent = titles.join(' · ');
      Object.assign(label.style, { maskImage: 'none', height: 'auto', width: '100%', overflow: 'visible', whiteSpace: 'normal' });
      Object.assign(text.style, { width: '100%', overflowWrap: 'anywhere' });
      return;
    }

    async function play(element: HTMLElement, frames: Keyframe[], duration: number, easing = 'ease-in-out') {
      if (cancelled) return false;
      const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
      animations.add(animation);
      try { await animation.finished; return !cancelled; } catch { return false; }
    }

    async function swapCircles() {
      const front = cell.querySelector<HTMLElement>('[data-calendar-front-circle]');
      const back = cell.querySelector<HTMLElement>('[data-calendar-back-circle]');
      if (!front || !back) return !cancelled;
      const white = '#ffffff';
      const transparent = 'rgba(255,255,255,0)';
      const results = await Promise.all([
        play(front, [
          { transform: 'translate(0, 0)', zIndex: 2, borderColor: white },
          { transform: 'translate(-7px, 5px) scale(.94)', zIndex: 2, offset: .45, borderColor: white },
          { transform: 'translate(-6px, 4px) scale(.94)', zIndex: 0, offset: .55, borderColor: transparent },
          { transform: 'translate(4px, -4px)', zIndex: 0, borderColor: transparent },
        ], 620),
        play(back, [
          { transform: 'translate(4px, -4px)', zIndex: 0, boxShadow: `inset 0 0 0 1px ${transparent}` },
          { transform: 'translate(11px, -9px) scale(.94)', zIndex: 0, offset: .45, boxShadow: `inset 0 0 0 1px ${transparent}` },
          { transform: 'translate(10px, -8px) scale(.94)', zIndex: 2, offset: .55, boxShadow: `inset 0 0 0 1px ${white}` },
          { transform: 'translate(0, 0)', zIndex: 2, boxShadow: `inset 0 0 0 1px ${white}` },
        ], 620),
      ]);
      return results.every(Boolean);
    }

    async function loop() {
      let index = 0;
      while (!cancelled) {
        text.textContent = titles[index];
        const width = label.clientWidth;
        const overflowing = text.scrollWidth > width;
        // Leave room inside the faded edges so the first/last letters become
        // fully readable, rather than remaining beneath the mask.
        const travel = overflowing ? Math.max(0, text.scrollWidth - width * .6) : 0;
        label.style.maskImage = overflowing ? 'linear-gradient(to right,transparent,#000 20%,#000 80%,transparent)' : 'none';
        const start = `translateX(${travel / 2}px)`;
        const end = `translateX(${-travel / 2}px)`;
        const at = (transform: string, opacity = 1) => ({ transform, opacity });
        if (!travel && titles.length === 1) return;
        if (!await play(text, [at(start, 0), at(start)], 160)) return;
        if (!await play(text, [at(start), at(start)], travel ? 450 : 1400)) return;
        if (travel) {
          if (!await play(text, [at(start), at(end)], Math.max(1600, travel / 24 * 1000), 'linear')) return;
          if (!await play(text, [at(end), at(end)], 650)) return;
        }
        if (!await play(text, [at(end), at(end, 0)], 160)) return;
        if (titles.length > 1 && !await swapCircles()) return;
        // Both discs have the same color: resetting their identities at the
        // end of the orbit leaves the resting stack visually unchanged.
        clearAnimations();
        index = (index + 1) % titles.length;
      }
    }
    void loop();
  }

  function sync() {
    const target = hovered ?? focused;
    const available = !document.hidden && !calendar.inert && !calendar.classList.contains('invisible') && calendar.dataset.dustActive !== 'true';
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
    hovered = cell;
    sync();
  }
  function onOut(event: PointerEvent) {
    if (event.relatedTarget instanceof Node && hovered?.contains(event.relatedTarget)) return;
    hovered = null;
    sync();
  }
  function onFocus(event: FocusEvent) {
    const cell = entry(event.target);
    focused = cell?.matches(':focus-visible') ? cell : null;
    sync();
  }
  function onBlur(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && focused?.contains(event.relatedTarget)) return;
    focused = null;
    sync();
  }
  function restart() { stop(); sync(); }
  function reset() { hovered = focused = null; stop(); }
  body.addEventListener('pointerover', onOver);
  body.addEventListener('pointerout', onOut);
  body.addEventListener('focusin', onFocus);
  body.addEventListener('focusout', onBlur);
  window.addEventListener('resize', restart, { passive: true });
  reducedMotion.addEventListener('change', restart);
  return {
    stop: reset,
    dispose() {
      reset();
      body.removeEventListener('pointerover', onOver);
      body.removeEventListener('pointerout', onOut);
      body.removeEventListener('focusin', onFocus);
      body.removeEventListener('focusout', onBlur);
      window.removeEventListener('resize', restart);
      reducedMotion.removeEventListener('change', restart);
    },
  };
}
