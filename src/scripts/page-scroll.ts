// Scale vertical wheel input across the page; touch and keyboard stay native.
const WHEEL_SENSITIVITY = 0.65;
const SMOOTHING_MS = 70;

export function initPageScroll() {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lineHeight = parseFloat(getComputedStyle(root).lineHeight) || 16;
  let frame = 0;
  let targetY = window.scrollY;
  let lastAppliedY = window.scrollY;
  let lastTime = 0;

  const limit = () => Math.max(0, root.scrollHeight - window.innerHeight);
  const clamp = (value: number) => Math.max(0, Math.min(limit(), value));
  const locked = () => document.querySelector('dialog[open]') !== null
    || getComputedStyle(root).overflowY === 'hidden'
    || getComputedStyle(document.body).overflowY === 'hidden';

  function stop() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    targetY = lastAppliedY = window.scrollY;
    lastTime = 0;
  }

  function apply(top: number) {
    window.scrollTo({ top, behavior: 'instant' });
    lastAppliedY = window.scrollY;
  }

  function render(time: number) {
    frame = 0;
    if (locked() || document.hidden) { stop(); return; }
    targetY = clamp(targetY);
    const remaining = targetY - window.scrollY;
    const elapsed = Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    if (Math.abs(remaining) <= 1) {
      apply(targetY);
      return;
    }
    // Time-based easing stays consistent across different display refresh rates.
    const step = remaining * (1 - Math.exp(-elapsed / SMOOTHING_MS));
    // Some browsers round scroll positions to whole pixels. A minimum step
    // prevents easing from stalling just short of the destination.
    apply(window.scrollY + Math.sign(remaining) * Math.min(Math.abs(remaining), Math.max(1, Math.abs(step))));
    frame = window.requestAnimationFrame(render);
  }

  function usesNativeScroll(event: WheelEvent) {
    for (const node of event.composedPath()) {
      if (!(node instanceof HTMLElement) || node === document.body || node === root) continue;
      if (node.matches('input, textarea, select') || node.isContentEditable) return true;
      // Respect nested scroll areas and their boundary/overscroll behavior,
      // including the exercise list and photo regions inside activity dialogs.
      if (node.scrollHeight > node.clientHeight + 1
        && /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) return true;
    }
    return false;
  }

  function onWheel(event: WheelEvent) {
    if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey
      || event.shiftKey || event.altKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      || locked() || usesNativeScroll(event)) {
      stop();
      return;
    }
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
    const delta = event.deltaY * unit * WHEEL_SENSITIVITY;
    if (!Number.isFinite(delta) || delta === 0) return;
    if (!frame || delta * (targetY - window.scrollY) < 0) {
      // Reversing direction should respond immediately, without leftover drift.
      targetY = window.scrollY;
    }
    const next = clamp(targetY + delta);
    if (next === window.scrollY && !frame) return;
    event.preventDefault();
    targetY = next;
    if (reducedMotion.matches) { apply(targetY); return; }
    if (!frame) {
      lastAppliedY = window.scrollY;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(render);
    }
  }

  const onScroll = () => {
    // Anchor links, direct horizontal carousel navigation, scrollbars and
    // layout changes can move the page independently. Never pull them back.
    if (frame && Math.abs(window.scrollY - lastAppliedY) > 2) stop();
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointerdown', stop, { passive: true });
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('keydown', stop);
  window.addEventListener('resize', stop, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', stop);

  document.addEventListener('astro:before-swap', () => {
    stop();
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointerdown', stop);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('keydown', stop);
    window.removeEventListener('resize', stop);
    document.removeEventListener('visibilitychange', onVisibility);
    reducedMotion.removeEventListener('change', stop);
  }, { once: true });
}
