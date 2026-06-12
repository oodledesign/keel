/**
 * Supabase public buckets must be loaded via `/object/public/{bucket}/...`.
 * Older URLs or mistaken authenticated paths 400 in the browser.
 */
export function toSupabasePublicStorageUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}
