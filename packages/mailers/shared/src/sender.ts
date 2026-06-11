/**
 * Keep environment labels out of customer-facing From names.
 */
export function sanitizeEmailSender(sender: string | null | undefined) {
  const value = sender?.trim() ?? '';

  if (!value) {
    return value;
  }

  const mailbox = value.match(/^([^<]+)<(.+)>$/);

  if (!mailbox) {
    return value.replace(/\s+staging\b/gi, '').trim();
  }

  const displayName = mailbox[1]?.replace(/\s+staging\b/gi, '').trim();
  const email = mailbox[2]?.trim();

  if (!displayName || !email) {
    return value.replace(/\s+staging\b/gi, '').trim();
  }

  return `${displayName} <${email}>`;
}
