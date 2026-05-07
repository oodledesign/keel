import 'server-only';

/**
 * When enabled (development/preview builds only), signatures routes render the
 * full UI without requiring Microsoft 365 OAuth — useful for layout / UX review.
 * Graph-backed actions stay disabled until a real connection exists.
 */
export function isSignaturesUxPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.SIGNATURES_UX_PREVIEW === 'true';
}
