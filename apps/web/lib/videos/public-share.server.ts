import 'server-only';

import { randomBytes } from 'node:crypto';

export function generatePublicShareToken() {
  return randomBytes(24).toString('base64url');
}
