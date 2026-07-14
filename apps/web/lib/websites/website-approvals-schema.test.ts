import { describe, expect, it } from 'vitest';

import { SetShareApprovalSchema } from '~/home/[account]/websites/_lib/schema/site-studio.schema';

describe('SetShareApprovalSchema', () => {
  it('accepts page approvals without pageId', () => {
    const parsed = SetShareApprovalSchema.parse({
      token: 'tok_1234567890123456',
      targetType: 'page',
      targetId: '11111111-1111-4111-8111-111111111111',
      status: 'approved',
    });
    expect(parsed.targetType).toBe('page');
  });

  it('requires pageId for section approvals', () => {
    expect(() =>
      SetShareApprovalSchema.parse({
        token: 'tok_1234567890123456',
        targetType: 'section',
        targetId: '11111111-1111-4111-8111-111111111111',
        status: 'blocked',
        note: 'Too tall',
      }),
    ).toThrow();
  });
});
