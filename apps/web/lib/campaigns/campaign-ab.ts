export type CampaignSubjectVariant = 'a' | 'b';

/**
 * Deterministic 50/50 (or custom split) assignment from email.
 * Avoids node:crypto so this helper stays client-safe.
 */
export function assignSubjectVariant(
  email: string,
  splitPercentA = 50,
): CampaignSubjectVariant {
  const clamped = Math.min(90, Math.max(10, Math.round(splitPercentA)));
  const key = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 100 < clamped ? 'a' : 'b';
}

export function subjectForVariant(input: {
  subjectA: string;
  subjectB?: string | null;
  variant: CampaignSubjectVariant | null;
  abEnabled: boolean;
}): string {
  if (!input.abEnabled || input.variant !== 'b') {
    return input.subjectA;
  }
  const subjectB = input.subjectB?.trim();
  return subjectB || input.subjectA;
}

export type CampaignAbVariantStats = {
  variant: CampaignSubjectVariant;
  subject: string;
  sent: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounces: number;
  complaints: number;
  openRate: number;
  clickRate: number;
};

export function summarizeAbVariants(input: {
  subjectA: string;
  subjectB: string;
  recipients: Array<{
    subjectVariant?: CampaignSubjectVariant | null;
    status: string;
    openedAt: string | null;
    clickedAt: string | null;
    bouncedAt: string | null;
    complaintAt: string | null;
    deliveredAt: string | null;
  }>;
}): CampaignAbVariantStats[] {
  return (['a', 'b'] as const).map((variant) => {
    const rows = input.recipients.filter(
      (row) => (row.subjectVariant ?? 'a') === variant,
    );
    const sent = rows.filter((row) => row.status === 'sent').length;
    const delivered = rows.filter((row) => row.deliveredAt).length;
    const uniqueOpens = rows.filter((row) => row.openedAt).length;
    const uniqueClicks = rows.filter((row) => row.clickedAt).length;
    const bounces = rows.filter((row) => row.bouncedAt).length;
    const complaints = rows.filter((row) => row.complaintAt).length;
    const denom = delivered > 0 ? delivered : sent;
    return {
      variant,
      subject: variant === 'a' ? input.subjectA : input.subjectB,
      sent,
      delivered,
      uniqueOpens,
      uniqueClicks,
      bounces,
      complaints,
      openRate: denom > 0 ? uniqueOpens / denom : 0,
      clickRate: denom > 0 ? uniqueClicks / denom : 0,
    };
  });
}

export function pickAbWinner(
  variants: CampaignAbVariantStats[],
): CampaignSubjectVariant | null {
  const [a, b] = variants;
  if (!a || !b) return null;
  if (a.sent === 0 || b.sent === 0) return null;
  if (a.openRate === b.openRate && a.clickRate === b.clickRate) return null;
  if (a.openRate !== b.openRate) {
    return a.openRate > b.openRate ? 'a' : 'b';
  }
  return a.clickRate > b.clickRate ? 'a' : 'b';
}
