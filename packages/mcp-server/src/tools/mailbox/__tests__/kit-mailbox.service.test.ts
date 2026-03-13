import { describe, expect, it } from 'vitest';

import {
  type KitMailboxDeps,
  createKitMailboxService,
} from '../kit-mailbox.service';

function createDeps(overrides: Partial<KitMailboxDeps> = {}): KitMailboxDeps {
  return {
    async executeCommand() {
      return {
        stdout: '',
        stderr: '',
        exitCode: 0,
      };
    },
    async isPortOpen() {
      return true;
    },
    async fetchJson() {
      return {};
    },
    async requestJson() {
      return {};
    },
    ...overrides,
  };
}

describe('KitMailboxService', () => {
  it('lists messages from Mailpit API', async () => {
    const service = createKitMailboxService(
      createDeps({
        async executeCommand() {
          return { stdout: 'mailpit\n', stderr: '', exitCode: 0 };
        },
        async fetchJson(url: string) {
          if (url.endsWith('/info')) {
            return { version: 'v1' };
          }

          return {
            total: 1,
            unread: 1,
            count: 1,
            messages: [
              {
                ID: 'abc',
                MessageID: 'm-1',
                Subject: 'Welcome',
                From: [{ Name: 'Makerkit', Address: 'noreply@makerkit.dev' }],
                To: [{ Address: 'user@example.com' }],
                Created: '2025-01-01T00:00:00Z',
                Size: 123,
                Read: false,
                ReadAt: null,
              },
            ],
          };
        },
      }),
    );

    const result = await service.list({ start: 0, limit: 50 });

    expect(result.mail_server.running).toBe(true);
    expect(result.mail_server.running_via_docker).toBe(true);
    expect(result.total).toBe(1);
    expect(result.messages[0]).toEqual({
      id: 'abc',
      message_id: 'm-1',
      subject: 'Welcome',
      from: ['Makerkit <noreply@makerkit.dev>'],
      to: ['user@example.com'],
      created_at: '2025-01-01T00:00:00Z',
      size: 123,
      read: false,
    });
    expect(result.messages[0]?.readAt).toBeUndefined();
  });

  it('reads single message details', async () => {
    const service = createKitMailboxService(
      createDeps({
        async executeCommand() {
          return { stdout: '', stderr: '', exitCode: 0 };
        },
        async fetchJson(url: string) {
          if (url.endsWith('/info')) {
            return { version: 'v1' };
          }

          if (url.includes('/message/')) {
            return {
              ID: 'abc',
              MessageID: 'm-1',
              Subject: 'Welcome',
              From: [{ Address: 'noreply@makerkit.dev' }],
              To: [{ Address: 'user@example.com' }],
              Cc: [{ Address: 'team@example.com' }],
              Bcc: [],
              Text: ['Hello user'],
              HTML: ['<p>Hello user</p>'],
              Headers: {
                Subject: ['Welcome'],
              },
              Read: true,
              ReadAt: '2025-01-01T00:05:00Z',
              Size: 456,
              Created: '2025-01-01T00:00:00Z',
            };
          }

          return {};
        },
      }),
    );

    const result = await service.read({ id: 'abc' });

    expect(result.id).toBe('abc');
    expect(result.subject).toBe('Welcome');
    expect(result.from).toEqual(['noreply@makerkit.dev']);
    expect(result.to).toEqual(['user@example.com']);
    expect(result.cc).toEqual(['team@example.com']);
    expect(result.text).toBe('Hello user');
    expect(result.html).toBe('<p>Hello user</p>');
    expect(result.read).toBe(true);
    expect(result.readAt).toBe('2025-01-01T00:05:00Z');
    expect(result.headers).toEqual({ Subject: ['Welcome'] });
  });

  it('updates read status for a message', async () => {
    const service = createKitMailboxService(
      createDeps({
        async requestJson(url: string) {
          expect(url).toContain('/message/abc/read');

          return {
            id: 'abc',
            read: true,
            readAt: '2025-01-01T00:10:00Z',
          };
        },
      }),
    );

    const result = await service.setReadStatus({ id: 'abc', read: true });

    expect(result).toEqual({
      id: 'abc',
      read: true,
      readAt: '2025-01-01T00:10:00Z',
    });
  });

  it('throws if mailpit runs in docker but API port is not open', async () => {
    const service = createKitMailboxService(
      createDeps({
        async isPortOpen() {
          return false;
        },
        async executeCommand() {
          return { stdout: 'mailpit\n', stderr: '', exitCode: 0 };
        },
      }),
    );

    await expect(service.list({ start: 0, limit: 50 })).rejects.toThrow(
      'Mailpit appears running in docker but API is unreachable at http://127.0.0.1:8025',
    );
  });

  it('throws if mailpit is not running', async () => {
    const service = createKitMailboxService(
      createDeps({
        async isPortOpen() {
          return false;
        },
        async executeCommand() {
          return { stdout: '', stderr: '', exitCode: 0 };
        },
      }),
    );

    await expect(service.list({ start: 0, limit: 50 })).rejects.toThrow(
      'Mailpit is not running. Start local services with "pnpm compose:dev:up".',
    );
  });
});
