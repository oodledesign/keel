import { Badge } from '@kit/ui/badge';

import type {
  EmailCampaign,
  EmailCampaignRecipient,
} from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

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
          {campaign.sentCount} sent · {campaign.failedCount} failed ·{' '}
          {campaign.skippedCount} skipped · {campaign.unsubscribedCount}{' '}
          unsubscribed
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={workspaceTextMuted}>
              <th className="pb-2 font-medium">Recipient</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((row) => (
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
                  <Badge variant="outline">{row.status}</Badge>
                  {row.unsubscribedAt ? (
                    <Badge variant="secondary" className="ml-2">
                      unsubscribed
                    </Badge>
                  ) : null}
                </td>
                <td className={`py-2 ${workspaceTextMuted}`}>
                  {row.errorMessage || row.skipReason || row.sesMessageId || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
