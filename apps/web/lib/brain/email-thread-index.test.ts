import { describe, expect, it } from 'vitest';

import {
  buildEmailThreadIndexText,
  shouldIndexEmailThreadForBrain,
} from './email-thread-index';

describe('shouldIndexEmailThreadForBrain', () => {
  it('requires a workspace link', () => {
    expect(
      shouldIndexEmailThreadForBrain({
        assistant_category: 'needs_reply',
      }),
    ).toBe(false);
  });

  it('indexes needs-reply threads in a workspace', () => {
    expect(
      shouldIndexEmailThreadForBrain({
        account_id: 'acc-1',
        assistant_category: 'needs_reply',
      }),
    ).toBe(true);
  });

  it('indexes linked threads even when no reply is needed', () => {
    expect(
      shouldIndexEmailThreadForBrain({
        account_id: 'acc-1',
        assistant_category: 'no_reply',
        client_id: 'client-1',
      }),
    ).toBe(true);
  });
});

describe('buildEmailThreadIndexText', () => {
  it('includes status, links, action items, and messages', () => {
    const text = buildEmailThreadIndexText({
      thread: {
        id: 'thread-1',
        account_id: 'acc-1',
        subject: 'Project update',
        snippet: 'Quick question about the timeline',
        participants: [{ name: 'Alex', email: 'alex@acme.test' }],
        assistant_category: 'needs_reply',
        assistant_category_reason: 'Client asked a direct question',
        client_id: 'client-1',
        project_id: 'project-1',
        last_message_at: '2026-06-12T10:00:00.000Z',
        updated_at: '2026-06-12T10:00:00.000Z',
      },
      messages: [
        {
          from_address: 'alex@acme.test',
          subject: 'Project update',
          body_text: 'Can we move the launch date?',
          snippet: 'Can we move the launch date?',
          internal_date: '2026-06-12T10:00:00.000Z',
        },
      ],
      clientName: 'Acme Co',
      projectName: 'Website redesign',
      actionItems: [
        {
          title: 'Reply with updated timeline',
          detail: 'Confirm March launch',
          status: 'suggested',
        },
      ],
    });

    expect(text).toContain('# Project update');
    expect(text).toContain('Status: Needs reply');
    expect(text).toContain('Linked client: Acme Co');
    expect(text).toContain('Linked project: Website redesign');
    expect(text).toContain('Suggested action items');
    expect(text).toContain('Reply with updated timeline');
    expect(text).toContain('Can we move the launch date?');
  });
});
