export function createBadmintonBackground(section: HTMLElement) {
  const artwork = section.querySelector<HTMLElement>('[data-badminton-art]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const trails = [...section.querySelectorAll<SVGPathElement>('[data-court-line-length]')];
  let active = false;
  let visible = false;
  let transition: { entering: boolean; animations: Animation[]; restore: () => void; resolve: () => void } | null = null;

  // Scale duration with line length and randomize the phase for each highlight.
  trails.forEach(trail => {
    const travel = Number(trail.dataset.courtLineLength) - 180;
    const duration = travel / (90 + Math.random() * 40);
    trail.style.setProperty('--trail-duration', `${duration}s`);
    trail.style.setProperty('--trail-delay', `${-Math.random() * duration * 2}s`);
  });

  function updateFlow() {
    if (artwork) artwork.dataset.courtFlow = String(active && visible && !document.hidden && !motion.matches && !transition);
  }
  function commit(value: boolean) {
    active = value;
    artwork?.classList.toggle('invisible', !value);
    updateFlow();
  }
  function finish() {
    if (!transition) return;
    const current = transition;
    transition = null;
    // Hide the exit scene before restoring its clipped, resting geometry.
    commit(current.entering);
    current.animations.forEach(animation => animation.cancel());
    current.restore();
    current.resolve();
  }
  function setActive(value: boolean) { finish(); commit(value); }

  function animate(entering: boolean): Promise<void> {
    if (!artwork) return Promise.resolve();
    finish();
    if (motion.matches || !visible || document.hidden || typeof artwork.animate !== 'function') {
      commit(entering);
      return Promise.resolve();
    }
    artwork.classList.remove('invisible');
    const animations: Animation[] = [];
    const restorations: (() => void)[] = [];
    let resolve!: () => void;
    const finished = new Promise<void>(done => { resolve = done; });

    if (entering) {
      animations.push(artwork.animate([
        { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
      ], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
    } else {
      // Read the live alternate-animation phase before pausing it. Translating
      // in the group's local X axis also follows the rotated vertical lines.
      const exits = trails.map(trail => {
        const glide = trail.getAnimations().find(animation => 'animationName' in animation && animation.animationName === 'court-line-glide');
        const iteration = Number(glide?.effect?.getComputedTiming().currentIteration ?? 0);
        const direction = (iteration % 2 === 0 ? 1 : -1) * Math.sign(glide?.playbackRate ?? 1);
        const transform = getComputedStyle(trail).transform;
        const x = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform).m41;
        const group = trail.parentElement as unknown as SVGGElement;
        const matrix = group.getScreenCTM();
        const inverse = matrix?.inverse();
        const corners = inverse ? [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]]
          .map(([x, y]) => new DOMPoint(x, y).matrixTransform(inverse).x) : [-2400, 2400];
        const destination = direction > 0 ? Math.max(x + 180, Math.max(...corners) + 24)
          : Math.min(x - 180, Math.min(...corners) - 204);
        return { trail, group, x, direction, destination };
      });
      artwork.dataset.courtExiting = 'true';
      restorations.push(() => { delete artwork.dataset.courtExiting; });
      exits.forEach(({ trail, group, x, direction, destination }) => {
        const clip = group.getAttribute('clip-path');
        group.removeAttribute('clip-path');
        trail.dataset.courtExitDirection = String(direction);
        restorations.push(() => {
          if (clip !== null) group.setAttribute('clip-path', clip);
          delete trail.dataset.courtExitDirection;
        });
        animations.push(trail.animate([
          { transform: `translateX(${x}px)` },
          { transform: `translateX(${destination}px)` },
        ], {
          duration: Math.min(820, Math.max(480, Math.sqrt(Math.abs(destination - x)) * 18)),
          easing: 'cubic-bezier(.55,.05,.85,.45)', fill: 'both',
        }));
      });
      artwork.querySelectorAll<SVGGElement>('[data-court-outline]').forEach(outline => {
        animations.push(outline.animate([{ opacity: getComputedStyle(outline).opacity }, { opacity: 0 }], {
          duration: 480, easing: 'ease-out', fill: 'both',
        }));
      });
    }
    const current = { entering, animations, restore: () => restorations.forEach(restore => restore()), resolve };
    transition = current;
    updateFlow();
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (transition === current) finish();
    });
    return finished;
  }
  const onMotionChange = () => { if (motion.matches) finish(); updateFlow(); };
  const onVisibilityChange = () => { if (document.hidden) finish(); updateFlow(); };
  motion.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('resize', finish, { passive: true });
  return {
    enter: () => animate(true),
    exit: () => active ? animate(false) : Promise.resolve(),
    setActive,
    finish,
    setVisible(value: boolean) { visible = value; if (!value) finish(); updateFlow(); },
    dispose() {
      finish();
      commit(false);
      motion.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', finish);
    },
  };
}
