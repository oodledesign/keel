export class SendingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendingDomainError';
  }
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const DEFAULT_SENDING_SUBDOMAIN = 'mail';

export const DEFAULT_SENDING_LOCAL_PART = 'mail';

export const DEFAULT_MAIL_FROM_SUBDOMAIN = 'bounce';

export const DEFAULT_SENDING_LOCAL_PARTS = [
  'mail',
  'listings',
  'hello',
] as const;

export const DEFAULT_SENDING_SUBDOMAIN_SUGGESTIONS = [
  'mail',
  'listings',
  'hello',
  'go',
] as const;

export type DefaultSendingLocalPart =
  (typeof DEFAULT_SENDING_LOCAL_PARTS)[number];

export function normalizeSendingDomain(input: string): string {
  let value = input.trim().toLowerCase();

  if (!value) {
    throw new SendingDomainError(
      'Enter a domain such as bracketts.co.uk — not a full email address.',
    );
  }

  if (value.includes('@')) {
    throw new SendingDomainError(
      'Enter the domain only, not a full email address.',
    );
  }

  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/\/.*$/, '');
  value = value.replace(/:\d+$/, '');
  value = value.replace(/\.$/, '');

  if (value.startsWith('www.')) {
    value = value.slice(4);
  }

  if (!DOMAIN_RE.test(value)) {
    throw new SendingDomainError(
      'That does not look like a valid domain. Try something like bracketts.co.uk.',
    );
  }

  return value;
}

export function normalizeSendingLocalPart(input: string): string {
  const value = input.trim().toLowerCase();

  if (!LOCAL_PART_RE.test(value) || value.length > 64) {
    throw new SendingDomainError(
      'Use a simple From name such as mail, listings, or hello.',
    );
  }

  return value;
}

export function normalizeSendingSubdomain(
  input: string | null | undefined,
): string | null {
  if (input == null) {
    return null;
  }

  const value = input.trim().toLowerCase();

  if (!value) {
    return null;
  }

  if (!SUBDOMAIN_RE.test(value)) {
    throw new SendingDomainError(
      'Use a simple subdomain such as mail, listings, or go — or choose apex.',
    );
  }

  return value;
}

export function resolveSendingHost(
  apex: string,
  subdomain: string | null | undefined,
): string {
  const label = subdomain?.trim().toLowerCase();
  if (!label) {
    return apex;
  }

  return `${label}.${apex}`;
}

export function resolveMailFromHost(
  sendingHost: string,
  mailFromSubdomain = DEFAULT_MAIL_FROM_SUBDOMAIN,
): string {
  return `${mailFromSubdomain}.${sendingHost}`;
}

export function formatSendingFromAddress(input: {
  localPart: string;
  domain: string;
  sendingSubdomain?: string | null;
}): string {
  return `${input.localPart}@${resolveSendingHost(input.domain, input.sendingSubdomain)}`;
}

export function dnsHostRelativeToApex(fqdn: string, apex: string): string {
  if (fqdn === apex) {
    return '@';
  }

  if (fqdn.endsWith(`.${apex}`)) {
    return fqdn.slice(0, -(apex.length + 1));
  }

  return fqdn;
}

export function emailDomainOf(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }
  return trimmed.slice(at + 1);
}

export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

export function isSesStatusSuccess(status: string | null | undefined) {
  return (status ?? '').toLowerCase() === 'success';
}

export function isSesStatusFailed(status: string | null | undefined) {
  return (status ?? '').toLowerCase() === 'failed';
}

export function isSendingDomainVerified(input: {
  dkim_status: string;
  mail_from_status: string;
}) {
  return (
    isSesStatusSuccess(input.dkim_status) &&
    isSesStatusSuccess(input.mail_from_status)
  );
}

export function overallVerificationStatus(input: {
  dkim_status: string;
  mail_from_status: string;
}): 'pending' | 'verified' | 'failed' {
  if (
    isSesStatusFailed(input.dkim_status) ||
    isSesStatusFailed(input.mail_from_status)
  ) {
    return 'failed';
  }

  if (isSendingDomainVerified(input)) {
    return 'verified';
  }

  return 'pending';
}
