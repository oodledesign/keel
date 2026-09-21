import Link from 'next/link';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  portalCreditsNextSteps,
  portalCreditsResetCopy,
} from '~/lib/credits/portal-overview-credits';

export function PortalOverviewCreditsChip({
  clientSlug,
  balance,
  nextRenewalDate,
}: {
  clientSlug: string;
  balance: number;
  nextRenewalDate: string | null;
}) {
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );
  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    clientSlug,
  );
  const nextSteps = portalCreditsNextSteps(balance, nextRenewalDate);

  return (
    <div className="block shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 sm:min-w-[10.5rem]">
      <Link href={creditsHref} className="block no-underline">
        <p className="text-[11px] font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
          Available credits
        </p>
        <p className="mt-1 text-2xl font-semibold text-[var(--ozer-text-on-light)] tabular-nums">
          {balance}
        </p>
        <p className="mt-0.5 text-xs text-[var(--ozer-text-on-light-muted)]">
          {portalCreditsResetCopy(nextRenewalDate)}
        </p>
      </Link>
      {nextSteps.topUp || nextSteps.billing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {nextSteps.topUp ? (
            <Button asChild size="sm" data-test="portal-overview-top-up">
              <Link href={creditsHref}>Top up</Link>
            </Button>
          ) : null}
          {nextSteps.billing ? (
            <Button
              asChild
              size="sm"
              variant={nextSteps.topUp ? 'outline' : 'default'}
              data-test="portal-overview-billing"
            >
              <Link href={billingHref}>Billing</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
