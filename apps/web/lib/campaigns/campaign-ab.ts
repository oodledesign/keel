/**
 * Client-safe A/B subject helpers. Assignment is deterministic per campaign + email
 * so retries stay on the same variant.
 */

export type CampaignAbVariant = 'a' | 'b';

export function clampAbSplitPercent(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(90, Math.max(10, Math.round(value as number)));
}

function hashToBucket(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function assignCampaignAbVariant(
  campaignId: string,
  email: string,
  splitPercent = 50,
): CampaignAbVariant {
  const split = clampAbSplitPercent(splitPercent);
  const bucket = hashToBucket(`${campaignId}:${email.trim().toLowerCase()}`);
  return bucket < split ? 'a' : 'b';
}

export function subjectForAbVariant(input: {
  subject: string;
  subjectB?: string | null;
  variant: CampaignAbVariant;
}): string {
  if (input.variant === 'b' && input.subjectB?.trim()) {
    return input.subjectB.trim();
  }
  return input.subject;
}

export type CampaignAbStats = {
  variant: CampaignAbVariant;
  sent: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number | null;
  clickRate: number | null;
};

export type CampaignAbWinner = {
  variant: CampaignAbVariant | null;
  reason: string;
};

export function summarizeAbVariant(input: {
  variant: CampaignAbVariant;
  sent: number;
  uniqueOpens: number;
  uniqueClicks: number;
}): CampaignAbStats {
  const sent = Math.max(0, input.sent);
  return {
    variant: input.variant,
    sent,
    uniqueOpens: input.uniqueOpens,
    uniqueClicks: input.uniqueClicks,
    openRate: sent > 0 ? input.uniqueOpens / sent : null,
    clickRate: sent > 0 ? input.uniqueClicks / sent : null,
  };
}

export function pickAbWinner(
  a: CampaignAbStats,
  b: CampaignAbStats,
): CampaignAbWinner {
  if (a.sent === 0 && b.sent === 0) {
    return { variant: null, reason: 'No sends yet' };
  }
  if ((a.openRate ?? 0) !== (b.openRate ?? 0)) {
    const winner = (a.openRate ?? 0) > (b.openRate ?? 0) ? 'a' : 'b';
    return { variant: winner, reason: 'Higher unique open rate' };
  }
  if ((a.clickRate ?? 0) !== (b.clickRate ?? 0)) {
    const winner = (a.clickRate ?? 0) > (b.clickRate ?? 0) ? 'a' : 'b';
    return { variant: winner, reason: 'Higher unique click rate' };
  }
  return { variant: null, reason: 'Tied — keep watching' };
}
