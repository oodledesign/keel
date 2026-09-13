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

  it('emails a client participant from clients.email', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [],
      clients: [{ userId: null, email: 'hello@ozer-os.com' }],
    });

    expect(result.inAppUserIds).toEqual([]);
    expect(result.emails).toEqual(['hello@ozer-os.com']);
  });

  it('does not email a client participant without email', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [],
      clients: [{ userId: null, email: null }],
    });

    expect(result.inAppUserIds).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it('does not double-send when a client and contact share an email', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [{ userId: null, email: 'hello@ozer-os.com' }],
      clients: [{ userId: null, email: 'hello@ozer-os.com' }],
    });

    expect(result.emails).toEqual(['hello@ozer-os.com']);
  });

  it('never emails the sender even when a client record uses the same address', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [],
      clients: [{ userId: null, email: 'dan@ozer.so' }],
    });

    expect(result.inAppUserIds).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it('adds in-app for a client participant with a user account', () => {
    const result = collectMessageNotifyRecipients({
      senderUserId: 'member-1',
      senderEmail: 'dan@ozer.so',
      members: [{ userId: 'member-1', email: 'dan@ozer.so' }],
      contacts: [],
      clients: [{ userId: 'client-user', email: 'hello@ozer-os.com' }],
    });

    expect(result.inAppUserIds).toEqual(['client-user']);
    expect(result.emails).toEqual(['hello@ozer-os.com']);
  });
});
