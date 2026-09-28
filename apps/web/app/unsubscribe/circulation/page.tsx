import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { Button } from '@kit/ui/button';

import {
  CIRCULATION_ONE_CLICK_UNSUBSCRIBE_PATH,
  type MarketingStatus,
  createCommercialCirculationService,
  decodeCirculationUnsubscribeToken,
} from '~/lib/commercial/circulation/circulation.service';

export const metadata = {
  title: 'Unsubscribe from matching opportunities',
};

export const dynamic = 'force-dynamic';

async function loadUnsubscribeState(accountId: string, email: string) {
  const admin = getSupabaseServerAdminClient();
  const [{ data: account }, status] = await Promise.all([
    admin.from('accounts').select('name').eq('id', accountId).maybeSingle(),
    createCommercialCirculationService(admin).getMarketingStatus(
      accountId,
      email,
    ),
  ]);

  return {
    agencyName:
      (account as { name?: string | null } | null)?.name?.trim() ||
      'the agency',
    status,
  };
}

export default async function CirculationUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const decoded = token ? decodeCirculationUnsubscribeToken(token) : null;

  let agencyName = 'the agency';
  let status: MarketingStatus | null = null;
  let error: string | null = null;

  if (decoded) {
    try {
      ({ agencyName, status } = await loadUnsubscribeState(
        decoded.accountId,
        decoded.email,
      ));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load this link';
    }
  }

  const unsubscribed = status === 'unsubscribed' || status === 'suppressed';

  let title = 'Invalid unsubscribe link';
  let body = error ?? 'This unsubscribe link is missing or invalid.';
  if (decoded && !error) {
    title = unsubscribed ? 'You have been unsubscribed' : 'Unsubscribe?';
    body = unsubscribed
      ? `${decoded.email} will no longer receive matching commercial opportunity emails from ${agencyName}.`
      : `Stop matching commercial opportunity emails from ${agencyName} to ${decoded.email}.`;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ozer-surface-canvas)] px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--ozer-surface-panel)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[var(--workspace-shell-text)]">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--workspace-shell-text-muted)]">
          {body}
        </p>
        {decoded && token && !error && !unsubscribed ? (
          <form
            method="post"
            action={`${CIRCULATION_ONE_CLICK_UNSUBSCRIBE_PATH}?token=${encodeURIComponent(token)}`}
            className="mt-6"
          >
            <Button type="submit" data-test="circulation-confirm-unsubscribe">
              Confirm unsubscribe
            </Button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
