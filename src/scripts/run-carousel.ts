import type { HobbyChangeDetail } from './hobby-tabs';

const clamp = (value: number, end: number) => Math.max(0, Math.min(end, value));

export function initRunCarousel() {
  const track = document.querySelector<HTMLElement>('[data-run-scroll-track]');
  const sticky = track?.querySelector<HTMLElement>('[data-run-sticky]');
  const scrollers = Array.from(track?.querySelectorAll<HTMLElement>('[data-run-scroller]') ?? []);
  let scroller = scrollers[0];
  if (!track || !sticky || !scroller) return;

  const header = document.querySelector<HTMLElement>('body > header');
  const section = track.closest<HTMLElement>('[data-hobbies]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let distance = 0;
  let pinTop = 0;
  let pinned = false;
  let drivenScrollLeft = 0;
  let frame = 0;
  let needsMeasure = true;
  let pendingProgress: number | null = null;
  let leadingHeight = 0;
  const leading = track.querySelector<HTMLElement>('[data-run-leading]');

  const start = () => {
    return track.getBoundingClientRect().top + window.scrollY - pinTop;
  };

  const render = () => {
    frame = 0;
    if (needsMeasure) {
      needsMeasure = false;
      if (pendingProgress === null && pinned && window.scrollY >= start() && window.scrollY <= start() + distance) {
        pendingProgress = distance > 0 ? clamp(window.scrollY - start(), distance) / distance : 0;
      }
      // A full-width viewport lets cards flow off either screen edge. The
      // first/last flex spacers provide the section inset only at the ends.
      track.style.setProperty('--run-viewport-width', `${document.documentElement.clientWidth}px`);
      const inset = Math.max(16, track.parentElement?.getBoundingClientRect().left ?? 16);
      track.style.setProperty('--run-edge', `${inset}px`);
      const buttonHeight = track.querySelector<HTMLElement>('[data-hobby-tab]')?.offsetHeight ?? 44;
      track.style.setProperty('--calendar-baseline', `${buttonHeight}px`);
      const leadingStyle = leading ? getComputedStyle(leading) : null;
      leadingHeight = leading && leadingStyle?.position !== 'absolute' && leadingStyle?.display !== 'none'
        ? leading.offsetHeight + (parseFloat(leadingStyle?.marginBottom ?? '') || 0) : 0;
      distance = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const contentPinTop = (header?.getBoundingClientRect().height ?? 0) + 16;
      const styles = getComputedStyle(scroller);
      const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-run-card], [data-hobby-card]'));
      const tallest = Math.max(0, ...cards.map(card => card.offsetHeight));
      const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
      const desiredStagger = parseFloat(styles.getPropertyValue('--run-stagger-max')) || 80;
      const tabsHeight = track.querySelector<HTMLElement>('[data-hobby-tabs]')?.offsetHeight ?? 0;
      const availableStagger = window.innerHeight - contentPinTop - 18 - tabsHeight - tallest - padding;
      const setStagger = (visibleLeading: number) => {
        const stagger = Math.min(desiredStagger, Math.max(24, availableStagger - visibleLeading));
        scrollers.forEach(row => row.style.setProperty('--run-stagger', `${stagger}px`));
      };
      // Padding on alternating slots contributes to layout, so their lower
      // edges and hover effects remain inside the carousel's scrollable area.
      setStagger(leadingHeight);
      let offscreenLeading = 0;
      if (leadingHeight > 0 && sticky.offsetHeight > window.innerHeight - contentPinTop - 16) {
        // On shorter phones the calendar can scroll above the viewport before
        // pinning. Keep the buttons/cards visible instead of disabling Gym's
        // vertical-to-horizontal scrolling because the calendar does not fit.
        offscreenLeading = leadingHeight;
        setStagger(0);
      }
      pinTop = contentPinTop - offscreenLeading;
      // Keep native horizontal navigation if pinning would hide part of a card,
      // or if the visitor prefers reduced motion.
      pinned = distance > 1 && !reducedMotion.matches
        && sticky.offsetHeight - offscreenLeading <= window.innerHeight - contentPinTop - 16;
      sticky.style.setProperty('--run-pin-top', `${pinTop}px`);
      sticky.dataset.pinned = String(pinned);
      scrollers.forEach(row => { row.dataset.pinned = String(pinned); });
      // The calendar remains still throughout horizontal travel, either
      // visible on tall screens or above the viewport on shorter phones.
      const trackHeight = sticky.offsetHeight + distance;
      track.style.height = pinned ? `${trackHeight}px` : '';
      // Near the page bottom, reserve enough scroll distance to reach the
      // final card even without a content footer after the carousel.
      const endAllowance = pinned
        ? Math.max(0, Math.ceil(start() + distance - (document.documentElement.scrollHeight - window.innerHeight))) : 0;
      if (endAllowance > 0) track.style.height = `${trackHeight + endAllowance}px`;
      // The background's artwork should cover the visible section, excluding
      // the extra page height that supplies horizontal scroll distance.
      section?.style.setProperty('--run-scroll-distance', `${pinned ? distance + endAllowance : 0}px`);
      if (section) {
        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        // Native sticky positioning holds the artwork at its entry position
        // for exactly the carousel's extra scroll distance, without frame-by-
        // frame JavaScript counter-translations that can lag behind scrolling.
        section.style.setProperty('--run-background-top', `${pinned ? sectionTop - start() : 0}px`);
      }
      if (pendingProgress !== null) {
        if (pinned) window.scrollTo({ top: start() + pendingProgress * distance, behavior: 'instant' });
        pendingProgress = null;
      }
    }
    const progress = pinned ? clamp(window.scrollY - start(), distance) : 0;
    if (pinned) {
      // The page supplies the scroll distance; no wheel/touch event is blocked.
      drivenScrollLeft = progress;
      scrollers.forEach(row => {
        const rowDistance = Math.max(0, row.scrollWidth - row.clientWidth);
        row.scrollLeft = distance > 0 ? progress / distance * rowDistance : 0;
      });
    }
  };

  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(render);
  };

  const measure = () => {
    needsMeasure = true;
    schedule();
  };

  const onHorizontalScroll = (event: Event) => {
    if (event.currentTarget !== scroller) return;
    if (!pinned) return;
    // Scroll events are asynchronous. An event from our last render may arrive
    // after a smooth page scroll has advanced; it must not cancel that scroll.
    if (Math.abs(scroller.scrollLeft - drivenScrollLeft) <= 1) return;
    const expected = clamp(window.scrollY - start(), distance);
    // Swiping, horizontal trackpad gestures and keyboard focus can also move the
    // cards. Keep the page's progress aligned so the next vertical scroll holds.
    if (Math.abs(scroller.scrollLeft - expected) > 1) {
      window.scrollTo({ top: start() + scroller.scrollLeft, behavior: 'instant' });
    }
  };

  const onHobbyChange = (event: Event) => {
    const { hobby, progress } = (event as CustomEvent<HobbyChangeDetail>).detail;
    const next = section?.querySelector<HTMLElement>(`[data-hobby-panel="${hobby}"] [data-run-scroller]`);
    if (!next) return;
    // Preserve the visitor's place if switching midway through pinned travel.
    if (pinned && window.scrollY >= start() && window.scrollY <= start() + distance) pendingProgress = progress;
    scroller = next;
    measure();
  };

  scrollers.forEach(row => row.addEventListener('scroll', onHorizontalScroll, { passive: true }));
  section?.addEventListener('hobby:change', onHobbyChange);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  reducedMotion.addEventListener('change', measure);
  const observer = new ResizeObserver(measure);
  observer.observe(sticky);
  scrollers.forEach(row => observer.observe(row));
  if (header) observer.observe(header);
  if (leading) observer.observe(leading);
  render();

  document.addEventListener('astro:before-swap', () => {
    observer.disconnect();
    scrollers.forEach(row => row.removeEventListener('scroll', onHorizontalScroll));
    section?.removeEventListener('hobby:change', onHobbyChange);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', measure);
    reducedMotion.removeEventListener('change', measure);
    window.cancelAnimationFrame(frame);
    section?.style.removeProperty('--run-scroll-distance');
    section?.style.removeProperty('--run-background-top');
  }, { once: true });
}

