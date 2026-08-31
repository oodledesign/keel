import 'server-only';

/**
 * App secrets used to verify Meta signed_request / webhook HMAC.
 * Prefer the main App Secret, then Instagram-specific names already used
 * by Auto-Reply and Feedflow. Order is intentional — do not reorder.
 */
export function getMetaAppSecrets(): string[] {
  const secrets = [
    process.env.META_APP_SECRET,
    process.env.META_INSTAGRAM_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value.length > 0);

  return [...new Set(secrets)];
}
