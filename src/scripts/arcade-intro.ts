import { INTRO_ROUTE, CHASE_ROUTE, CHASE_LEAD, GHOST_GAPS, INTRO_DISTANCE, INTRO_PELLET_DISTANCES, INTRO_START_SCORE, POINTS_PER_PELLET, sampleRoute } from '../data/arcade-maze';

const RUN_START = 400;
const CLEAR_START = 2600;
const LAND_START = 3250;
const END = 4350;
type Point = { x: number; y: number };

export function initArcadeIntro() {
  const root = document.documentElement;
  const dialog = document.querySelector<HTMLDialogElement>('[data-arcade-intro]');
  const logo = document.querySelector<HTMLImageElement>('[data-site-logo]');
  if (!dialog || !logo || !root.hasAttribute('data-site-intro')) return;
  const backdrop = dialog.querySelector<HTMLElement>('[data-intro-backdrop]')!;
  const board = dialog.querySelector<HTMLElement>('[data-intro-board]')!;
  const maze = dialog.querySelector<SVGSVGElement>('[data-intro-maze]')!;
  const player = dialog.querySelector<HTMLElement>('[data-intro-player]')!;
  const facing = dialog.querySelector<SVGSVGElement>('[data-intro-facing]')!;
  const mouth = dialog.querySelector<SVGPathElement>('[data-intro-mouth]')!;
  const letter = dialog.querySelector<SVGPathElement>('[data-intro-letter]')!;
  const hud = dialog.querySelector<HTMLElement>('[data-intro-hud]')!;
  const score = dialog.querySelector<HTMLElement>('[data-intro-score]')!;
  const message = dialog.querySelector<HTMLElement>('[data-intro-clear]')!;
  const burst = dialog.querySelector<SVGSVGElement>('[data-intro-burst]')!;
  const skip = dialog.querySelector<HTMLButtonElement>('[data-intro-skip]')!;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let elapsed = 0;
  let previous = 0;
  let ended = false;
  let keyboardUsed = false;
  const previousLogoStyle = { visibility: logo.style.visibility, opacity: logo.style.opacity };
  let size = 32;
  let cell = 1, boardLeft = 0, boardTop = 0;
  const ghosts = [...maze.querySelectorAll<SVGGElement>('[data-intro-ghost]')].map((element, index) => ({
    element,
    body: element.querySelector<SVGPathElement>('[data-ghost-body]')!,
    eyes: [...element.querySelectorAll<SVGCircleElement>('[data-ghost-pupil]')],
    gap: GHOST_GAPS[index],
  }));
  const pellets = [...maze.querySelectorAll<SVGCircleElement>('.maze-pellet')];
  const ghostLayer = maze.querySelector<SVGGElement>('[data-intro-ghosts]')!;
  let goal: Point = { x: 0, y: 0 };

  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  function place(point: Point, width: number) {
    player.style.transform = `translate3d(${point.x - width / 2}px, ${point.y - width / 2}px, 0) scale(${width / 56})`;
  }
  function toScreen(point: Point): Point {
    return { x: boardLeft + (point.x + .5) * cell, y: boardTop + (point.y + .5) * cell };
  }
  function sample(progress: number) {
    const position = sampleRoute(INTRO_ROUTE, clamp(progress) * INTRO_DISTANCE);
    return { ...toScreen(position), angle: position.angle * 180 / Math.PI };
  }
  function moveGhosts(progress: number) {
    const footstep = Math.floor(elapsed / 120) % 2;
    for (const ghost of ghosts) {
      const position = sampleRoute(CHASE_ROUTE, CHASE_LEAD + clamp(progress) * INTRO_DISTANCE - ghost.gap);
      ghost.element.setAttribute('transform', `translate(${position.x + .5} ${position.y + .5}) scale(${1 / 26})`);
      ghost.body.setAttribute('d', footstep
        ? 'M-11 12V-1a11 11 0 0 1 22 0v13l-4-4-4 4-3-4-3 4-4-4Z'
        : 'M-11 12V-1a11 11 0 0 1 22 0v13l-3-2-4 2-4-4-4 4-4-2Z');
      ghost.eyes.forEach((eye, index) => {
        eye.setAttribute('cx', String((index === 0 ? -4 : 5) + Math.cos(position.angle) * 1.5));
        eye.setAttribute('cy', String(-2 + Math.sin(position.angle) * 1.5));
      });
    }
  }
  function layout() {
    // CSS fits the already-rendered SVG. Measure it instead of rebuilding the
    // maze, dots and ghosts after JavaScript arrives or the viewport changes.
    const styles = getComputedStyle(maze);
    const width = parseFloat(styles.width), height = parseFloat(styles.height);
    cell = width / 28;
    boardLeft = (dialog!.clientWidth - width) / 2;
    boardTop = (dialog!.clientHeight - height) / 2;
    size = Math.min(44, cell * 1.12);
    goal = sample(1);
    board.style.setProperty('--intro-goal-x', `${goal.x}px`);
    board.style.setProperty('--intro-goal-y', `${goal.y}px`);
    burst.style.left = `${goal.x - 60}px`; burst.style.top = `${goal.y - 60}px`;
    // Paint the first actor positions before allowing any of them to appear.
    // This also preserves the current chase/flight position during a resize.
    paint();
    dialog!.dataset.introReady = '';
  }
  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    const restoreFocus = dialog!.contains(document.activeElement);
    if (dialog!.open) dialog!.close();
    root.removeAttribute('data-site-intro');
    logo!.style.visibility = previousLogoStyle.visibility;
    logo!.style.opacity = previousLogoStyle.opacity;
    if (restoreFocus && keyboardUsed) logo!.closest<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    window.removeEventListener('resize', layout);
    window.removeEventListener('site-intro:skip', finish);
    window.removeEventListener('keydown', onKeydown, true);
    motion.removeEventListener('change', onMotionChange);
    dialog!.removeEventListener('cancel', onCancel);
    skip.removeEventListener('click', finish);
    document.removeEventListener('astro:before-swap', finish);
  }
  function onMotionChange() { if (motion.matches) finish(); }
  function onKeydown() { keyboardUsed = true; }
  function onCancel(event: Event) { event.preventDefault(); finish(); }
  function paint() {
    const run = clamp((elapsed - RUN_START) / (CLEAR_START - RUN_START));
    const eaten = INTRO_PELLET_DISTANCES.filter(distance => distance <= run * INTRO_DISTANCE + .00001).length;
    const scoreText = String(INTRO_START_SCORE + eaten * POINTS_PER_PELLET).padStart(6, '0');
    if (score.textContent !== scoreText) score.textContent = scoreText;
    pellets.forEach((dot, index) => { dot.style.opacity = index < eaten ? '0' : '1'; });
    const clear = clamp((elapsed - CLEAR_START) / (LAND_START - CLEAR_START));
    const flight = clamp((elapsed - LAND_START) / (END - LAND_START));
    dialog!.dataset.phase = flight > 0 ? 'landing' : clear > 0 ? 'clear' : 'playing';
    const position = sample(run);
    moveGhosts(run);
    facing.style.rotate = `${position.angle}deg`;
    if (flight > 0) {
      const landing = logo!.getBoundingClientRect();
      const destination = { x: landing.left + landing.width / 2, y: landing.top + landing.height / 2 };
      const progress = smooth(flight);
      const arch = Math.sin(Math.PI * progress) * Math.min(90, innerHeight * .12);
      place({ x: goal.x + (destination.x - goal.x) * progress, y: goal.y + (destination.y - goal.y) * progress + arch }, size + (landing.width - size) * progress);
      facing.style.rotate = '0deg';
      letter.style.opacity = String(smooth((flight - .1) / .7));
      mouth.setAttribute('d', `M${140 + 36 * progress} 140 300 ${20 + 25 * progress}V${260 - 25 * progress}Z`);
      mouth.style.transformOrigin = `${140 + 36 * progress}px 140px`;
      // Crossfade the matching mark into the real SVG, keeping its own mouth
      // animation continuous rather than swapping poses at the final frame.
      const handoff = smooth((flight - .88) / .12);
      logo!.style.visibility = handoff > 0 ? 'visible' : '';
      logo!.style.opacity = String(handoff);
      player.style.opacity = String(1 - handoff);
      const start = [255, 222, 0], end = [22, 23, 19];
      player.style.color = `rgb(${start.map((value, index) => Math.round(value + (end[index] - value) * progress)).join(' ')})`;
      board.style.transform = `scale(${1 + progress * 1.3})`;
      board.style.opacity = String(1 - smooth(flight / .7));
      backdrop.style.opacity = String(1 - smooth((flight - .08) / .8));
      hud.style.opacity = skip.style.opacity = String(1 - smooth(flight / .35));
      message.style.opacity = String(1 - smooth(flight / .3));
    } else {
      place(position, size);
      mouth.setAttribute('d', 'M140 140 300 20V260Z');
      mouth.style.transformOrigin = '140px 140px';
      message.style.opacity = String(smooth(clear / .3));
      message.style.transform = `translateY(${(1 - smooth(clear / .3)) * 12}px)`;
      ghostLayer.style.opacity = String(1 - smooth(clear / .4));
    }
    burst.style.opacity = String(clear > 0 && flight === 0 ? Math.sin(Math.PI * clear) : 0);
    burst.style.transform = `scale(${.4 + clear * .9})`;
  }
  function render(now: number) {
    if (ended) return;
    elapsed += previous ? Math.min(64, now - previous) : 0;
    previous = now;
    paint();
    if (elapsed >= END) { finish(); return; }
    frame = requestAnimationFrame(render);
  }
  try {
    if (motion.matches) { finish(); return; }
    layout();
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    skip.addEventListener('click', finish);
    dialog.addEventListener('cancel', onCancel);
    window.addEventListener('resize', layout, { passive: true });
    window.addEventListener('site-intro:skip', finish);
    window.addEventListener('keydown', onKeydown, true);
    motion.addEventListener('change', onMotionChange);
    document.addEventListener('astro:before-swap', finish, { once: true });
    frame = requestAnimationFrame(render);
  } catch { finish(); }
}
