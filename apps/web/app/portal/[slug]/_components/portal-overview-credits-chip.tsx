import Link from 'next/link';

import pathsConfig from '~/config/paths.config';
import { portalCreditsResetCopy } from '~/lib/credits/portal-overview-credits';

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

  return (
    <Link
      href={creditsHref}
      className="block shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-3 no-underline transition-colors hover:bg-[var(--workspace-shell-panel-hover)] sm:min-w-[10.5rem]"
    >
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
  );
}
