import Link from 'next/link';

import type { CampaignUsageSnapshot } from '~/lib/campaigns/campaign-usage';
import { campaignBillingHref } from '~/lib/campaigns/campaign-usage';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignUpgradeCta } from './campaign-upgrade-cta';

function Meter({
  label,
  value,
  cap,
  ratio,
  warn,
  blocked,
  hint,
}: {
  label: string;
  value: string;
  cap?: string;
  ratio: number | null;
  warn: boolean;
  blocked: boolean;
  hint: string;
}) {
  const width = ratio == null ? 0 : Math.round(ratio * 100);
  return (
    <div>
      <p className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}>
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${workspaceText}`}>
        {value}
        {cap ? ` / ${cap}` : ''}
      </p>
      {ratio != null ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
          <div
            className={`h-full ${
              blocked
                ? 'bg-[var(--ozer-accent)]'
                : warn
                  ? 'bg-[var(--ozer-coral-400)]'
                  : 'bg-[var(--ozer-accent)]'
            }`}
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
      <p className={`mt-1 text-xs ${workspaceTextMuted}`}>{hint}</p>
    </div>
  );
}

export function CampaignUsageCard({
  snapshot,
  accountSlug,
  fromEmail,
}: {
  snapshot: CampaignUsageSnapshot;
  accountSlug: string;
  fromEmail: string | null;
}) {
  const sendHint = snapshot.sendsBlocked
    ? 'No send units left — upgrade or buy a pack before sending.'
    : snapshot.sendsSoftWarn
      ? 'About 80% of this cycle’s allotment is used.'
      : snapshot.planTier === 'none'
        ? 'Apply a Campaigns plan to grant monthly send units.'
        : `${snapshot.planTier} plan · unused monthly units expire at cycle end.`;

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 sm:grid-cols-3 ${workspacePanelCard} p-4`}>
        <Meter
          label="Contacts used"
          value={snapshot.contactsUsed.toLocaleString()}
          cap={
            snapshot.maxContacts > 0
              ? snapshot.maxContacts.toLocaleString()
              : undefined
          }
          ratio={snapshot.contactsRatio}
          warn={snapshot.contactsSoftWarn}
          blocked={snapshot.contactsBlocked}
          hint={
            snapshot.contactsBlocked
              ? 'Over the contact cap — upgrade or add a contact bump.'
              : snapshot.contactsSoftWarn
                ? 'Approaching this plan’s contact cap.'
                : snapshot.contactBonus > 0
                  ? `Includes +${snapshot.contactBonus.toLocaleString()} from contact bumps.`
                  : 'Subscribed mailing-list contacts (unsubscribes excluded).'
          }
        />
        <Meter
          label="Sends remaining"
          value={snapshot.balance.toLocaleString()}
          cap={
            snapshot.monthlyAllowance > 0
              ? snapshot.monthlyAllowance.toLocaleString()
              : undefined
          }
          ratio={snapshot.sendsRatio}
          warn={snapshot.sendsSoftWarn}
          blocked={snapshot.sendsBlocked}
          hint={
            snapshot.packBalance > 0
              ? `${snapshot.monthlyRemaining.toLocaleString()} monthly · ${snapshot.packBalance.toLocaleString()} from packs`
              : sendHint
          }
        />
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
            {snapshot.cycleEnd ? `Cycle ends ${snapshot.cycleEnd}. ` : ''}
            Campaigns never send as Ozer.{' '}
            <Link
              href={campaignBillingHref(accountSlug)}
              className="underline underline-offset-2"
            >
              Billing
            </Link>
          </p>
        </div>
      </div>
      {snapshot.contactsBlocked || snapshot.sendsBlocked ? (
        <CampaignUpgradeCta
          accountSlug={accountSlug}
          nextTierName={snapshot.nextTierName}
          message={
            snapshot.contactsBlocked
              ? 'You are over the contact cap. Upgrade Campaigns or add a contact bump to keep sending.'
              : 'You are out of send units. Upgrade or buy a send pack to keep sending.'
          }
        />
      ) : snapshot.contactsSoftWarn || snapshot.sendsSoftWarn ? (
        <p className={`text-sm ${workspaceTextMuted}`}>
          Usage is above 80%.{' '}
          <Link
            href={campaignBillingHref(accountSlug)}
            className="underline underline-offset-2"
          >
            Review upgrade or packs
          </Link>
          {snapshot.nextTierName
            ? ` — next tier is ${snapshot.nextTierName}.`
            : '.'}
        </p>
      ) : null}
    </div>
  );
}
