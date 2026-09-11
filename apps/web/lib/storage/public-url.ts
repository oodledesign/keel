/**
 * Supabase public buckets must be loaded via `/object/public/{bucket}/...`.
 * Older URLs or mistaken authenticated paths 400 in the browser.
 *
 * Signed (`/object/sign/`) and authenticated (`/object/authenticated/`)
 * URLs must stay as-is — rewriting them to `/object/public/sign/...`
 * breaks private-bucket fetches (listing photos in brochure PDFs, etc.).
 */
const SIGNED_OR_AUTHENTICATED_OBJECT =
  /\/storage\/v1\/object\/(?:sign|authenticated)\//i;

export function toSupabasePublicStorageUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (SIGNED_OR_AUTHENTICATED_OBJECT.test(trimmed)) return trimmed;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

/**
 * Object key inside a Supabase storage URL for `bucket`.
 * Understands `/object/public|sign|authenticated/{bucket}/...`.
 */
export function supabaseStorageObjectPath(
  url: string,
  bucket: string,
): string | null {
  try {
    const parsed = new URL(url);
    const escaped = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = parsed.pathname.match(
      new RegExp(
        `/storage/v1/object/(?:public/|sign/|authenticated/)?${escaped}/(.+)$`,
        'i',
      ),
    );
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
