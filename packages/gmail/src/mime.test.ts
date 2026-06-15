import { describe, expect, it } from 'vitest';

import { buildRawMessage, decodeBase64Url, parseMessage } from './mime';
import type { GmailMessage } from './types';

describe('gmail mime', () => {
  it('builds base64url RFC 2822 messages with reply headers', () => {
    const raw = buildRawMessage({
      from: 'me@example.com',
      to: 'client@example.com',
      subject: 'Re: Project update',
      body: 'Thanks — I will send the quote tomorrow.',
      inReplyTo: '<msg-123@mail.gmail.com>',
      references: '<msg-123@mail.gmail.com>',
    });

    const decoded = decodeBase64Url(raw);

    expect(decoded).toContain('To: client@example.com');
    expect(decoded).toContain('In-Reply-To: <msg-123@mail.gmail.com>');
    expect(decoded).toContain('Thanks — I will send the quote tomorrow.');
  });

  it('parses Gmail message headers and multipart bodies', () => {
    const bodyText = 'Plain body here';
    const message: GmailMessage = {
      id: 'msg-1',
      threadId: 'thread-1',
      snippet: 'Plain body here',
      internalDate: `${Date.parse('2026-06-01T09:00:00.000Z')}`,
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'From', value: 'Sender <sender@example.com>' },
          { name: 'To', value: 'Owner <owner@example.com>' },
          { name: 'Cc', value: 'cc@example.com' },
          { name: 'Subject', value: 'Follow up' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from(bodyText, 'utf8').toString('base64url'),
            },
          },
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>HTML body</p>', 'utf8').toString('base64url'),
            },
          },
        ],
      },
    };

    const parsed = parseMessage(message);

    expect(parsed.from).toBe('Sender <sender@example.com>');
    expect(parsed.to).toEqual(['Owner <owner@example.com>']);
    expect(parsed.cc).toEqual(['cc@example.com']);
    expect(parsed.subject).toBe('Follow up');
    expect(parsed.bodyText).toBe(bodyText);
    expect(parsed.bodyHtml).toBe('<p>HTML body</p>');
    expect(parsed.internalDate).toBe('2026-06-01T09:00:00.000Z');
  });
});
