import { captureCalendar } from './calendar-dust';

// This is decorative progress, independent of recorded workout statistics.
// Most new sessions improve or hold steady; occasional setbacks stay visible.
export function nextWorkoutValue(value: number, random = Math.random) {
  const direction = random();
  const step = direction < 0.2 ? -(7 + random() * 12)
    : direction < 0.4 ? 0 : direction > 0.9 ? 40 + random() * 35 : 10 + random() * 18;
  return Math.max(4, value + step);
}

interface Point { x: number; y: number }
interface GraphPoint extends Point { id: number; value: number; opacity: number }
interface Particle extends Point { drift: number; rise: number; size: number; phase: number; sprite?: HTMLCanvasElement }
interface GymArt {
  element: HTMLElement;
  source: SVGSVGElement | HTMLElement;
  svg?: SVGSVGElement;
  canvas: HTMLCanvasElement;
  calendar?: boolean;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function createGymBackground(section: HTMLElement) {
  const arts: GymArt[] = Array.from(section.querySelectorAll<HTMLElement>('[data-gym-art]')).map(element => {
    const svg = element.querySelector<SVGSVGElement>('svg')!;
    return { element, source: svg, svg, canvas: element.querySelector<HTMLCanvasElement>('canvas')! };
  });
  const calendar = section.querySelector<HTMLElement>('[data-gym-calendar]');
  if (calendar) arts.push({ element: calendar, source: calendar.querySelector<HTMLElement>('[data-calendar-content]')!, canvas: calendar.querySelector<HTMLCanvasElement>('[data-calendar-particles]')!, calendar: true });
  const sprites = new Map<string, HTMLCanvasElement>();
  function particleSprite(color: string) {
    let sprite = sprites.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 12;
      const context = sprite.getContext('2d')!;
      context.fillStyle = color;
      context.beginPath();
      context.arc(6, 6, 6, 0, Math.PI * 2);
      context.fill();
      sprites.set(color, sprite);
    }
    return sprite;
  }
  function setArtVisible(art: GymArt, value: boolean, accessible = value) {
    art.element.classList.toggle('invisible', !value);
    if (art.calendar) {
      art.element.inert = !accessible;
      art.element.setAttribute('aria-hidden', String(!accessible));
    }
  }
  function calendarDust(value: boolean) {
    if (!calendar) return;
    calendar.dataset.dustActive = String(value);
    calendar.dispatchEvent(new Event('gym:dust'));
  }
  const line = section.querySelector<SVGPathElement>('[data-graph-line]');
  const dots = Array.from(section.querySelectorAll<SVGCircleElement>('[data-graph-dot]'));
  const maxGraphPoints = Math.max(5, dots.length);
  const medalFront = section.querySelector<SVGPathElement>('[data-medal-front]');
  const medalBack = section.querySelector<SVGPathElement>('[data-medal-back]');
  const medalEdges = section.querySelector<SVGPathElement>('[data-medal-edges]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = false;
  let visible = false;
  let disposed = false;
  let frame = 0;
  let lastFrame = 0;
  let lastPointAt = 0;
  let angle = 0.28;
  let id = 5;
  let values = [{ id: 0, value: 50 }, { id: 1, value: 90 }, { id: 2, value: 70 }, { id: 3, value: 100 }, { id: 4, value: 125 }];
  let points: GraphPoint[] = [];
  let growth: { start: number; from: GraphPoint[]; to: GraphPoint[] } | null = null;
  let dust: {
    entering: boolean;
    start: number;
    resolve: () => void;
    layers: {
      art: typeof arts[number];
      particles: Particle[];
      context: CanvasRenderingContext2D;
      image: HTMLCanvasElement;
      sprite: HTMLCanvasElement;
      height: number;
      scale: number;
      paintWidth: number;
      paintHeight: number;
    }[];
  } | null = null;

  function layoutGraph() {
    const low = values.length < maxGraphPoints ? 0 : Math.min(...values.map(point => point.value)) - 22;
    const high = values.length < maxGraphPoints ? Math.max(200, ...values.map(point => point.value + 25))
      : Math.max(...values.map(point => point.value)) + 28;
    return values.map((point, index) => ({
      ...point, x: 16 + index * 50, y: 330 - (point.value - low) / (high - low) * 300, opacity: 1,
    }));
  }

  function drawGraph(time: number, forceGeometry = false) {
    const geometryChanged = forceGeometry || Boolean(growth);
    if (growth) {
      const progress = clamp((time - growth.start) / 780);
      const eased = 1 - Math.pow(1 - progress, 3);
      points = growth.to.map(target => {
        const previous = growth!.from.find(point => point.id === target.id) ?? growth!.from.at(-1)!;
        return { ...target, x: mix(previous.x, target.x, eased), y: mix(previous.y, target.y, eased), opacity: eased };
      });
      points.forEach(point => {
        if (growth!.from.some(previous => previous.id === point.id)) point.opacity = 1;
      });
      if (progress === 1) growth = null;
    }
    if (geometryChanged) line?.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '));
    dots.forEach((dot, index) => {
      if (!geometryChanged && index !== points.length - 1) return;
      const point = points[index];
      if (geometryChanged) dot.setAttribute('r', point ? index === points.length - 1 ? '5.5' : '4.5' : '0');
      if (!point) return;
      if (geometryChanged) {
        dot.setAttribute('cx', point.x.toFixed(2));
        dot.setAttribute('cy', point.y.toFixed(2));
      }
      const pulse = index === points.length - 1 && !reducedMotion.matches
        ? 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(time / 700 * Math.PI * 2)) : 0.72;
      dot.style.opacity = String(pulse * point.opacity);
    });
  }

