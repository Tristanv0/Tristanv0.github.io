import type { HobbyChangeDetail } from './hobby-tabs';
import { applyHobbyTheme } from './hobby-tabs';
import { createGymBackground } from './gym-background';

export function initHobbiesMotion() {
  const section = document.querySelector<HTMLElement>('[data-hobbies]');
  if (!section) return;
  const scene = section.querySelector<HTMLElement>('[data-arrow-scene]');
  const runningArt = section.querySelector<SVGSVGElement>('[data-scroll-arrows]');
  const runningScenery = section.querySelector<SVGGElement>('[data-running-scenery]');
  const gym = createGymBackground(section);
  const arrows = Array.from(section.querySelectorAll<SVGGElement>('[data-flow-arrow]')).map((group, index) => {
    const path = group.querySelector<SVGPathElement>('[data-arrow-path]')!;
    const guide = group.querySelector<SVGPathElement>('[data-arrow-guide]')!;
    const length = guide.getTotalLength();
    // Cache points once, then trim geometry so the tip stays attached to the
    // visible line during both scroll tracing and the hobby changeover.
    const steps = Math.ceil(length / 5);
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const distance = length * index / steps;
      const point = guide.getPointAtLength(distance);
      return { distance, command: `${point.x} ${point.y}` };
    });
    const scenery = Array.from(section.querySelectorAll<SVGGElement>(`[data-scenery-arrow="${index}"]`));
    return { group, path, guide, length, points, scenery, distance: 0, direction: Number(group.dataset.direction) };
  });
  type Arrow = typeof arrows[number];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let frame = 0;
  let lastProgress = -1;
  let lastDriftProgress = -1;
  let lastReducedMotion = reducedMotion.matches;
  let activeHobby = 'running';
  let changeVersion = 0;
  let disposed = false;
  let transition: {
    phase: 'exit' | 'enter';
    started: number | null;
    distances: number[];
    resolve: () => void;
  } | null = null;

  function draw(arrow: Arrow, from: number, to: number) {
    const start = Math.max(0, Math.min(arrow.length, from));
    const end = Math.max(start, Math.min(arrow.length, to));
    if (end - start < 0.1) {
      arrow.path.setAttribute('d', '');
      return;
    }
    if (start === 0 && end === arrow.length) {
      arrow.path.setAttribute('d', arrow.guide.getAttribute('d')!);
      return;
    }
    const first = arrow.guide.getPointAtLength(start);
    const last = arrow.guide.getPointAtLength(end);
    const middle = arrow.points.filter(point => point.distance > start && point.distance < end).map(point => `L ${point.command}`).join(' ');
    arrow.path.setAttribute('d', `M ${first.x} ${first.y} ${middle} L ${last.x} ${last.y}`);
  }

  function render(time = performance.now()) {
    frame = 0;
    if (!section) return;
    if (transition) {
      const current = transition;
      current.started ??= time;
      const progress = Math.min(1, (time - current.started) / 720);
      if (runningScenery) {
        runningScenery.style.opacity = String(current.phase === 'exit'
          ? Math.max(0, 1 - progress * 2.5) : Math.min(1, progress * 1.5));
      }
      if (current.phase === 'exit') {
        const eased = progress * progress * (3 - 2 * progress);
        arrows.forEach((arrow, index) => {
          // Tail follows the head along an extended curve, rather than fading
          // the whole SVG. The final endpoints lie outside the artwork bounds.
          const tail = eased * arrow.length;
          draw(arrow, tail, tail + current.distances[index]);
          arrow.guide.style.opacity = String(0.09 * Math.max(0, 1 - progress * 4));
        });
        if (progress === 1) {
          transition = null;
          if (runningArt) runningArt.style.visibility = 'hidden';
          current.resolve();
        }
      } else {
        const eased = 1 - Math.pow(1 - Math.max(0, progress), 3);
        arrows.forEach((arrow, index) => {
          draw(arrow, 0, current.distances[index] * eased);
          arrow.guide.style.opacity = String(0.09 * eased);
        });
        if (progress === 1) {
          transition = null;
          arrows.forEach(arrow => { arrow.guide.style.opacity = ''; });
          current.resolve();
        }
      }
      if (transition) schedule();
      return;
    }
    if (activeHobby !== 'running') return;
    // Page scroll advances arrowheads while drift follows the sticky scene.
    const rect = section.getBoundingClientRect();
    const sceneRect = scene?.getBoundingClientRect() ?? rect;
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    const driftProgress = Math.max(0, Math.min(1, (window.innerHeight - sceneRect.top) / (window.innerHeight + sceneRect.height)));
    if (Math.abs(progress - lastProgress) < 0.00001
      && Math.abs(driftProgress - lastDriftProgress) < 0.00001
      && reducedMotion.matches === lastReducedMotion) return;
    lastProgress = progress;
    lastDriftProgress = driftProgress;
    lastReducedMotion = reducedMotion.matches;
    section.style.setProperty('--hobbies-progress', progress.toFixed(4));
    arrows.forEach((arrow, index) => {
      const reveal = reducedMotion.matches ? 1 : Math.min(1, 0.16 + progress * (1.06 + index * 0.09));
      arrow.distance = arrow.length * reveal;
      draw(arrow, 0, arrow.distance);
      const transform = `translate(0 ${reducedMotion.matches ? 0 : (driftProgress - 0.5) * 95 * arrow.direction})`;
      arrow.group.setAttribute('transform', transform);
      // A rock inside a tight loop follows its drift to preserve clearance.
      arrow.scenery.forEach(element => element.setAttribute('transform', transform));
    });
  }
  function schedule() {
    if (!frame && (transition || (visible && activeHobby === 'running'))) frame = window.requestAnimationFrame(render);
  }
  function finishTransition() {
    if (!transition) return;
    const current = transition;
    transition = null;
    arrows.forEach((arrow, index) => {
      draw(arrow, 0, current.phase === 'exit' ? 0 : reducedMotion.matches ? arrow.length : current.distances[index]);
      arrow.guide.style.opacity = current.phase === 'exit' ? '0' : '';
    });
    if (runningArt) runningArt.style.visibility = current.phase === 'exit' ? 'hidden' : '';
    if (runningScenery) runningScenery.style.opacity = current.phase === 'exit' ? '0' : '1';
    current.resolve();
  }
  function animateArrows(phase: 'exit' | 'enter'): Promise<void> {
    const finished = new Promise<void>(resolve => {
      transition = { phase, started: null, distances: arrows.map(arrow => arrow.distance), resolve };
    });
    if (phase === 'enter') {
      arrows.forEach(arrow => { draw(arrow, 0, 0); arrow.guide.style.opacity = '0'; });
      if (runningArt) runningArt.style.visibility = '';
      if (runningScenery) runningScenery.style.opacity = '0';
    }
    if (reducedMotion.matches || !visible || document.hidden) finishTransition();
    else schedule();
    return finished;
  }
  function changeHobby(event: Event) {
    const detail = (event as CustomEvent<HobbyChangeDetail>).detail;
    const version = ++changeVersion;
    finishTransition();
    gym.finish();
    activeHobby = detail.hobby;
    if (reducedMotion.matches) {
      applyHobbyTheme(section!, detail.hobby, detail.color);
      gym.setActive(detail.hobby === 'gym');
      if (runningArt) runningArt.style.visibility = detail.hobby === 'gym' ? 'hidden' : '';
      if (runningScenery) runningScenery.style.opacity = detail.hobby === 'gym' ? '0' : '1';
      lastProgress = -1;
      render();
      detail.finished = Promise.resolve();
      return;
    }
    // Each hobby has its own exit/entry effect. Keep the handover sequential
    // so running's orange arrows never overlap Gym's assembling particles.
    detail.finished = (async () => {
      if (detail.hobby === 'gym') {
        await animateArrows('exit');
        if (disposed || version !== changeVersion) return;
        applyHobbyTheme(section!, detail.hobby, detail.color);
        await gym.enter();
      } else {
        await gym.exit();
        if (disposed || version !== changeVersion) return;
        applyHobbyTheme(section!, detail.hobby, detail.color);
        await animateArrows('enter');
      }
    })();
  }
  const onMotionChange = () => {
    if (reducedMotion.matches) finishTransition();
    lastProgress = -1;
    render();
  };
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    gym.setVisible(visible);
    if (!visible) finishTransition();
    schedule();
  }, { rootMargin: '120px 0px' });
  observer.observe(section);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  section.addEventListener('hobby:change', changeHobby);
  reducedMotion.addEventListener('change', onMotionChange);
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(section);
  render();
  document.addEventListener('astro:before-swap', () => {
    disposed = true;
    changeVersion++;
    observer.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    section.removeEventListener('hobby:change', changeHobby);
    reducedMotion.removeEventListener('change', onMotionChange);
    window.cancelAnimationFrame(frame);
    transition?.resolve();
    transition = null;
    gym.dispose();
  }, { once: true });
}
