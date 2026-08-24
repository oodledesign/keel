import { createHmac, timingSafeEqual } from 'crypto';

import { getMetaAppSecret } from '~/lib/instagram-autoreply/env';

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = getMetaAppSecret();
  if (!secret || !signatureHeader?.startsWith('sha256=')) {
    return false;
  }
  const expected =
    'sha256=' +
    createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
