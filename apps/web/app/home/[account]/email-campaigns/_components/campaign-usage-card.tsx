import type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export function CampaignUsageCard({
  subscriberCount,
  usage,
  fromEmail,
}: {
  subscriberCount: number;
  usage: CampaignCreditPool;
  fromEmail: string | null;
}) {
  const contactCap = usage.max_contacts;
  const contactsUnlimited = contactCap === 0;
  const contactsOver = !contactsUnlimited && subscriberCount > contactCap;

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${workspacePanelCard} p-4`}>
      <div>
        <p className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}>
          Mailing list
        </p>
        <p className={`mt-1 text-lg font-semibold ${workspaceText}`}>
          {subscriberCount.toLocaleString()}
          {contactsUnlimited ? '' : ` / ${contactCap.toLocaleString()}`}
        </p>
        <p className={`text-xs ${workspaceTextMuted}`}>
          {contactsOver
            ? 'Over this plan’s contact cap — upgrade before sending.'
            : 'Subscribed contacts (unsubscribes excluded).'}
        </p>
      </div>
      <div>
        <p className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}>
          Send units left
        </p>
        <p className={`mt-1 text-lg font-semibold ${workspaceText}`}>
          {usage.balance.toLocaleString()}
          {usage.monthly_allowance
            ? ` / ${usage.monthly_allowance.toLocaleString()}`
            : ''}
        </p>
        <p className={`text-xs ${workspaceTextMuted}`}>
          {usage.plan_tier === 'none'
            ? 'Apply a Campaigns plan to grant monthly send units.'
            : `${usage.plan_tier} plan · 1 unit per email sent.`}
        </p>
      </div>
      <div>
        <p className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}>
          From identity
        </p>
        <p className={`mt-1 text-sm font-medium ${workspaceText}`}>
          {fromEmail ?? 'Not set'}
        </p>
        <p className={`text-xs ${workspaceTextMuted}`}>
          Brand contact email. Campaigns never send as Ozer.
        </p>
      </div>
    </div>
  );
}
