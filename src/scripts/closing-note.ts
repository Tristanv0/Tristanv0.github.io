// Scrub the closing message with native page scroll, including touch and keys.
export function initClosingNote() {
  const section = document.querySelector<HTMLElement>('[data-closing-note]');
  if (!section) return;
  const lines = [...section.querySelectorAll<HTMLElement>('[data-closing-line]')];
  const wish = section.querySelector<HTMLElement>('[data-closing-wish]')!;
  const phrase = section.querySelector<HTMLElement>('[data-closing-phrase]')!;
  const prefix = section.querySelector<HTMLElement>('[data-closing-prefix]')!;
  const insertedText = section.querySelector<HTMLElement>('[data-closing-insertion]')!;
  const period = section.querySelector<HTMLElement>('[data-closing-period]')!;
  const contact = section.querySelector<HTMLElement>('[data-closing-contact]')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const elements = [...lines, wish, prefix, insertedText, period, contact];
  let frame = 0;
  let nearby = true;
  let slot = 0;
  let compact = false;
  let disposed = false;

  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const between = (value: number, start: number, end: number) => ease((value - start) / (end - start));

  function render() {
    frame = 0;
    if (disposed || motion.matches) return;
    const rect = section!.getBoundingClientRect();
    const viewport = window.innerHeight;
    const timeline = clamp(-rect.top / Math.max(1, rect.height - section!.firstElementChild!.clientHeight));
    // Keep the original message's scroll distance, then reserve a final step
    // for the contact invitation before the sticky section releases.
    const progress = clamp(timeline / .7);
    const entering = (viewport - rect.top) / viewport;
    const dim = between(progress, .43, .8);
    lines.forEach((line, index) => {
      const reveal = between(entering, .12 + index * .06, .78 + index * .06);
      // On phones the wish shares the middle line's position. Fade that line
      // before the wish arrives so the two sentences never compete.
      const fade = compact && index === 1 ? between(progress, .04, .28) : dim;
      line.style.opacity = String(reveal * (1 - fade * .94));
      line.style.transform = `translate3d(0, ${(1 - reveal) * 90 - dim * 12}px, 0) skewY(${(1 - reveal) * 7}deg)`;
    });
    const greeting = between(progress, .08, .38);
    wish.style.opacity = String(greeting);
    wish.style.transform = `translate3d(${(1 - greeting) * 75}px, 0, 0)`;
    const insertion = between(progress, .49, .79);
    // Center the first sentence on its own, then lift it to make room for the
    // second line. Reserve its height so scroll frames only change transforms.
    const shift = slot * (1 - insertion) / 2;
    prefix.style.transform = `translate3d(0, ${shift}px, 0)`;
    period.style.opacity = String(1 - insertion);
    insertedText.style.opacity = String(between(progress, .57, .79));
    insertedText.style.transform = `translate3d(0, ${(1 - insertion) * 30}px, 0) rotate(${(1 - insertion) * -5}deg)`;
    const invitation = contact.contains(document.activeElement) ? 1 : between(timeline, .73, .91);
    contact.style.opacity = String(invitation);
    contact.style.transform = `translate3d(0, ${(1 - invitation) * 24}px, 0)`;
    contact.inert = invitation === 0;
  }

  function schedule() {
    if (!disposed && !motion.matches && !frame) frame = requestAnimationFrame(render);
  }
  function measure() {
    compact = window.innerWidth < 701;
    slot = insertedText.offsetHeight + (parseFloat(getComputedStyle(phrase).rowGap) || 0);
    schedule();
  }
  function onScroll() { if (nearby) schedule(); }
  function onMotionChange() {
    cancelAnimationFrame(frame); frame = 0;
    section!.toggleAttribute('data-closing-motion', !motion.matches);
    if (motion.matches) {
      elements.forEach(element => { element.style.opacity = ''; element.style.transform = ''; });
      contact.inert = false;
    }
    else { measure(); render(); }
  }
  const observer = new IntersectionObserver(entries => {
    nearby = entries[0].isIntersecting;
    schedule();
  }, { rootMargin: '100% 0px' });
  const resize = new ResizeObserver(measure);
  observer.observe(section);
  resize.observe(phrase);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  motion.addEventListener('change', onMotionChange);
  onMotionChange();
  document.fonts.ready.then(() => { if (!disposed) measure(); });
  document.addEventListener('astro:before-swap', () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect(); resize.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', measure);
    motion.removeEventListener('change', onMotionChange);
  }, { once: true });
}
