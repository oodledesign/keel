import { describe, expect, it } from 'vitest';

import { buildSendingDnsRecords } from './dns-records';

describe('buildSendingDnsRecords', () => {
  it('puts Easy DKIM and MAIL FROM on the mail sending host', () => {
    const records = buildSendingDnsRecords({
      domain: 'bracketts.co.uk',
      sendingHost: 'mail.bracketts.co.uk',
      tokens: ['aaa'],
      region: 'eu-west-2',
      mailFromSubdomain: 'bounce',
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CNAME',
          host: 'aaa._domainkey.mail',
          name: 'aaa._domainkey.mail.bracketts.co.uk',
          purpose: 'dkim',
        }),
        expect.objectContaining({
          type: 'MX',
          host: 'bounce.mail',
          name: 'bounce.mail.bracketts.co.uk',
          purpose: 'mail_from_mx',
        }),
        expect.objectContaining({
          type: 'TXT',
          host: 'bounce.mail',
          name: 'bounce.mail.bracketts.co.uk',
          purpose: 'mail_from_spf',
        }),
      ]),
    );
  });

  it('keeps MAIL FROM on the apex when there is no sending subdomain', () => {
    const records = buildSendingDnsRecords({
      domain: 'bracketts.co.uk',
      sendingHost: 'bracketts.co.uk',
      tokens: ['aaa'],
      region: 'eu-west-2',
      mailFromSubdomain: 'bounce',
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CNAME',
          host: 'aaa._domainkey',
          name: 'aaa._domainkey.bracketts.co.uk',
        }),
        expect.objectContaining({
          type: 'MX',
          host: 'bounce',
          name: 'bounce.bracketts.co.uk',
        }),
      ]),
    );
  });
});