  function addPoint(time: number) {
    const from = points.map(point => ({ ...point }));
    values.push({ id: id++, value: nextWorkoutValue(values.at(-1)!.value) });
    if (values.length > maxGraphPoints) values.shift();
    growth = { start: time, from, to: layoutGraph() };
    lastPointAt = time;
  }

  function resetGraph() {
    values = [{ id: 0, value: 50 }, { id: 1, value: 90 }, { id: 2, value: 70 }, { id: 3, value: 100 }, { id: 4, value: 125 }];
    id = 5;
    growth = null;
    points = layoutGraph();
    lastPointAt = performance.now();
    drawGraph(lastPointAt, true);
  }

  // Two faces and connecting edges give the medal real depth during a full
  // turn, including a narrow rim when the face is viewed edge-on.
  const circle = (radius: number) => Array.from({ length: 65 }, (_, index) => ({
    x: 120 + Math.cos(index / 64 * Math.PI * 2) * radius,
    y: 106 + Math.sin(index / 64 * Math.PI * 2) * radius,
  }));
  const shapes = [
    circle(71), circle(57),
    [{ x: 83, y: 165 }, { x: 58, y: 256 }, { x: 89, y: 236 }, { x: 107, y: 269 }, { x: 128, y: 177 }],
    [{ x: 157, y: 165 }, { x: 182, y: 256 }, { x: 151, y: 236 }, { x: 133, y: 269 }, { x: 112, y: 177 }],
  ];
  const edgePoints = [...shapes[0].filter((_, index) => index % 8 === 0 && index < 64), ...shapes[2], ...shapes[3]];
  let medalOutlines: Point[][] = [];
  function project(point: Point, depth: number) {
    const x = point.x - 120;
    const y = point.y - 150;
    const rotatedX = x * Math.cos(angle) + depth * Math.sin(angle);
    const rotatedZ = -x * Math.sin(angle) + depth * Math.cos(angle);
    const tiltedY = y * Math.cos(-0.13) - rotatedZ * Math.sin(-0.13);
    const z = y * Math.sin(-0.13) + rotatedZ * Math.cos(-0.13);
    const perspective = 650 / (650 + z);
    return { x: 120 + rotatedX * perspective, y: 150 + tiltedY * perspective };
  }
  function drawMedal() {
    const front = shapes.map(shape => shape.map(point => project(point, -7)));
    const back = shapes.map(shape => shape.map(point => project(point, 7)));
    const edges = edgePoints.map(point => [project(point, -7), project(point, 7)]);
    const path = (outline: Point[]) => outline.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    medalFront?.setAttribute('d', front.map(outline => `${path(outline)} Z`).join(' '));
    medalBack?.setAttribute('d', back.map(outline => `${path(outline)} Z`).join(' '));
    medalEdges?.setAttribute('d', edges.map(path).join(' '));
    medalOutlines = [...front, ...back].map(outline => [...outline, outline[0]]).concat(edges);
  }

