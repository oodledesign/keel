import { describe, expect, it } from 'vitest';

import { buildReplyAllRecipients } from './save-draft-to-gmail';

describe('buildReplyAllRecipients', () => {
  it('replies to sender and keeps other To/Cc recipients', () => {
    const result = buildReplyAllRecipients({
      from: 'Alice <alice@client.com>',
      to: 'Dan <dan@ozer.so>, Bob <bob@client.com>',
      cc: 'Carol <carol@client.com>',
      ownerEmail: 'dan@ozer.so',
    });

    expect(result.to).toBe(
      'Alice <alice@client.com>, Bob <bob@client.com>',
    );
    expect(result.cc).toBe('Carol <carol@client.com>');
  });

  it('excludes the owner from Cc and avoids duplicates', () => {
    const result = buildReplyAllRecipients({
      from: 'alice@client.com',
      to: 'dan@ozer.so',
      cc: 'alice@client.com, dan@ozer.so, other@client.com',
      ownerEmail: 'dan@ozer.so',
    });

    expect(result.to).toBe('alice@client.com');
    expect(result.cc).toBe('other@client.com');
  });

  it('falls back to From when To only contains the owner', () => {
    const result = buildReplyAllRecipients({
      from: 'Alice <alice@client.com>',
      to: 'Dan <dan@ozer.so>',
      cc: null,
      ownerEmail: 'dan@ozer.so',
    });

    expect(result.to).toBe('Alice <alice@client.com>');
    expect(result.cc).toBeUndefined();
  });
});
