import { describe, expect, it } from 'vitest';

import { uniqueEmails } from './unique-emails';

describe('uniqueEmails', () => {
  it('dedupes mixed single and list values', () => {
    expect(
      uniqueEmails(
        'jemma@jem-coaching.com',
        ['Jemma@jem-coaching.com', 'billing@client.com'],
        '  ',
      ),
    ).toEqual(['jemma@jem-coaching.com', 'billing@client.com']);
  });
});
