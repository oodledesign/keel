import { dnsHostRelativeToApex, resolveMailFromHost } from './domain';

export type SendingDnsRecord = {
  type: 'CNAME' | 'MX' | 'TXT';
  host: string;
  name: string;
  value: string;
  purpose: 'dkim' | 'mail_from_mx' | 'mail_from_spf';
  priority?: number;
};

export function buildSendingDnsRecords(input: {
  domain: string;
  sendingHost?: string;
  tokens: string[];
  region: string;
  mailFromSubdomain: string;
}): SendingDnsRecord[] {
  const apex = input.domain;
  const sendingHost = (input.sendingHost ?? apex).trim().toLowerCase();
  const mailFromFqdn = resolveMailFromHost(
    sendingHost,
    input.mailFromSubdomain.trim().toLowerCase(),
  );

  const records: SendingDnsRecord[] = input.tokens.map((token) => ({
    type: 'CNAME',
    host: dnsHostRelativeToApex(`${token}._domainkey.${sendingHost}`, apex),
    name: `${token}._domainkey.${sendingHost}`,
    value: `${token}.dkim.amazonses.com`,
    purpose: 'dkim',
  }));

  records.push({
    type: 'MX',
    host: dnsHostRelativeToApex(mailFromFqdn, apex),
    name: mailFromFqdn,
    value: `10 feedback-smtp.${input.region}.amazonses.com`,
    purpose: 'mail_from_mx',
    priority: 10,
  });

  records.push({
    type: 'TXT',
    host: dnsHostRelativeToApex(mailFromFqdn, apex),
    name: mailFromFqdn,
    value: 'v=spf1 include:amazonses.com ~all',
    purpose: 'mail_from_spf',
  });

  return records;
}
