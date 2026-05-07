/**
 * Microsoft OAuth `state` carries account id + workspace slug so the callback
 * can redirect to signatures settings without relying on a separate accounts
 * lookup (which can fail RLS or return an empty slug → unwanted redirect to /app).
 */

export type MsOAuthStateV1 = {
  v: 1;
  accountId: string;
  slug: string | null;
};

export function encodeMsOAuthState(
  accountId: string,
  slug: string | null,
): string {
  const payload: MsOAuthStateV1 = { v: 1, accountId, slug };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeMsOAuthState(raw: string | null): MsOAuthStateV1 | null {
  if (!raw) {
    return null;
  }
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const o = JSON.parse(json) as Partial<MsOAuthStateV1>;
    if (
      o?.v === 1 &&
      typeof o.accountId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(o.accountId)
    ) {
      const slug =
        typeof o.slug === 'string' && o.slug.trim().length > 0
          ? o.slug.trim()
          : null;
      return { v: 1, accountId: o.accountId, slug };
    }
  } catch {
    /* legacy: plain UUID state */
  }
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    return { v: 1, accountId: raw, slug: null };
  }
  return null;
}
