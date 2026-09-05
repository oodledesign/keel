import Link from 'next/link';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  campaignUsageMeter,
  effectiveCampaignContactCap,
  nextCampaignUpgradeTier,
  normalizeCampaignPlanTier,
} from '~/lib/billing/campaign-pricing';
import type { CampaignCreditPool } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

function MeterBar({
  ratio,
  softWarning,
  hardBlocked,
}: {
  ratio: number;
  softWarning: boolean;
  hardBlocked: boolean;
}) {
  const width = `${Math.min(100, Math.round(ratio * 100))}%`;
  const fill = hardBlocked
    ? 'bg-destructive'
    : softWarning
      ? 'bg-amber-500'
      : 'bg-[var(--ozer-accent)]';

  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
      <div className={`h-full ${fill}`} style={{ width }} />
    </div>
  );
}

export function CampaignUsageCard({
  subscriberCount,
  usage,
  fromEmail,
  accountSlug,
}: {
  subscriberCount: number;
  usage: CampaignCreditPool;
  fromEmail: string | null;
  accountSlug: string;
}) {
  const contactCap = effectiveCampaignContactCap({
    maxContacts: usage.max_contacts,
    bonusContacts: usage.bonus_contacts,
  });
  const contacts = campaignUsageMeter({
    used: subscriberCount,
    cap: contactCap,
  });
  const sendsUsed = Math.max(0, usage.monthly_allowance - usage.balance);
  const sends = campaignUsageMeter({
    used: sendsUsed,
    cap: usage.monthly_allowance,
  });
  const remainingSends = usage.balance;
  const tier = normalizeCampaignPlanTier(usage.plan_tier);
  const upgrade = nextCampaignUpgradeTier(tier);
  const billingHref = `${pathsConfig.app.accountAddonsSettings.replace(
    '[account]',
    accountSlug,
  )}?addon=campaigns#addons`;
  const settingsBillingHref = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className={`space-y-3 ${workspacePanelCard} p-4`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p
            className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}
          >
            Contacts used / cap
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${workspaceText}`}
            data-test="campaign-contacts-meter"
          >
            {subscriberCount.toLocaleString()}
            {contacts.unlimited ? '' : ` / ${contactCap.toLocaleString()}`}
          </p>
          {!contacts.unlimited ? (
            <MeterBar
              ratio={contacts.ratio}
              softWarning={contacts.softWarning}
              hardBlocked={contacts.hardBlocked}
            />
          ) : null}
          <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
            {contacts.hardBlocked
              ? 'Over this plan’s contact cap — upgrade or buy a contact pack before sending.'
              : contacts.softWarning
                ? 'Approaching the contact cap (80%).'
                : usage.bonus_contacts > 0
                  ? `Includes +${usage.bonus_contacts.toLocaleString()} from packs.`
                  : 'Subscribed contacts (unsubscribes excluded).'}
          </p>
        </div>
        <div>
          <p
            className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}
          >
            Sends used / remaining
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${workspaceText}`}
            data-test="campaign-sends-meter"
          >
            {sendsUsed.toLocaleString()} used ·{' '}
            {remainingSends.toLocaleString()} left
          </p>
          {usage.monthly_allowance > 0 ? (
            <MeterBar
              ratio={sends.ratio}
              softWarning={sends.softWarning}
              hardBlocked={remainingSends <= 0}
            />
          ) : null}
          <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
            {remainingSends <= 0
              ? 'No send units left — upgrade or buy a send pack.'
              : sends.softWarning
                ? 'About 80% of this cycle’s allotment is used.'
                : tier === 'none'
                  ? 'Apply a Campaigns plan to grant monthly send units.'
                  : `${tier} plan · ${usage.monthly_allowance.toLocaleString()} / month · 1 unit per email.`}
          </p>
        </div>
        <div>
          <p
            className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}
          >
            From identity
          </p>
          <p className={`mt-1 text-sm font-medium ${workspaceText}`}>
            {fromEmail ?? 'Not set'}
          </p>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Custom From needs a verified sending domain. Campaigns never send as
            Ozer.
          </p>
        </div>
      </div>

      {contacts.softWarning ||
      contacts.hardBlocked ||
      sends.softWarning ||
      remainingSends <= 0 ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
            contacts.hardBlocked || remainingSends <= 0
              ? 'border-destructive/40 bg-destructive/5'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}
          data-test="campaign-usage-warning"
        >
          <p className={`text-sm ${workspaceText}`}>
            {contacts.hardBlocked || remainingSends <= 0
              ? 'Sending is blocked until you raise the cap or add send units.'
              : 'Usage is high — upgrade or add a pack before the next send.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {upgrade ? (
              <Button asChild size="sm" className={workspaceBtnPrimary}>
                <Link href={billingHref}>
                  Upgrade to {upgrade.name} · £{upgrade.priceGbp}/mo
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href={settingsBillingHref}>Buy a pack</Link>
              </Button>
            )}
          </div>
        </div>
      ) : upgrade && tier !== 'none' ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          On {tier}. Need more room?{' '}
          <Link href={billingHref} className="underline underline-offset-2">
            Upgrade to {upgrade.name} (£{upgrade.priceGbp}/mo)
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
