export function initProjectReveals() {
  const section = document.querySelector<HTMLElement>('#projects');
  if (!section || !('IntersectionObserver' in window)) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  const targets = [...section.querySelectorAll<HTMLElement>('[data-project-card] [data-project-reveal]')];
  if (!targets.length) return;
  const cards = [...section.querySelectorAll<HTMLElement>('[data-project-card]')];
  const pending = new Set(targets);
  const timers = new Map<HTMLElement, number>();
  const delays = new Map<HTMLElement, number>();
  let observer: IntersectionObserver;

  function directionFor(target: HTMLElement) {
    const card = target.closest<HTMLElement>('[data-project-card]');
    if (!card) return 'both';

    const bounds = card.getBoundingClientRect();
    const center = window.innerWidth / 2;
    // Moving the cover left reveals the right edge first, then travels left.
    if (bounds.right <= center) return 'left';
    if (bounds.left >= center) return 'right';
    return 'both';
  }

  function cleanup() {
    observer.disconnect();
    section!.removeEventListener('focusin', onFocus);
    reducedMotion.removeEventListener('change', onMotionChange);
  }

  function finish(target: HTMLElement) {
    window.clearTimeout(timers.get(target));
    timers.delete(target);
    observer.unobserve(target);
    target.removeAttribute('data-project-reveal-state');
    target.removeAttribute('data-project-reveal-direction');
    target.style.removeProperty('--project-reveal-delay');
    pending.delete(target);
    if (!pending.size) cleanup();
  }

  function onMotionChange() {
    if (reducedMotion.matches) [...pending].forEach(finish);
  }

  function onFocus(event: FocusEvent) {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest('[data-project-card]');
    for (const target of [...pending]) {
      if (card?.contains(target) || target.contains(event.target)) finish(target);
    }
  }

  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const target = entry.target as HTMLElement;
      if (!pending.has(target)) continue;

      observer.unobserve(target);
      target.dataset.projectRevealDirection = directionFor(target);
      target.dataset.projectRevealState = 'revealing';
      // Remove covers and clipping completely once the transition has finished.
      timers.set(target, window.setTimeout(() => finish(target), 850 + (delays.get(target) ?? 0)));
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

  for (const target of targets) {
    const card = target.closest<HTMLElement>('[data-project-card]');
    const siblings = card ? [...card.querySelectorAll('[data-project-reveal]')] : [];
    const delay = card
      ? cards.indexOf(card) * 50 + siblings.indexOf(target) * 40
      : 0;

    delays.set(target, delay);
    target.style.setProperty('--project-reveal-delay', `${delay}ms`);
    target.dataset.projectRevealDirection = directionFor(target);
    target.dataset.projectRevealState = 'pending';
    observer.observe(target);
  }

  section.addEventListener('focusin', onFocus);
  reducedMotion.addEventListener('change', onMotionChange);
}
