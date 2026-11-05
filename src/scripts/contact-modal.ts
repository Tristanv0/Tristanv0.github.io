import { validateContactFiles } from '../data/contact';

interface MessageDraft { name: string; email: string; subject: string; message: string; files: File[] }
type Phase = 'editing' | 'sending' | 'transitioning' | 'success';
class DeliveryError extends Error {}

export function initContactModal() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-contact-dialog]');
  const confirm = document.querySelector<HTMLDialogElement>('[data-contact-confirm]');
  if (!dialog || !confirm) return;
  const stage = dialog.querySelector<HTMLElement>('[data-contact-stage]')!;
  const form = dialog.querySelector<HTMLFormElement>('[data-contact-form]')!;
  const compose = dialog.querySelector<HTMLElement>('[data-contact-compose]')!;
  const success = dialog.querySelector<HTMLElement>('[data-contact-success]')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-contact-close]')!;
  const sendButton = dialog.querySelector<HTMLButtonElement>('[data-contact-send]')!;
  const attachButton = dialog.querySelector<HTMLButtonElement>('[data-contact-attach]')!;
  const fileInput = dialog.querySelector<HTMLInputElement>('[data-contact-file-input]')!;
  const filesList = dialog.querySelector<HTMLElement>('[data-contact-files]')!;
  const error = dialog.querySelector<HTMLElement>('[data-contact-error]')!;
  const fileError = dialog.querySelector<HTMLElement>('[data-contact-file-error]')!;
  const draftNote = dialog.querySelector<HTMLElement>('[data-contact-draft-note]')!;
  const fields = ['name', 'email', 'subject', 'message'] as const;
  const controls = fields.map(name => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let draft: MessageDraft | null = null;
  let files: File[] = [];
  let baseline = '';
  let phase: Phase = 'editing';
  let opener: HTMLElement | null = null;
  let previousFocus: HTMLElement | null = null;
  let previousOverflow = '';
  let previousPadding = '';
  let disposed = false;
  let modalActive = false;
  let lastField: HTMLElement | null = null;
  let request: AbortController | null = null;
  const animations = new Set<Animation>();

  function snapshot(): MessageDraft {
    return { name: controls[0].value, email: controls[1].value, subject: controls[2].value, message: controls[3].value, files: [...files] };
  }
  function fingerprint(value: MessageDraft) {
    return JSON.stringify({ ...value, files: value.files.map(file => [file.name, file.size, file.lastModified]) });
  }
  function hasContent() { return controls.some(control => control.value.length > 0) || files.length > 0; }
  function showError(element: HTMLElement, message: string | null) {
    element.textContent = message ?? '';
    element.hidden = !message;
  }
  function renderFiles() {
    filesList.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement('li'); row.className = 'contact-file-row';
      const name = document.createElement('span'); name.className = 'contact-file-name'; name.textContent = file.name;
      const size = document.createElement('span'); size.className = 'contact-file-size';
      size.textContent = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(file.size / 1024))} KB`;
      const remove = document.createElement('button'); remove.type = 'button';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      cross.setAttribute('d', 'm6 6 12 12M18 6 6 18'); icon.append(cross); remove.append(icon);
      remove.dataset.removeAttachment = String(index); remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.disabled = phase !== 'editing'; row.append(name, size, remove); filesList.append(row);
    });
  }
  function setBusy(busy: boolean) {
    form.setAttribute('aria-busy', String(busy));
    controls.forEach(control => { control.readOnly = busy; });
    closeButton.disabled = sendButton.disabled = attachButton.disabled = fileInput.disabled = busy;
    sendButton.textContent = busy ? 'Sending…' : 'Send message';
    renderFiles();
  }
  function resetStage() {
    animations.forEach(animation => animation.cancel()); animations.clear();
    stage.style.cssText = '';
    success.hidden = true; compose.hidden = false;
    dialog.setAttribute('aria-labelledby', 'contact-title');
    phase = 'editing'; setBusy(false);
  }
  function returnFocus() {
    if (opener?.closest('[inert]')) document.querySelector<HTMLButtonElement>('[data-nav-toggle]')?.focus({ preventScroll: true });
    else opener?.focus({ preventScroll: true });
  }
  function finishClose() {
    if (!modalActive) return;
    modalActive = false;
    if (confirm!.open) confirm!.close();
    if (dialog!.open) dialog!.close();
    document.documentElement.style.overflow = previousOverflow;
    document.documentElement.style.paddingRight = previousPadding;
    opener?.setAttribute('aria-expanded', 'false');
    resetStage(); form.reset(); files = []; renderFiles();
    showError(error, null); showError(fileError, null);
    returnFocus();
  }
  function open(button: HTMLElement) {
    if (dialog!.open || document.querySelector('dialog[open]')) return;
    opener = button;
    resetStage(); form.reset(); files = [...(draft?.files ?? [])];
    controls.forEach(control => control.setCustomValidity(''));
    if (draft) fields.forEach((name, index) => { controls[index].value = draft![name]; });
    baseline = fingerprint(snapshot());
    draftNote.hidden = !draft; renderFiles();
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    previousOverflow = root.style.overflow; previousPadding = root.style.paddingRight;
    root.style.overflow = 'hidden';
    if (scrollbar > 0) root.style.paddingRight = `${parseFloat(getComputedStyle(root).paddingRight) + scrollbar}px`;
    dialog!.showModal(); button.setAttribute('aria-expanded', 'true');
    modalActive = true;
    controls[0].focus({ preventScroll: true }); stage.scrollTop = 0;
    if (!reducedMotion.matches) {
      const animation = stage.animate([{ transform: 'translateY(16px) scale(.98)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
      animations.add(animation);
    }
  }
  function requestClose() {
    if (phase === 'sending' || phase === 'transitioning' || confirm!.open) return;
    if (phase === 'success') { finishClose(); return; }
    if (!hasContent()) { draft = null; finishClose(); return; }
    if (fingerprint(snapshot()) === baseline) { finishClose(); return; }
    previousFocus = controls.includes(document.activeElement as HTMLInputElement) ? document.activeElement as HTMLElement : lastField;
    confirm!.showModal();
  }
  function continueWriting() {
    confirm!.close();
    if (previousFocus && dialog!.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    else controls[0].focus({ preventScroll: true });
  }
  async function animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    if (disposed || reducedMotion.matches) return;
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
    animations.add(animation);
    await Promise.allSettled([animation.finished]);
  }
  async function showSuccess() {
    phase = 'transitioning';
    const from = stage.getBoundingClientRect();
    const targetWidth = Math.min(420, from.width);
    // Measure the compact view synchronously, before the browser paints.
    compose.hidden = true; success.hidden = false;
    stage.style.width = `${targetWidth}px`;
    const targetHeight = stage.getBoundingClientRect().height;
    compose.hidden = false; success.hidden = true;
    stage.style.width = `${from.width}px`; stage.style.height = `${from.height}px`;
    stage.style.overflow = 'hidden';
    if (!reducedMotion.matches) {
      await animate(stage, [{ clipPath: 'inset(0% 0% round 24px)' }, { clipPath: 'inset(49.6% 0% round 2px)' }], 440);
      if (disposed) return;
      stage.style.clipPath = 'inset(49.6% 0% round 2px)';
    }
    animations.forEach(animation => animation.cancel()); animations.clear();
    compose.hidden = true; success.hidden = false;
    stage.style.height = `${targetHeight}px`;
    if (!reducedMotion.matches) {
      await animate(stage, [{ width: `${from.width}px` }, { width: `${targetWidth}px` }], 180);
      if (disposed) return;
    }
    stage.style.width = `${targetWidth}px`;
    animations.forEach(animation => animation.cancel()); animations.clear();
    if (!reducedMotion.matches) {
      await animate(stage, [{ clipPath: 'inset(49.6% 0% round 2px)' }, { clipPath: 'inset(0% 0% round 24px)' }], 420);
      if (disposed) return;
    }
    animations.forEach(animation => animation.cancel()); animations.clear();
    stage.style.clipPath = ''; stage.style.height = ''; stage.style.overflow = '';
    phase = 'success'; closeButton.disabled = false;
    dialog!.setAttribute('aria-labelledby', 'contact-success-title');
    success.querySelector<HTMLElement>('h2')!.focus({ preventScroll: true });
    stage.scrollTop = 0;
  }
  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (phase !== 'editing' || confirm!.open) return;
    for (const index of [0, 3]) {
      if (!controls[index].value.trim()) { controls[index].setCustomValidity(index === 0 ? 'Please enter your name.' : 'Please enter a message.'); form.reportValidity(); return; }
    }
    const invalidFiles = validateContactFiles(files);
    showError(fileError, invalidFiles);
    if (invalidFiles) { attachButton.focus(); return; }
    showError(error, null);
    const endpoint = dialog!.dataset.contactEndpoint;
    if (!endpoint) { showError(error, 'Sending is temporarily unavailable. Please try again later.'); return; }
    phase = 'sending'; setBusy(true);
    const body = new FormData();
    controls.forEach((control, index) => body.append(fields[index], control.value.trim()));
    body.append('website', (form.elements.namedItem('website') as HTMLInputElement).value);
    files.forEach(file => body.append('attachments', file, file.name));
    request = new AbortController();
    const timeout = window.setTimeout(() => request?.abort(), 20_000);
    try {
      const response = await fetch(endpoint, { method: 'POST', body, signal: request.signal, credentials: 'omit' });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        throw new DeliveryError(response.status === 429 ? 'Please wait a minute before sending another message.' : response.status === 413 ? 'The attachments are too large. Please choose smaller files.' : 'Your message couldn’t be sent. Please try again in a moment.');
      }
      if (disposed || !modalActive) return;
      draft = null;
      await showSuccess();
      files = []; form.reset(); renderFiles();
    } catch (reason) {
      if (disposed || !modalActive) return;
      phase = 'editing'; setBusy(false);
      showError(error, reason instanceof DeliveryError ? reason.message : 'I couldn’t confirm delivery. Your message is still here—please try again.');
    } finally { clearTimeout(timeout); request = null; }
  }
  function onInput() { controls.forEach(control => control.setCustomValidity('')); draftNote.hidden = true; }
  function onFieldFocus(event: FocusEvent) { if (event.target instanceof HTMLElement && controls.includes(event.target as HTMLInputElement)) lastField = event.target; }
  function onNativeClose() {
    if (!modalActive || dialog!.open) return;
    if (phase === 'editing' && hasContent()) draft = snapshot();
    finishClose();
  }
  function onFileChange() {
    const selected = [...(fileInput.files ?? [])];
    const combined = [...files, ...selected.filter(file => !files.some(previous => previous.name === file.name && previous.size === file.size && previous.lastModified === file.lastModified))];
    const message = validateContactFiles(combined);
    showError(fileError, message);
    if (!message) { files = combined; renderFiles(); draftNote.hidden = true; }
    fileInput.value = '';
  }
  function onFilesClick(event: MouseEvent) {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-remove-attachment]') : null;
    if (!button || phase !== 'editing') return;
    files.splice(Number(button.dataset.removeAttachment), 1); renderFiles(); showError(fileError, null); attachButton.focus();
  }
  function onOpen(event: MouseEvent) {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-contact-open]') : null;
    if (button) open(button);
  }
  function onCancel(event: Event) { event.preventDefault(); requestClose(); }
  function onConfirmCancel(event: Event) { event.preventDefault(); continueWriting(); }
  let backdropPressed = false;
  function onPointerDown(event: PointerEvent) { backdropPressed = event.target === dialog; }
  function onBackdropClick(event: MouseEvent) {
    if (backdropPressed && event.target === dialog) requestClose();
    backdropPressed = false;
  }
  function onConfirmClick(event: MouseEvent) {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button?.hasAttribute('data-contact-save')) { draft = snapshot(); confirm!.close(); finishClose(); }
    else if (button?.hasAttribute('data-contact-discard')) { draft = null; confirm!.close(); finishClose(); }
    else if (button?.hasAttribute('data-contact-continue')) continueWriting();
  }
  function trapFocus(event: KeyboardEvent) {
    const current = event.currentTarget as HTMLDialogElement;
    if (event.key !== 'Tab' || current !== (confirm!.open ? confirm : dialog)) return;
    const focusable = [...current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), textarea, [tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[inert]'));
    const target = event.shiftKey ? focusable.at(-1) : focusable[0];
    if (target && (event.shiftKey ? document.activeElement === focusable[0] : document.activeElement === focusable.at(-1) || document.activeElement === success.querySelector('h2'))) { event.preventDefault(); target.focus(); }
  }
  function onMotionChange() { if (reducedMotion.matches) animations.forEach(animation => { if (animation.playState !== 'finished') animation.finish(); }); }
  const onAttach = () => fileInput.click();
  const done = dialog.querySelector<HTMLButtonElement>('[data-contact-done]')!;
  document.querySelectorAll<HTMLButtonElement>('[data-contact-open]').forEach(button => { button.disabled = false; });
  document.addEventListener('click', onOpen);
  closeButton.addEventListener('click', requestClose); done.addEventListener('click', requestClose);
  form.addEventListener('submit', onSubmit); form.addEventListener('input', onInput); form.addEventListener('focusin', onFieldFocus);
  attachButton.addEventListener('click', onAttach); fileInput.addEventListener('change', onFileChange); filesList.addEventListener('click', onFilesClick);
  dialog.addEventListener('cancel', onCancel); dialog.addEventListener('close', onNativeClose); dialog.addEventListener('pointerdown', onPointerDown); dialog.addEventListener('click', onBackdropClick);
  confirm.addEventListener('cancel', onConfirmCancel); confirm.addEventListener('click', onConfirmClick);
  dialog.addEventListener('keydown', trapFocus); confirm.addEventListener('keydown', trapFocus);
  reducedMotion.addEventListener('change', onMotionChange);
  document.addEventListener('astro:before-swap', () => {
    disposed = true; request?.abort(); draft = null;
    if (dialog!.open) finishClose();
    document.removeEventListener('click', onOpen);
    closeButton.removeEventListener('click', requestClose); done.removeEventListener('click', requestClose);
    form.removeEventListener('submit', onSubmit); form.removeEventListener('input', onInput); form.removeEventListener('focusin', onFieldFocus);
    attachButton.removeEventListener('click', onAttach); fileInput.removeEventListener('change', onFileChange); filesList.removeEventListener('click', onFilesClick);
    dialog!.removeEventListener('cancel', onCancel); dialog!.removeEventListener('close', onNativeClose); dialog!.removeEventListener('pointerdown', onPointerDown); dialog!.removeEventListener('click', onBackdropClick);
    confirm!.removeEventListener('cancel', onConfirmCancel); confirm!.removeEventListener('click', onConfirmClick);
    dialog!.removeEventListener('keydown', trapFocus); confirm!.removeEventListener('keydown', trapFocus);
    reducedMotion.removeEventListener('change', onMotionChange);
  }, { once: true });
}
