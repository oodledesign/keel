import { describe, expect, it } from 'vitest';

import { collectMessageNotifyRecipients } from './messages-notify-recipients';

describe('collectMessageNotifyRecipients', () => {
  it('notifies other members and contacts, not the sender', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [
        { userId: 'member-1', email: 'dan@ozer.so' },
        { userId: 'member-2', email: 'alex@ozer.so' },
      ],
      contacts: [
        { userId: 'contact-user', email: 'pat@client.com' },
        { userId: null, email: 'sam@client.com' },
      ],
    });

    expect(result.inAppUserIds.sort()).toEqual(['contact-user', 'member-2']);
    expect(result.emails.sort()).toEqual([
      'alex@ozer.so',
      'pat@client.com',
      'sam@client.com',
    ]);
  });

  it('does not notify a contact who sent the message', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'contact-user',
      senderEmail: 'pat@client.com',
      members: [{ userId: 'member-2', email: 'alex@ozer.so' }],
      contacts: [{ userId: 'contact-user', email: 'pat@client.com' }],
    });

    expect(result.inAppUserIds).toEqual(['member-2']);
    expect(result.emails).toEqual(['alex@ozer.so']);
  });

  it('never adds emails that are not on the participant list', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [],
    });

    expect(result.inAppUserIds).toEqual([]);
    expect(result.emails).toEqual([]);
  });
});
