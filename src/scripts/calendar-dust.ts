// Snapshot the calendar's current DOM geometry once per transition. Text,
// attendance circles and weekday dividers share the same canvas dust reveal
// as the other Gym artwork, while the accessible HTML stays intact afterward.
export function captureCalendar(calendar: HTMLElement, ratio: number) {
  const content = calendar.querySelector<HTMLElement>('[data-calendar-content]')!;
  const bounds = content.getBoundingClientRect();
  const image = document.createElement('canvas');
  image.width = Math.ceil(bounds.width * ratio);
  image.height = Math.ceil(bounds.height * ratio);
  const context = image.getContext('2d', { willReadFrequently: true })!;
  context.scale(ratio, ratio);

  function text(element: HTMLElement, clip?: HTMLElement) {
    context.save();
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const value = element.textContent?.trim() ?? '';
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    context.fillStyle = style.color;
    if (clip) {
      const area = clip.getBoundingClientRect();
      const x = area.left - bounds.left;
      context.beginPath();
      context.rect(x, area.top - bounds.top, area.width, area.height);
      context.clip();
      if (getComputedStyle(clip).maskImage !== 'none') {
        const fade = context.createLinearGradient(x, 0, x + area.width, 0);
        fade.addColorStop(0, 'transparent');
        fade.addColorStop(0.2, style.color);
        fade.addColorStop(0.8, style.color);
        fade.addColorStop(1, 'transparent');
        context.fillStyle = fade;
      }
    }
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const metrics = context.measureText(value);
    const baseline = rect.top - bounds.top + rect.height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    context.fillText(value, rect.left - bounds.left + rect.width / 2, baseline);
    context.restore();
  }

  calendar.querySelectorAll<HTMLElement>('[data-calendar-month], th abbr').forEach(element => text(element));
  calendar.querySelectorAll<HTMLElement>('th').forEach(cell => {
    const rect = cell.getBoundingClientRect();
    const style = getComputedStyle(cell);
    const border = parseFloat(style.borderBottomWidth);
    if (border) {
      context.fillStyle = style.borderBottomColor;
      context.fillRect(rect.left - bounds.left, rect.bottom - bounds.top - border, rect.width, border);
    }
  });

  calendar.querySelectorAll<HTMLElement>('[data-calendar-workout-title]').forEach(label => {
    const value = label.firstElementChild as HTMLElement | null;
    if (value) text(value, label);
  });
  calendar.querySelectorAll<HTMLElement>('[data-calendar-day]').forEach(day => {
    const layers = day.querySelectorAll<HTMLElement>('[data-calendar-back-circle], [data-calendar-front-circle]');
    // Hover playback is reset before capture, so the cached image always
    // matches the resting stack rather than an in-between orbit frame.
    const circles = layers.length ? [...layers] : [day];
    circles.forEach(circle => {
      const rect = circle.getBoundingClientRect();
      const style = getComputedStyle(circle);
      if (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent') return;
      context.fillStyle = style.backgroundColor;
      context.beginPath();
      context.arc(rect.left - bounds.left + rect.width / 2, rect.top - bounds.top + rect.height / 2, Math.min(rect.width, rect.height) / 2, 0, Math.PI * 2);
      context.fill();
      const border = parseFloat(style.borderTopWidth);
      if (border) {
        context.strokeStyle = style.borderTopColor;
        context.lineWidth = border;
        context.beginPath();
        context.arc(rect.left - bounds.left + rect.width / 2, rect.top - bounds.top + rect.height / 2, (Math.min(rect.width, rect.height) - border) / 2, 0, Math.PI * 2);
        context.stroke();
      }
    });
    const date = day.querySelector<HTMLElement>('time');
    if (date) text(date);
  });

  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  const samples: { x: number; y: number; color: string }[] = [];
  const step = Math.max(2, Math.round(3 * ratio));
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const offset = (y * image.width + x) * 4;
      if (pixels[offset + 3] < 64) continue;
      const [r, g, b] = pixels.subarray(offset, offset + 3);
      const shade = (r + g + b) / 3;
      const color = b > r * 1.3 && b > g * 1.1 ? '#1E6FFF'
        : shade < 100 ? '#292a25' : shade < 180 ? '#737168' : '#d0cdc4';
      samples.push({ x: x / ratio, y: y / ratio, color });
    }
  }
  // Bound the extra work even when a month contains many training days.
  const stride = Math.max(1, Math.ceil(samples.length / 800));
  return { image, samples: samples.filter((_, index) => index % stride === 0) };
}
