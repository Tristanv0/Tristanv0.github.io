export interface HobbyChangeDetail {
  hobby: string;
  color: string;
  progress: number;
  finished?: Promise<void>;
}

function setDecorationVisible(decoration: HTMLElement, visible: boolean) {
  decoration.classList.toggle('invisible', !visible);
  if (decoration.hasAttribute('data-hobby-accessible')) {
    decoration.inert = !visible;
    decoration.setAttribute('aria-hidden', String(!visible));
  }
}

export function applyHobbyTheme(section: HTMLElement, hobby: string, color: string) {
  section.style.setProperty('--hobby-color', color);
  section.querySelectorAll<HTMLElement>('[data-hobby-decoration]').forEach(decoration => {
    setDecorationVisible(decoration, decoration.dataset.hobbyDecoration === hobby);
  });
  section.dispatchEvent(new CustomEvent('hobby:theme', { detail: { hobby } }));
}

export function initHobbyTabs() {
  const section = document.querySelector<HTMLElement>('[data-hobbies]');
  if (!section) return;
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-hobby-tab]'));
  const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-hobby-panel]'));
  const status = section.querySelector<HTMLElement>('[data-hobby-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.hobbyTab;
  let requested = active;
  let switching = false;
  let disposed = false;
  let animations: Animation[] = [];

  async function select(hobby: string) {
    requested = hobby;
    if (switching || hobby === active || disposed) return;
    const outgoing = panels.find(panel => panel.dataset.hobbyPanel === active);
    const incoming = panels.find(panel => panel.dataset.hobbyPanel === hobby);
    if (!outgoing || !incoming) return;
    switching = true;
    const previousScroller = outgoing.querySelector<HTMLElement>('[data-run-scroller]');
    const nextScroller = incoming.querySelector<HTMLElement>('[data-run-scroller]');
    const previousDistance = previousScroller ? previousScroller.scrollWidth - previousScroller.clientWidth : 0;
    const progress = previousScroller && previousDistance > 0 ? previousScroller.scrollLeft / previousDistance : 0;
    if (nextScroller) nextScroller.scrollLeft = progress * Math.max(0, nextScroller.scrollWidth - nextScroller.clientWidth);
    active = hobby;
    tabs.forEach(tab => {
      const selected = tab.dataset.hobbyTab === hobby;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    // Both panels retain layout space, keeping the pinned frame the same height.
    outgoing.inert = incoming.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    incoming.setAttribute('aria-hidden', 'false');
    incoming.classList.remove('invisible');
    section.querySelectorAll<HTMLElement>('[data-hobby-decoration]').forEach(decoration => {
      // Hide the old ornament immediately; reveal the new one with its theme.
      if (decoration.dataset.hobbyDecoration !== hobby) setDecorationVisible(decoration, false);
    });

    const detail: HobbyChangeDetail = { hobby, color: hobby === 'gym' ? '#1E6FFF' : '#FC4C02', progress };
    // The background supplies its completion promise so rapid clicks can queue
    // the latest choice without overlapping arrow colors or card transitions.
    section.dispatchEvent(new CustomEvent('hobby:change', { detail }));
    if (!detail.finished) applyHobbyTheme(section, hobby, detail.color);
    if (!reducedMotion.matches && typeof incoming.animate === 'function') {
      const timing = { duration: 720, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' as const };
      animations = [
        outgoing.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-105%)' }], timing),
        incoming.animate([{ transform: 'translateX(105%)' }, { transform: 'translateX(0)' }], timing),
      ];
    }
    const cardsEntered = Promise.allSettled(animations.map(animation => animation.finished));
    void cardsEntered.then(() => {
      if (!disposed) {
        section.dispatchEvent(new CustomEvent('hobby:cards-entered', { detail: { hobby } }));
      }
    });
    await Promise.allSettled([
      cardsEntered,
      ...(detail.finished ? [detail.finished] : []),
    ]);
    if (disposed) return;
    outgoing.classList.add('invisible');
    animations.forEach(animation => animation.cancel());
    animations = [];
    incoming.inert = false;
    if (status) status.textContent = hobby === 'gym' ? 'Gym: latest workouts.' : 'Running: latest runs.';
    switching = false;
    if (requested && requested !== active) void select(requested);
  }

  const onClick = (event: Event) => {
    const hobby = (event.currentTarget as HTMLButtonElement).dataset.hobbyTab;
    if (hobby) void select(hobby);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const current = tabs.indexOf(event.currentTarget as HTMLButtonElement);
    let index: number;
    if (event.key === 'ArrowRight') index = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[index].focus({ preventScroll: true });
    void select(tabs[index].dataset.hobbyTab!);
  };
  const onMotionChange = () => {
    if (reducedMotion.matches) animations.forEach(animation => animation.finish());
  };
  tabs.forEach(tab => {
    tab.disabled = false;
    tab.addEventListener('click', onClick);
    tab.addEventListener('keydown', onKeyDown);
  });
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('astro:before-swap', () => {
    disposed = true;
    animations.forEach(animation => animation.cancel());
    tabs.forEach(tab => {
      tab.removeEventListener('click', onClick);
      tab.removeEventListener('keydown', onKeyDown);
    });
    reducedMotion.removeEventListener('change', onMotionChange);
  }, { once: true });
}
