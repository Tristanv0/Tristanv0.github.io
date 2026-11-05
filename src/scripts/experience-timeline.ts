export function initExperienceTimeline() {
  const timeline = document.querySelector<HTMLElement>('[data-experience-timeline]');
  if (!timeline) return;
  const rows = [...timeline.querySelectorAll<HTMLElement>('[data-timeline-row]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set<HTMLElement>();
  let observer: IntersectionObserver | null = null;

  function revealImmediately(row: HTMLElement) {
    observer?.unobserve(row);
    row.removeAttribute('data-entry-reveal');
    row.dataset.entryViewed = 'true';
    pending.delete(row);
    if (!pending.size) observer?.disconnect();
  }
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const row = entry.target as HTMLElement;
        if (!entry.isIntersecting || !pending.has(row)) return;
        observer!.unobserve(row);
        row.dataset.entryReveal = 'entering';
      });
    }, { threshold: .2, rootMargin: '0px 0px -28px 0px' });
    rows.forEach(row => {
      pending.add(row);
      row.dataset.entryReveal = 'pending';
      observer!.observe(row);
    });
  }
  function onAnimationEnd(event: AnimationEvent) {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-experience-open]')) return;
    const row = event.target.closest<HTMLElement>('[data-timeline-row]');
    if (row) revealImmediately(row);
  }
  function onFocus(event: FocusEvent) {
    if (!(event.target instanceof Element)) return;
    const row = event.target.closest<HTMLElement>('[data-timeline-row]');
    if (row && pending.has(row)) revealImmediately(row);
  }

  type ModalState = {
    dialog: HTMLDialogElement;
    panel: HTMLElement;
    opener: HTMLButtonElement;
    previousOverflow: string;
    previousPadding: string;
    animations: Animation[];
    closing: boolean;
  };
  let active: ModalState | null = null;
  function finish(state: ModalState) {
    if (active !== state) return;
    active = null;
    state.animations.forEach(animation => animation.cancel());
    document.documentElement.style.overflow = state.previousOverflow;
    document.documentElement.style.paddingRight = state.previousPadding;
    state.opener.setAttribute('aria-expanded', 'false');
    if (state.dialog.open) state.dialog.close();
    state.opener.focus({ preventScroll: true });
  }
  function open(opener: HTMLButtonElement) {
    if (active) return;
    const dialog = document.getElementById(opener.getAttribute('aria-controls') ?? '');
    if (!(dialog instanceof HTMLDialogElement)) return;
    const panel = dialog.querySelector<HTMLElement>('[data-experience-panel]');
    if (!panel) return;
    const row = opener.closest<HTMLElement>('[data-timeline-row]');
    if (row) revealImmediately(row);
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const state: ModalState = {
      dialog, panel, opener, previousOverflow: root.style.overflow,
      previousPadding: root.style.paddingRight, animations: [], closing: false,
    };
    active = state;
    root.style.overflow = 'hidden';
    if (scrollbar > 0) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + scrollbar}px`;
    panel.scrollTop = 0;
    dialog.showModal();
    opener.setAttribute('aria-expanded', 'true');
    if (!reducedMotion.matches) {
      const animation = panel.animate([
        { transform: 'translateY(20px) scale(.97)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
      state.animations.push(animation);
    }
  }
  async function close() {
    const state = active;
    if (!state || state.closing) return;
    state.closing = true;
    const opacity = getComputedStyle(state.panel).opacity;
    const transform = getComputedStyle(state.panel).transform;
    state.animations.forEach(animation => animation.cancel());
    if (!reducedMotion.matches) {
      const animation = state.panel.animate([
        { opacity, transform },
        { opacity: 0, transform: 'translateY(12px) scale(.98)' },
      ], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      state.animations = [animation];
      await Promise.allSettled([animation.finished]);
    }
    finish(state);
  }
  function onClick(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const opener = event.target.closest<HTMLButtonElement>('[data-experience-open]');
    if (opener) { open(opener); return; }
    if (event.target.closest('[data-experience-close]')) void close();
  }
  function onCancel(event: Event) { event.preventDefault(); void close(); }
  function onNativeClose(event: Event) { if (active?.dialog === event.target) finish(active); }
  function onDialogKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !active || event.currentTarget !== active.dialog) return;
    const controls = [...active.dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || !active.dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !active.dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }
  let backdropPressed = false;
  function onPointerDown(event: PointerEvent) { backdropPressed = event.target === active?.dialog; }
  function onBackdropClick(event: MouseEvent) {
    if (backdropPressed && event.target === active?.dialog) void close();
    backdropPressed = false;
  }
  const dialogs = [...timeline.querySelectorAll<HTMLDialogElement>('[data-experience-dialog]')];
  dialogs.forEach(dialog => {
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onNativeClose);
    dialog.addEventListener('keydown', onDialogKeydown);
    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('click', onBackdropClick);
  });
  function onMotionChange() {
    if (!reducedMotion.matches) return;
    [...pending].forEach(revealImmediately);
    active?.animations.forEach(animation => { if (animation.playState !== 'finished') animation.finish(); });
  }
  timeline.addEventListener('animationend', onAnimationEnd);
  timeline.addEventListener('focusin', onFocus);
  timeline.addEventListener('click', onClick);
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('astro:before-swap', () => {
    observer?.disconnect();
    if (active) finish(active);
    timeline.removeEventListener('animationend', onAnimationEnd);
    timeline.removeEventListener('focusin', onFocus);
    timeline.removeEventListener('click', onClick);
    reducedMotion.removeEventListener('change', onMotionChange);
    dialogs.forEach(dialog => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onNativeClose);
      dialog.removeEventListener('keydown', onDialogKeydown);
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('click', onBackdropClick);
    });
  }, { once: true });
}
