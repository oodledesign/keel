import type { EmailCampaignStatus } from './campaign.types';

export const CAMPAIGN_STATUS_LABEL: Record<EmailCampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

/**
 * Soft tinted pills — same language as listing/job status chips.
 * Colours come from Ozer tokens (info / gold / coral / sage / muted).
 */
export const CAMPAIGN_STATUS_BADGE_CLASS: Record<EmailCampaignStatus, string> =
  {
    draft:
      'bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--ozer-info)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-info)_28%,transparent)]',
    scheduled:
      'bg-[color-mix(in_srgb,var(--ozer-gold-500)_20%,transparent)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-gold-500)_42%,transparent)] dark:text-[var(--ozer-gold-500)]',
    sending:
      'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)] dark:text-[var(--ozer-coral-50)]',
    sent: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-800)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-sage-500)_50%,transparent)] dark:bg-[color-mix(in_srgb,var(--ozer-sage-500)_18%,transparent)] dark:text-[var(--ozer-sage-300)]',
    cancelled:
      'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)] ring-1 ring-inset ring-[color:var(--workspace-shell-border)]',
    failed:
      'bg-[var(--ozer-accent-muted)] text-[var(--ozer-coral-600)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--ozer-coral-600)_40%,transparent)]',
  };

export function campaignStatusLabel(
  status: EmailCampaignStatus | string,
): string {
  if (status in CAMPAIGN_STATUS_LABEL) {
    return CAMPAIGN_STATUS_LABEL[status as EmailCampaignStatus];
  }

  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function campaignStatusBadgeClass(
  status: EmailCampaignStatus | string,
): string {
  if (status in CAMPAIGN_STATUS_BADGE_CLASS) {
    return CAMPAIGN_STATUS_BADGE_CLASS[status as EmailCampaignStatus];
  }

  return CAMPAIGN_STATUS_BADGE_CLASS.draft;
}
