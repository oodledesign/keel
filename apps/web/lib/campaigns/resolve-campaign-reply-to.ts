/**
 * Resolve the Reply-To used on campaign test / scheduled / live sends.
 *
 * Precedence:
 * 1. Explicit campaign Reply-To when set
 * 2. The resolved From address (campaign From when set)
 * 3. Only if From is also blank: workspace/brand/platform reply fallback
 *    (`resolveWorkspaceMailFrom().replyTo` — brand contact email, then
 *    proposed From, then the SES/platform sender)
 *
 * Do not use a sending-domain default such as `websiteadmin@` when From is set.
 */
export function resolveCampaignReplyTo(input: {
  campaignReplyTo?: string | null;
  fromEmail?: string | null;
  workspaceReplyTo?: string | null;
}): string | undefined {
  const explicit = input.campaignReplyTo?.trim();
  if (explicit) return explicit;

  const from = input.fromEmail?.trim();
  if (from) return from;

  return input.workspaceReplyTo?.trim() || undefined;
}
