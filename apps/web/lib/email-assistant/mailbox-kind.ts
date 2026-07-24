export type MailboxKind = 'business' | 'personal';

export function parseMailboxKind(
  value: string | null | undefined,
): MailboxKind {
  return value === 'personal' ? 'personal' : 'business';
}
