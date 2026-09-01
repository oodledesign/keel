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
  tokens: string[];
  region: string;
  mailFromSubdomain: string;
}): SendingDnsRecord[] {
  const mailFromHost = input.mailFromSubdomain.trim().toLowerCase();
  const records: SendingDnsRecord[] = input.tokens.map((token) => ({
    type: 'CNAME',
    host: `${token}._domainkey`,
    name: `${token}._domainkey.${input.domain}`,
    value: `${token}.dkim.amazonses.com`,
    purpose: 'dkim',
  }));

  records.push({
    type: 'MX',
    host: mailFromHost,
    name: `${mailFromHost}.${input.domain}`,
    value: `10 feedback-smtp.${input.region}.amazonses.com`,
    purpose: 'mail_from_mx',
    priority: 10,
  });

  records.push({
    type: 'TXT',
    host: mailFromHost,
    name: `${mailFromHost}.${input.domain}`,
    value: 'v=spf1 include:amazonses.com ~all',
    purpose: 'mail_from_spf',
  });

  return records;
}
