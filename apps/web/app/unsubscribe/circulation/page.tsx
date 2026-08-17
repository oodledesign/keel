import {
  createCommercialCirculationService,
  decodeCirculationUnsubscribeToken,
} from '~/lib/commercial/circulation/circulation.service';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export const metadata = {
  title: 'Unsubscribe from matching opportunities',
};

export const dynamic = 'force-dynamic';

export default async function CirculationUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const decoded = token ? decodeCirculationUnsubscribeToken(token) : null;
  let error: string | null = null;
  let agencyName = 'the agency';

  if (decoded) {
    try {
      const admin = getSupabaseServerAdminClient();
      const { data: account } = await admin
        .from('accounts')
        .select('name')
        .eq('id', decoded.accountId)
        .maybeSingle();
      agencyName =
        (account as { name?: string | null } | null)?.name?.trim() || agencyName;

      await createCommercialCirculationService(admin).unsubscribe(
        decoded.accountId,
        decoded.email,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to unsubscribe';
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ozer-surface-canvas)] px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--ozer-surface-panel)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[var(--workspace-shell-text)]">
          {decoded && !error
            ? 'You have been unsubscribed'
            : 'Invalid unsubscribe link'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--workspace-shell-text-muted)]">
          {decoded && !error
            ? `${decoded.email} will no longer receive matching commercial opportunity emails from ${agencyName}.`
            : (error ?? 'This unsubscribe link is missing or invalid.')}
        </p>
      </div>
    </main>
  );
}
