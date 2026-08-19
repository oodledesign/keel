/**
 * Microsoft 365 treats a Reply-To on a different domain from From as
 * invoice-fraud (e.g. From hi@ozer.so, Reply-To dan@oodle.design).
 */
export function emailAddressDomain(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const address = trimmed.match(/<([^>]+)>/)?.[1] ?? trimmed;
  const domain = address.split('@')[1]?.trim().toLowerCase();
  return domain || null;
}

export function alignedReplyTo(
  replyTo: string | null | undefined,
  from: string | null | undefined,
): string | undefined {
  const reply = replyTo?.trim();
  if (!reply) return undefined;

  const replyDomain = emailAddressDomain(reply);
  const fromDomain = emailAddressDomain(from);
  if (!replyDomain || !fromDomain || replyDomain !== fromDomain) {
    return undefined;
  }

  return reply;
}
