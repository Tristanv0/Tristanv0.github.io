interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Keep the flying card's proportions while moving its center to the dialog.
export function getCardZoom(from: Box, to: Box) {
  if (from.width <= 0 || from.height <= 0) return { x: 0, y: 0, scale: 1 };
  const scale = Math.min(to.width / from.width, to.height / from.height, 1.5);
  return {
    x: to.left + (to.width - from.width * scale) / 2 - from.left,
    y: to.top + (to.height - from.height * scale) / 2 - from.top,
    scale,
  };
}

interface ModalState {
  dialog: HTMLDialogElement;
  panel: HTMLElement;
  opener: HTMLButtonElement;
  ghost: HTMLButtonElement | null;
  animations: Animation[];
  opening: boolean;
  closing: boolean;
  previousVisibility: string;
  previousOverflow: string;
  previousPadding: string;
}

export function initRunModals() {
  const cards = document.querySelectorAll<HTMLButtonElement>('[data-run-card][data-run-modal]');
  if (cards.length === 0) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active: ModalState | null = null;

  function ghostFor(card: HTMLButtonElement, box: Box, dialog: HTMLDialogElement) {
    const ghost = card.cloneNode(true) as HTMLButtonElement;
    ghost.removeAttribute('id');
    ghost.removeAttribute('data-run-card');
    ghost.removeAttribute('data-run-modal');
    ghost.removeAttribute('aria-controls');
    ghost.removeAttribute('aria-haspopup');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.disabled = true;
    Object.assign(ghost.style, {
      position: 'fixed', left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`,
      maxWidth: 'none', maxHeight: 'none', margin: '0',
      zIndex: '50', pointerEvents: 'none', visibility: 'visible',
      transformOrigin: 'top left', transform: 'none', rotate: 'none',
      translate: 'none', transition: 'none', overflow: 'hidden',
    });
    dialog.append(ghost);
    return ghost;
  }

  function finish(state: ModalState) {
    if (active !== state) return;
    active = null;
    state.animations.forEach(animation => animation.cancel());
    state.ghost?.remove();
    state.panel.style.opacity = '';
    state.opener.style.visibility = state.previousVisibility;
    state.opener.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = state.previousOverflow;
    document.documentElement.style.paddingRight = state.previousPadding;
    if (state.dialog.open) state.dialog.close();
    state.opener.focus({ preventScroll: true });
  }

  async function open(card: HTMLButtonElement) {
    if (active) return;
    const dialog = document.getElementById(card.dataset.runModal ?? '');
    if (!(dialog instanceof HTMLDialogElement)) return;
    const panel = dialog.querySelector<HTMLElement>('[data-run-panel]');
    if (!panel) return;

    const root = document.documentElement;
    const source = card.getBoundingClientRect();
    const scrollbar = window.innerWidth - root.clientWidth;
    const state: ModalState = {
      dialog, panel, opener: card, ghost: null, animations: [], opening: true, closing: false,
      previousVisibility: card.style.visibility,
      previousOverflow: root.style.overflow,
      previousPadding: root.style.paddingRight,
    };
    active = state;
    root.style.overflow = 'hidden';
    if (scrollbar > 0) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + scrollbar}px`;
    panel.style.opacity = '0';
    panel.scrollTop = 0;
    dialog.showModal();
    card.setAttribute('aria-expanded', 'true');
    card.style.visibility = 'hidden';

    if (reducedMotion.matches || typeof panel.animate !== 'function') {
      panel.style.opacity = '';
      state.opening = false;
      return;
    }

    const target = panel.getBoundingClientRect();
    const zoom = getCardZoom(source, target);
    const destination = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
    const ghost = ghostFor(card, source, dialog);
    state.ghost = ghost;
    // Finish the card's travel and fade before revealing the larger dialog.
    // A shared easing curve previously brought the panel in during the travel.
    state.animations = [
      ghost.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        { transform: destination, opacity: 1, offset: 480 / 580 },
        { transform: destination, opacity: 0 },
      ], { duration: 580, fill: 'forwards' }),
    ];

    await Promise.allSettled(state.animations.map(animation => animation.finished));
    if (active !== state || state.closing) return;
    ghost.remove();
    state.ghost = null;
    state.animations.forEach(animation => animation.cancel());
    state.animations = [];

    if (!reducedMotion.matches) {
      state.animations = [panel.animate([
        { transform: 'scale(0.96)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' })];
      await Promise.allSettled(state.animations.map(animation => animation.finished));
      if (active !== state || state.closing) return;
    }

    panel.style.opacity = '';
    state.animations.forEach(animation => animation.cancel());
    state.animations = [];
    state.opening = false;
  }

  async function close() {
    const state = active;
    if (!state || state.closing) return;
    state.closing = true;
    if (state.opening || reducedMotion.matches || typeof state.panel.animate !== 'function') {
      finish(state);
      return;
    }

    const source = state.opener.getBoundingClientRect();
    const zoom = getCardZoom(source, state.panel.getBoundingClientRect());
    const origin = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
    const ghost = ghostFor(state.opener, source, state.dialog);
    state.ghost = ghost;
    const timing = { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' as const };
    state.animations = [
      ghost.animate([
        { transform: origin, opacity: 0 },
        { transform: origin, opacity: 1, offset: 0.2 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ], timing),
      state.panel.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.94)', opacity: 0 }], timing),
    ];
    await Promise.allSettled(state.animations.map(animation => animation.finished));
    finish(state);
  }

  cards.forEach(card => card.addEventListener('click', () => { void open(card); }));
  document.querySelectorAll<HTMLDialogElement>('[data-run-dialog]').forEach(dialog => {
    let backdropPressed = false;
    dialog.querySelector<HTMLButtonElement>('[data-run-close]')?.addEventListener('click', () => { void close(); });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      void close();
    });
    dialog.addEventListener('pointerdown', event => { backdropPressed = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (backdropPressed && event.target === dialog) void close();
      backdropPressed = false;
    });
    dialog.addEventListener('close', () => {
      if (active?.dialog === dialog) finish(active);
    });
  });

  const onMotionChange = () => {
    if (reducedMotion.matches) active?.animations.forEach(animation => animation.finish());
  };
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('astro:before-swap', () => {
    if (active) finish(active);
    reducedMotion.removeEventListener('change', onMotionChange);
  }, { once: true });
}
