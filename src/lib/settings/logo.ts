/** Keep uploads below the 4 MB Server Action request limit, including form overhead. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ['image/jpeg', 'image/png'] as const;

export function logoFileError(file: Pick<Blob, 'type' | 'size'>): string | null {
  if (!LOGO_TYPES.some((type) => type === file.type)) return 'Choose a JPG or PNG image.';
  if (file.size === 0) return 'That file is empty. Choose a JPG or PNG image.';
  if (file.size > MAX_LOGO_BYTES) return 'Choose an image smaller than 2 MB.';
  return null;
}

/** Do not trust the filename or browser-supplied MIME type alone. */
export function hasLogoSignature(bytes: Uint8Array, type: string): boolean {
  const signature = type === 'image/png'
    ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    : type === 'image/jpeg' ? [0xff, 0xd8, 0xff] : null;
  return !!signature && bytes.length > signature.length && signature.every((byte, i) => bytes[i] === byte);
}
