export function initHobbiesMotion() {
  const section = document.querySelector<HTMLElement>('[data-hobbies]');
  if (!section) return;
  const arrows = Array.from(section.querySelectorAll<SVGGElement>('[data-flow-arrow]')).map(group => {
    const path = group.querySelector<SVGPathElement>('[data-arrow-path]')!;
    const guide = group.querySelector<SVGPathElement>('[data-arrow-guide]')!;
    const length = guide.getTotalLength();
    // Cache closely spaced points once. Trimming the actual geometry keeps the
    // SVG end marker attached, including with non-scaling strokes on mobile.
    const steps = Math.ceil(length / 5);
    const points = Array.from({ length: steps + 1 }, (_, index) => {
      const distance = length * index / steps;
      const point = guide.getPointAtLength(distance);
      return { distance, command: `${point.x} ${point.y}` };
    });
    return { group, path, guide, length, points, direction: Number(group.dataset.direction) };
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let frame = 0;
  function render() {
    frame = 0;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
    section.style.setProperty('--hobbies-progress', progress.toFixed(4));
    arrows.forEach(({ group, path, guide, length, points, direction }, index) => {
      // Scrolling advances each arrowhead along its curve, with a gentle drift.
      const reveal = reducedMotion.matches ? 1 : Math.min(1, 0.16 + progress * (1.06 + index * 0.09));
      const distance = length * reveal;
      const point = guide.getPointAtLength(distance);
      if (reveal === 1) {
        path.setAttribute('d', guide.getAttribute('d')!);
      } else {
        const prefix = points.filter(sample => sample.distance < distance).map(sample => sample.command);
        path.setAttribute('d', `M ${prefix.join(' L ')} L ${point.x} ${point.y}`);
      }
      group.setAttribute('transform', `translate(0 ${reducedMotion.matches ? 0 : (progress - 0.5) * 95 * direction})`);
    });
  }
  function schedule() {
    if (!frame && visible) frame = window.requestAnimationFrame(render);
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    schedule();
  }, { rootMargin: '120px 0px' });
  observer.observe(section);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', render);
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(section);
  render();
  document.addEventListener('astro:before-swap', () => {
    observer.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    reducedMotion.removeEventListener('change', render);
    window.cancelAnimationFrame(frame);
  }, { once: true });
}
