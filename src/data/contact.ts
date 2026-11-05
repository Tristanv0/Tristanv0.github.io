export const CONTACT_MAX_FILES = 3;
export const CONTACT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CONTACT_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};
export const CONTACT_ACCEPT = Object.keys(CONTACT_FILE_TYPES).map(extension => `.${extension}`).join(',');
export function contactFileType(name: string) {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? '';
  return Object.hasOwn(CONTACT_FILE_TYPES, extension) ? CONTACT_FILE_TYPES[extension] : null;
}
export function validateContactFiles(files: readonly { name: string; size: number }[]) {
  if (files.length > CONTACT_MAX_FILES) return 'Please attach up to 3 files.';
  if (files.some(file => !contactFileType(file.name))) return 'Please choose a PDF, Word document, JPG, PNG, WebP, or GIF.';
  if (files.some(file => file.size === 0)) return 'One of those files is empty. Please choose another file.';
  if (files.reduce((total, file) => total + file.size, 0) > CONTACT_MAX_FILE_BYTES) return 'Please keep attachments under 5 MB in total.';
  return null;
}
