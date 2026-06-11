import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { signQuickActionToken, verifyQuickActionToken } from './action-token';

describe('quick action tokens', () => {
  const originalEnv = process.env.QUICK_ACTION_SECRET;

  beforeEach(() => {
    process.env.QUICK_ACTION_SECRET = 'test-quick-action-secret-key';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.QUICK_ACTION_SECRET;
    } else {
      process.env.QUICK_ACTION_SECRET = originalEnv;
    }
  });

  it('round-trips signed payloads', () => {
    const token = signQuickActionToken({
      userId: 'user-1',
      data: {
        type: 'create_task',
        accountId: '00000000-0000-4000-8000-000000000001',
        title: 'Test task',
        notes: null,
        dueDate: '2026-06-14',
        priority: 'medium',
        projectId: null,
        clientId: null,
      },
    });

    const payload = verifyQuickActionToken(token);
    expect(payload.userId).toBe('user-1');
    expect(payload.data.type).toBe('create_task');
    if (payload.data.type === 'create_task') {
      expect(payload.data.title).toBe('Test task');
    }
  });

  it('rejects tampered tokens', () => {
    const token = signQuickActionToken({
      userId: 'user-1',
      data: {
        type: 'pagespeed_scan',
        accountId: '00000000-0000-4000-8000-000000000001',
        projectId: '00000000-0000-4000-8000-000000000002',
      },
    });

    const [body, sig] = token.split('.');
    const tampered = `${body}.${sig!.slice(0, -1)}x`;
    expect(() => verifyQuickActionToken(tampered)).toThrow();
  });
});
