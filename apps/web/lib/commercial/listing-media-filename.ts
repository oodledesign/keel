/**
 * Client-safe media filename helpers (no Node built-ins).
 */
export function safeMediaFileName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '_')
    .replace(/\.\./g, '_')
    .replace(/^_|_$/g, '');
  return (ascii || 'file').slice(0, 120);
}
