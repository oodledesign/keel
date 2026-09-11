import { cn } from '@kit/ui/utils';

import {
  campaignRecipientStatusBadgeClass,
  campaignRecipientStatusLabel,
} from '~/lib/campaigns/campaign-status';
import type {
  EmailCampaign,
  EmailCampaignRecipient,
} from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function engagementLabel(row: EmailCampaignRecipient) {
  const parts: string[] = [];
  if (row.deliveredAt) parts.push(`delivered ${formatWhen(row.deliveredAt)}`);
  if (row.openedAt) {
    parts.push(
      `opened ${formatWhen(row.openedAt)}${row.openCount > 1 ? ` ×${row.openCount}` : ''}`,
    );
  }
  if (row.clickedAt) {
    parts.push(
      `clicked ${formatWhen(row.clickedAt)}${row.clickCount > 1 ? ` ×${row.clickCount}` : ''}`,
    );
  }
  if (row.bouncedAt) {
    parts.push(
      `bounced ${formatWhen(row.bouncedAt)}${row.bounceType ? ` (${row.bounceType})` : ''}`,
    );
  }
  if (row.complaintAt) parts.push(`complaint ${formatWhen(row.complaintAt)}`);
  return parts.length ? parts.join(' · ') : null;
}

export function CampaignRecipientLog({
  campaign,
  recipients,
}: {
  campaign: EmailCampaign;
  recipients: EmailCampaignRecipient[];
}) {
  return (
    <div className={`${workspacePanelCard} p-4`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className={`font-semibold ${workspaceText}`}>Send log</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          {campaign.sentCount} sent · {campaign.deliveredCount} delivered ·{' '}
          {campaign.failedCount} failed · {campaign.skippedCount} skipped ·{' '}
          {campaign.unsubscribedCount} unsubscribed
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={workspaceTextMuted}>
              <th className="pb-2 font-medium">Recipient</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Engagement</th>
              <th className="pb-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((row) => {
              const engagement = engagementLabel(row);
              return (
                <tr
                  key={row.id}
                  className="border-t border-[color:var(--workspace-shell-border)]"
                >
                  <td className={`py-2 ${workspaceText}`}>
                    <div>{row.displayName || row.email}</div>
                    {row.displayName ? (
                      <div className={`text-xs ${workspaceTextMuted}`}>
                        {row.email}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                          campaignRecipientStatusBadgeClass(row.status),
                        )}
                      >
                        {campaignRecipientStatusLabel(row.status)}
                      </span>
                      {row.unsubscribedAt ? (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                            campaignRecipientStatusBadgeClass('skipped'),
                          )}
                        >
                          Unsubscribed
                        </span>
                      ) : null}
                      {row.bouncedAt ? (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                            campaignRecipientStatusBadgeClass('failed'),
                          )}
                        >
                          Bounced
                        </span>
                      ) : null}
                      {row.complaintAt ? (
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                            campaignRecipientStatusBadgeClass('failed'),
                          )}
                        >
                          Complaint
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`py-2 ${workspaceTextMuted}`}>
                    {engagement || '—'}
                  </td>
                  <td className={`py-2 ${workspaceTextMuted}`}>
                    {row.errorMessage ||
                      row.skipReason ||
                      row.sesMessageId ||
                      '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