  function sampleInk(isGraph: boolean) {
    const particles: Particle[] = [];
    const outlines = isGraph ? [points, ...points.map((point, index) => {
      const radius = index === points.length - 1 ? 5.5 : 4.5;
      return Array.from({ length: 13 }, (_, step) => ({ x: point.x + Math.cos(step / 12 * Math.PI * 2) * radius, y: point.y + Math.sin(step / 12 * Math.PI * 2) * radius }));
    })] : medalOutlines;
    // Sample the geometry already used to draw the artwork. Repeated native
    // SVG length queries caused a noticeable pause at the start of each swap.
    outlines.forEach(outline => {
      for (let index = 1; index < outline.length; index++) {
        const from = outline[index - 1];
        const to = outline[index];
        const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 5));
        for (let step = 0; step < steps; step++) {
          particles.push({ x: mix(from.x, to.x, step / steps), y: mix(from.y, to.y, step / steps), drift: -30 - Math.random() * 75, rise: 100 + Math.random() * 150, size: 0.7 + Math.random() * 1.3, phase: Math.random() * Math.PI * 2 });
        }
      }
    });
    return particles;
  }

  function captureInk(svg: SVGSVGElement, width: number, height: number, ratio: number, scale: number) {
    const image = document.createElement('canvas');
    image.width = Math.ceil(width * ratio);
    image.height = Math.ceil(height * ratio);
    const context = image.getContext('2d')!;
    context.scale(ratio * scale, ratio * scale);
    svg.querySelectorAll<SVGGeometryElement>('[data-gym-ink]').forEach(ink => {
      const style = getComputedStyle(ink);
      const path = new Path2D(ink.getAttribute('d') ?? '');
      if (ink instanceof SVGCircleElement) {
        const radius = ink.r.baseVal.value;
        if (!radius) return;
        path.arc(ink.cx.baseVal.value, ink.cy.baseVal.value, radius, 0, Math.PI * 2);
      }
      context.globalAlpha = Number(style.opacity);
      if (style.fill !== 'none') { context.fillStyle = style.fill; context.fill(path); }
      if (style.stroke !== 'none') {
        context.strokeStyle = style.stroke;
        context.lineWidth = parseFloat(style.strokeWidth);
        context.lineCap = style.strokeLinecap as CanvasLineCap;
        context.lineJoin = style.strokeLinejoin as CanvasLineJoin;
        context.stroke(path);
      }
    });
    return image;
  }

  function finishDust() {
    if (!dust) return;
    const current = dust;
    dust = null;
    active = current.entering;
    arts.forEach(art => {
      setArtVisible(art, active);
      art.source.style.visibility = '';
      art.canvas.getContext('2d')?.clearRect(0, 0, art.canvas.width, art.canvas.height);
    });
    calendarDust(false);
    lastFrame = 0;
    lastPointAt = performance.now();
    current.resolve();
  }

  function drawDust(time: number) {
    if (!dust) return;
    const progress = clamp((time - dust.start) / (dust.entering ? 1350 : 1450));
    dust.layers.forEach(({ art, particles, context, image, sprite, height, scale, paintWidth, paintHeight }) => {
      context.clearRect(0, 0, art.canvas.width, art.canvas.height);
      const reveal = dust!.entering ? clamp((progress - 0.2) / 0.7) : clamp(progress / 0.6);
      const cutoff = (dust!.entering ? 1 - reveal : reveal) * paintHeight;
      // Paint a cached outline with the dust in one canvas. Moving a CSS clip
      // over live SVG on every frame needlessly repainted the vector artwork.
      context.save();
      context.beginPath();
      context.rect(80, 120 + cutoff, paintWidth, paintHeight - cutoff);
      context.clip();
      context.drawImage(image, 80, 120, paintWidth, paintHeight);
      context.restore();
      particles.forEach(particle => {
        const band = particle.y / height;
        const boundary = dust!.entering ? 0.2 + 0.7 * (1 - band) : 0.6 * band;
        const travel = dust!.entering ? (progress - boundary + 0.38) / 0.38 : (progress - boundary) / 0.4;
        if (travel < 0 || travel > 1) return;
        const amount = dust!.entering ? 1 - travel : travel;
        const x = particle.x * scale + 80 + particle.drift * amount + Math.sin(amount * 5 + particle.phase) * amount * 10;
        const y = particle.y * scale + 120 - particle.rise * amount;
        context.globalAlpha = dust!.entering ? Math.min(1, travel * 5) * 0.8 : (1 - travel) * 0.8;
        context.drawImage(particle.sprite ?? sprite, x - particle.size, y - particle.size, particle.size * 2, particle.size * 2);
      });
      context.globalAlpha = 1;
    });
    if (progress === 1) finishDust();
  }

  function schedule() {
    if (!frame && !disposed && !document.hidden && visible && (active || dust) && !reducedMotion.matches) frame = requestAnimationFrame(tick);
  }
  function tick(time: number) {
    frame = 0;
    // Follow the display's animation frames; a time-threshold frame skip was
    // reducing the nominal 30 fps cap to about 20 fps on a 60 Hz display.
    const elapsed = lastFrame ? Math.min(time - lastFrame, 100) : 0;
    lastFrame = time;
    if (dust) drawDust(time);
    else if (active) {
      if (time - lastPointAt > 2600) addPoint(time);
      drawGraph(time);
      angle += elapsed / 22000 * Math.PI * 2;
      drawMedal();
    }
    schedule();
  }

  function setActive(value: boolean) {
    finishDust();
    active = value;
    arts.forEach(art => setArtVisible(art, value));
    calendarDust(false);
    lastFrame = 0;
    lastPointAt = performance.now();
    if (value) { drawGraph(lastPointAt, true); drawMedal(); }
    else { cancelAnimationFrame(frame); frame = 0; }
    schedule();
  }

  function animate(entering: boolean): Promise<void> {
    finishDust();
    if (entering) resetGraph();
    if (reducedMotion.matches || !visible || document.hidden) {
      setActive(entering);
      return Promise.resolve();
    }
    calendarDust(true);
    const layers = arts.flatMap(art => {
      const context = art.canvas.getContext('2d');
      if (!context) return [];
      // Make the calendar's mobile layout measurable while concealing its live
      // contents. The original slot stays in place until dissolution ends.
      art.source.style.visibility = 'hidden';
      setArtVisible(art, true, false);
      const bounds = art.source.getBoundingClientRect();
      const { width, height } = art.svg?.viewBox.baseVal ?? bounds;
      const scale = bounds.width / width;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const captured = art.calendar ? captureCalendar(art.element, ratio) : null;
      const image = captured?.image ?? captureInk(art.svg!, bounds.width, bounds.height, ratio, scale);
      const sprite = particleSprite(art.element.dataset.particleColor ?? '#1E6FFF');
      const particles: Particle[] = captured ? captured.samples.map(sample => ({
        x: sample.x, y: sample.y, drift: -30 - Math.random() * 75, rise: 100 + Math.random() * 150,
        size: 0.55 + Math.random() * 1.1, phase: Math.random() * Math.PI * 2, sprite: particleSprite(sample.color),
      })) : sampleInk(art.element.dataset.gymArt === 'graph');
      art.canvas.width = Math.ceil((bounds.width + 160) * ratio);
      art.canvas.height = Math.ceil((bounds.height + 240) * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return [{ art, particles, context, image, sprite, height, scale, paintWidth: bounds.width, paintHeight: bounds.height }];
    });
    if (!layers.length) { setActive(entering); return Promise.resolve(); }
    const finished = new Promise<void>(resolve => { dust = { entering, start: performance.now(), resolve, layers }; });
    schedule();
    return finished;
  }

  const onVisibility = () => {
    if (document.hidden) { finishDust(); cancelAnimationFrame(frame); frame = 0; }
    else { lastFrame = 0; lastPointAt = performance.now(); schedule(); }
  };
  const onMotionChange = () => {
    if (reducedMotion.matches) {
      finishDust();
      cancelAnimationFrame(frame); frame = 0;
      drawGraph(performance.now());
    } else { lastFrame = 0; lastPointAt = performance.now(); schedule(); }
  };
  const onResize = () => { finishDust(); };
  resetGraph();
  drawMedal();
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', onMotionChange);
  window.addEventListener('resize', onResize, { passive: true });

  return {
    enter: () => animate(true),
    exit: () => animate(false),
    setActive,
    finish: finishDust,
    setVisible(value: boolean) {
      visible = value;
      if (!value) { finishDust(); cancelAnimationFrame(frame); frame = 0; }
      else { lastFrame = 0; lastPointAt = performance.now(); schedule(); }
    },
    dispose() {
      disposed = true;
      finishDust();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', onResize);
    },
  };
}
