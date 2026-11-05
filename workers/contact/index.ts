import { CONTACT_MAX_FILE_BYTES, validateContactFiles } from '../../src/data/contact.ts';

interface Attachment { filename: string; content: string }
interface Env {
  ALLOWED_ORIGINS: string;
  CONTACT_FROM_EMAIL: string;
  CONTACT_TO_EMAIL: string;
  RESEND_API_KEY: string;
  CONTACT_RATE_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
}
const MAX_BODY_BYTES = 6 * 1024 * 1024;
class ContactError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function readForm(request: Request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data;')) throw new ContactError(415, 'Use a multipart form.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new ContactError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ContactError(400, 'The message is empty.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new ContactError(413, 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  try { return await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new ContactError(400, 'The form could not be read.'); }
}
function matchesFileHeader(name: string, bytes: Uint8Array) {
  const extension = name.split('.').at(-1)?.toLowerCase();
  const starts = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  if (extension === 'pdf') return starts([37, 80, 68, 70, 45]);
  if (extension === 'png') return starts([137, 80, 78, 71, 13, 10, 26, 10]);
  if (extension === 'jpg' || extension === 'jpeg') return starts([255, 216, 255]);
  if (extension === 'gif') return ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(bytes.slice(0, 6)));
  if (extension === 'webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (extension === 'docx') return starts([80, 75, 3, 4]);
  if (extension === 'doc') return starts([208, 207, 17, 224, 161, 177, 26, 225]);
  return false;
}
function base64(bytes: Uint8Array) {
  if ('toBase64' in bytes) return (bytes as Uint8Array & { toBase64(): string }).toBase64();
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}

// Inject only the outbound HTTP transport for tests; production uses Workers fetch.
export function createContactWorker(sendRequest: typeof fetch = fetch) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const origin = request.headers.get('Origin') ?? '';
      const allowed = env.ALLOWED_ORIGINS?.split(',').map(value => value.trim()).filter(Boolean) ?? [];
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' });
      const json = (body: object, status = 200) => Response.json(body, { status, headers });
      if (!allowed.includes(origin)) return json({ ok: false, error: 'Origin is not allowed.' }, 403);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      if (new URL(request.url).pathname !== '/contact') return json({ ok: false, error: 'Not found.' }, 404);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') { headers.set('Allow', 'POST, OPTIONS'); return json({ ok: false, error: 'Method not allowed.' }, 405); }
      if (!env.RESEND_API_KEY?.trim() || !env.CONTACT_RATE_LIMITER || !env.CONTACT_FROM_EMAIL || !env.CONTACT_TO_EMAIL) return json({ ok: false, error: 'Sending is unavailable.' }, 503);
      try {
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        const limit = await env.CONTACT_RATE_LIMITER.limit({ key: `portfolio-contact:${ip}` });
        if (!limit.success) { headers.set('Retry-After', '60'); return json({ ok: false, error: 'Please wait before sending another message.' }, 429); }
        const form = await readForm(request);
        const field = (name: string, max: number, required = true) => {
          const value = form.get(name);
          if (value !== null && typeof value !== 'string') throw new ContactError(400, 'Invalid field.');
          const text = (value ?? '').trim();
          if ((required && !text) || text.length > max || text.includes('\0')) throw new ContactError(400, 'Please check your message fields.');
          return text;
        };
        if (field('website', 200, false)) throw new ContactError(400, 'Message could not be accepted.');
        const name = field('name', 80);
        const email = field('email', 254);
        const subject = field('subject', 160, false);
        const message = field('message', 5000);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(name + subject)) throw new ContactError(400, 'Please check your contact details.');
        const rawFiles = form.getAll('attachments');
        if (rawFiles.some(file => !(file instanceof File))) throw new ContactError(400, 'Invalid attachment.');
        const files = rawFiles as File[];
        const fileError = validateContactFiles(files);
        if (fileError) throw new ContactError(files.reduce((total, file) => total + file.size, 0) > CONTACT_MAX_FILE_BYTES ? 413 : 400, fileError);
        const attachments: Attachment[] = [];
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!matchesFileHeader(file.name, bytes)) throw new ContactError(400, 'An attachment does not match its file type.');
          const safeName = file.name.split(/[\\/]/).at(-1)!.replace(/[\x00-\x1f\x7f]/g, '_');
          const extension = safeName.slice(safeName.lastIndexOf('.'));
          const filename = safeName.slice(0, safeName.lastIndexOf('.')).slice(0, 160 - extension.length) + extension;
          attachments.push({ filename, content: base64(bytes) });
        }
        const response = await sendRequest('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            from: env.CONTACT_FROM_EMAIL, to: [env.CONTACT_TO_EMAIL], reply_to: email,
            subject: subject ? `Portfolio: ${subject}` : `Portfolio message from ${name}`,
            text: `From: ${name} <${email}>\n\n${message}`,
            attachments,
          }),
        });
        const result = await response.json().catch(() => null) as { id?: unknown } | null;
        if (response.status === 429) {
          headers.set('Retry-After', '60');
          return json({ ok: false, error: 'Please wait before sending another message.' }, 429);
        }
        if (!response.ok || typeof result?.id !== 'string' || !result.id.trim()) throw new Error('No email acknowledgement.');
        return json({ ok: true });
      } catch (error) {
        if (error instanceof ContactError) return json({ ok: false, error: error.message }, error.status);
        return json({ ok: false, error: 'Your message could not be sent. Please try again later.' }, 502);
      }
    },
  };
}

export default createContactWorker();
