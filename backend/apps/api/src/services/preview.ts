const SAFE_INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'application/json'
]);

export function isSafeToRenderInline(contentType: string): boolean {
  const normalized = contentType.split(';')[0].trim().toLowerCase();

  if (SAFE_INLINE_TYPES.has(normalized)) {
    return true;
  }

  if (
    normalized === 'text/html' ||
    normalized === 'application/javascript' ||
    normalized === 'text/javascript'
  ) {
    return false;
  }

  return false;
}

