import 'server-only';

import { randomBytes } from 'crypto';

export type { SupportAttachmentMeta } from '~/lib/support/support-attachment.types';

export function createSupportPublicToken(bytes = 24) {
  return randomBytes(bytes).toString('hex');
}
