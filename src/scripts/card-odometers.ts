export function initCardOdometers() {
  const stats = Array.from(document.querySelectorAll<HTMLElement>('[data-activity-card] [data-odometer]'));
  if (!stats.length || !('IntersectionObserver' in window)) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set<HTMLElement>();
  const played = new Set<HTMLElement>();
  const animations = new Map<HTMLElement, Animation[]>();
  const section = document.querySelector<HTMLElement>('[data-hobbies]');
  let readyPanel = section?.querySelector<HTMLElement>('[data-hobby-panel][aria-hidden="false"]');

  function settle(stat: HTMLElement) {
    animations.get(stat)?.forEach(animation => animation.cancel());
    animations.delete(stat);
  }

  function reveal(stat: HTMLElement) {
    const panel = stat.closest<HTMLElement>('[data-hobby-panel]');
    if (!visible.has(stat) || played.has(stat) || document.hidden || panel !== readyPanel) return;
    played.add(stat);
    if (reducedMotion.matches) return;
    const reels = Array.from(stat.querySelectorAll<HTMLElement>('[data-odometer-reel]'));
    // Animate only transforms. The static CSS already shows the exact value,
    // including before JS runs, after cancellation and with reduced motion.
    const rolling = reels.map((reel, index) => reel.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(calc(var(--odometer-stop) * -1.2em))' },
    ], {
      duration: 850 + index * 65,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards',
    }));
    animations.set(stat, rolling);
    void Promise.allSettled(rolling.map(animation => animation.finished)).then(() => {
      if (animations.get(stat) === rolling) settle(stat);
    });
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const stat = entry.target as HTMLElement;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        visible.add(stat);
        reveal(stat);
      } else {
        visible.delete(stat);
        settle(stat);
      }
    });
  }, { threshold: [0, 0.6] });
  const observeReadyPanel = () => {
    stats.forEach(stat => {
      if (stat.closest('[data-hobby-panel]') === readyPanel) observer.observe(stat);
    });
  };
  observeReadyPanel();

  const onHobbyChange = () => {
    readyPanel = null;
    visible.clear();
    stats.forEach(stat => {
      observer.unobserve(stat);
      played.delete(stat);
      settle(stat);
    });
  };
  const onCardsEntered = (event: Event) => {
    const { hobby } = (event as CustomEvent<{ hobby: string }>).detail;
    readyPanel = section?.querySelector<HTMLElement>(`[data-hobby-panel="${hobby}"]`);
    // Re-observing requests a fresh visibility report even if these stats
    // occupy exactly the same screen position as on the previous visit.
    observeReadyPanel();
  };
  section?.addEventListener('hobby:change', onHobbyChange);
  section?.addEventListener('hobby:cards-entered', onCardsEntered);

  const onMotionChange = () => {
    if (reducedMotion.matches) stats.forEach(settle);
  };
  const onVisibilityChange = () => {
    if (document.hidden) stats.forEach(settle);
    else visible.forEach(reveal);
  };
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('astro:before-swap', () => {
    observer.disconnect();
    section?.removeEventListener('hobby:change', onHobbyChange);
    section?.removeEventListener('hobby:cards-entered', onCardsEntered);
    stats.forEach(settle);
    reducedMotion.removeEventListener('change', onMotionChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }, { once: true });
}
