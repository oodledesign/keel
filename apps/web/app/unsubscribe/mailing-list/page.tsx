import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { markCampaignRecipientsUnsubscribed } from '~/lib/campaigns/campaigns.service';
import { unsubscribeCampaignRecipientByToken } from '~/lib/campaigns/resolve-campaign-audience';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { unsubscribeWorkspaceMailingListByToken } from '~/lib/workspace-forms/workspace-mailing-list';

export const metadata = {
  title: 'Unsubscribe from mailing list',
};

export const dynamic = 'force-dynamic';

export default async function MailingListUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let error: string | null = null;
  let email: string | null = null;
  let workspaceName = 'this workspace';

  if (token) {
    try {
      const admin = getSupabaseServerAdminClient();
      const result =
        (await unsubscribeWorkspaceMailingListByToken(admin, token)) ??
        (await unsubscribeCampaignRecipientByToken(admin, token));

      if (!result) {
        error = 'This unsubscribe link is missing or invalid.';
      } else {
        email = result.email;
        await markCampaignRecipientsUnsubscribed(
          admin,
          result.accountId,
          result.email,
        );
        const { data: account } = await admin
          .from('accounts')
          .select('name')
          .eq('id', result.accountId)
          .maybeSingle();
        workspaceName =
          (account as { name?: string | null } | null)?.name?.trim() ||
          workspaceName;

        try {
          await createCommercialCirculationService(admin).unsubscribe(
            result.accountId,
            result.email,
          );
        } catch {
          // Business workspaces have no circulation rows; ignore.
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to unsubscribe';
    }
  } else {
    error = 'This unsubscribe link is missing or invalid.';
  }

  const success = Boolean(email && !error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ozer-surface-canvas)] px-6 py-12">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--ozer-surface-panel)] p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-[var(--workspace-shell-text)]">
          {success ? 'You have been unsubscribed' : 'Invalid unsubscribe link'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--workspace-shell-text-muted)]">
          {success
            ? `${email} will no longer receive mailing-list emails from ${workspaceName}.`
            : error}
        </p>
      </div>
    </main>
  );
}
