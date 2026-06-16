import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'keel_';
const TOKEN_HEX_LENGTH = 48;

export function generateKeelApiToken() {
  return `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function hashKeelApiToken(rawToken: string) {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function isKeelApiTokenFormat(rawToken: string) {
  const trimmed = rawToken.trim();
  return new RegExp(`^${TOKEN_PREFIX}[0-9a-f]{${TOKEN_HEX_LENGTH}}$`, 'i').test(
    trimmed,
  );
}
